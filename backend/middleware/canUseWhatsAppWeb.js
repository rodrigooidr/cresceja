// backend/middleware/canUseWhatsAppWeb.js
export default function canUseWhatsAppWeb(req, res, next) {
  const user = req.user;
  if (!user) return res.sendStatus(401);

  const rootEmail = String(process.env.ROOT_OWNER_EMAIL || 'rodrigooidr@hotmail.com').toLowerCase();
  if (user.email && user.email.toLowerCase() === rootEmail) return next();

  const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean);
  const isAdmin = roles.includes('OrgOwner') || roles.includes('SuperAdmin') || roles.includes('OrgAdmin');
  if (isAdmin) return next();

  const feat = req.org?.features?.channels_whatsapp;
  const enabled = typeof feat === 'object' ? !!feat.value : !!feat;
  if (enabled) return next();

  return res.status(403).json({
    ok: false,
    error: 'forbidden',
    message: 'WhatsApp Web restrito: habilite no plano (channels_whatsapp) ou use uma conta Owner/Admin.',
  });
}
