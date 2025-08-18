import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token ausente" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== "admin" && req.user.is_admin !== true)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}
