export function mapApiErrorToForm(err, setError) {
  const code = err?.response?.data?.error;
  if (code === 'exclusive_mode') return { toast: 'Conflito: Baileys e API são exclusivos para o mesmo número.' };
  if (code === 'feature_disabled') return { toast: 'Seu plano não permite este recurso.' };
  if (code === 'feature_limit_reached') return { toast: 'Limite do plano atingido.' };
  if (code === 'duplicate_email') { setError('email', { message: 'E-mail já cadastrado nesta organização.' }); return {}; }
  // etc.
  return { toast: 'Não foi possível concluir a operação.' };
}
