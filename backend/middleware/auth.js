import jwt from "jsonwebtoken";
const SECRET = process.env.JWT_SECRET || "devsecret";

export function signToken(payload){ return jwt.sign(payload, SECRET, { expiresIn: "7d" }); }

export function authOptional(req, _res, next){
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (tok){
    try { req.user = jwt.verify(tok, SECRET); } catch { req.user = null; }
  }
  next();
}

export function authRequired(req, res, next){
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tok) return res.status(401).json({ error: "unauthorized" });
  try {
    req.user = jwt.verify(tok, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export function requireRole(...roles){
  return (req, res, next)=>{
    const role = req.user?.role;
    if (!role || !roles.includes(role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}
