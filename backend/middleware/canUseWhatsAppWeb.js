// Middleware que restringe o uso do WhatsApp Web manual
// Somente o proprietário do sistema (e-mail raiz) pode acessar.

export default function canUseWhatsAppWeb(req, res, next) {
  const user = req.user;
  if (!user) return res.sendStatus(401);

  const rootEmail = (process.env.ROOT_OWNER_EMAIL || 'rodrigooidr@hotmail.com').toLowerCase();
  if (user.email && user.email.toLowerCase() === rootEmail) {
    return next();
  }
  return res
    .status(403)
    .json({ ok: false, error: 'WhatsApp Web restrito ao proprietário do sistema.' });
}

