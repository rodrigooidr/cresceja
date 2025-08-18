// backend/scripts/reset-password.js
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, closePool } from '../config/db.js';

const [email, newPassword, roleFlag] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error('Uso: node --env-file=.env scripts/reset-password.js <email> <nova_senha> [--owner|--client-admin|--user]');
  process.exit(1);
}

const wantedRole = roleFlag?.startsWith('--')
  ? roleFlag.replace('--', '').replace('-', '_')
  : null;

async function columnExists(column) {
  const sql = `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name=$1
    LIMIT 1
  `;
  const { rowCount } = await query(sql, [column]);
  return rowCount > 0;
}

try {
  const { rows: urows } = await query(
    'SELECT id, email, role FROM public.users WHERE email = $1',
    [email]
  );
  if (!urows.length) {
    console.error('Usuário não encontrado:', email);
    process.exit(2);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const hasPasswordHash = await columnExists('password_hash');
  const hasPassword = await columnExists('password');

  if (hasPasswordHash) {
    // Preferível: gravar hash em password_hash e limpar password legada
    const sql = hasPassword
      ? `UPDATE public.users SET password_hash = $1, password = NULL WHERE email = $2`
      : `UPDATE public.users SET password_hash = $1 WHERE email = $2`;
    await query(sql, [hash, email]);
  } else if (hasPassword) {
    // Fallback: gravar hash em "password" (se seu login ainda comparar com hash)
    // Atenção: se seu login compara texto puro, use a Opção B (plaintext) abaixo.
    await query(`UPDATE public.users SET password = $1 WHERE email = $2`, [hash, email]);
  } else {
    console.error('Nenhuma coluna de senha encontrada (password_hash ou password).');
    process.exit(3);
  }

  if (wantedRole) {
    // normaliza flags: --owner | --client-admin | --user
    const valid = new Set(['owner', 'client_admin', 'user']);
    const role = wantedRole.toLowerCase();
    if (!valid.has(role)) {
      console.warn('Role inválido, ignorando:', role);
    } else {
      await query(`UPDATE public.users SET role = $1 WHERE email = $2`, [role, email]);
    }
  }

  const { rows } = await query(
    'SELECT id, email, role FROM public.users WHERE email = $1',
    [email]
  );
  console.log('Senha resetada com sucesso para:', rows[0]);
  console.log('Dica: faça logout e login novamente para renovar o token.');
} catch (e) {
  console.error('Erro ao resetar senha:', e);
  process.exit(4);
} finally {
  await closePool?.();
}
