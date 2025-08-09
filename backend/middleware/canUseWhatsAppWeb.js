const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res, next) => {
  const user = req.user;
  if (!user) return res.sendStatus(401);

  if (user.email && user.email.toLowerCase() === 'rodrigooidr@hotmail.com') {
    return next();
  }
  try {
    const { rows } = await pool.query(
      "SELECT allowed_for_all FROM integrations WHERE company_id = $1 AND type = 'whatsapp_web' LIMIT 1",
      [user.company_id]
    );
    if (rows[0]?.allowed_for_all) {
      if (user.role === 'owner' || user.role === 'admin') return next();
    }
    return res.status(403).json({ ok:false, error:'WhatsApp Web restrito pelo administrador do sistema.' });
  } catch (e) {
    console.error('canUseWhatsAppWeb error', e);
    return res.status(500).json({ ok:false, error:'Falha ao validar permissão do WhatsApp Web.' });
  }
};
