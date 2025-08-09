module.exports = function (req, res, next) {
  const allowedEmail = "rodrigooidr@hotmail.com";
  if (req.user?.email !== allowedEmail) {
    return res.status(403).json({ error: "Acesso restrito ao modo de teste pessoal." });
  }
  next();
};