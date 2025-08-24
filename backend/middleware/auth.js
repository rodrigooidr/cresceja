import jwt from "jsonwebtoken";
const SECRET = process.env.JWT_SECRET || "devsecret";

export function signToken(payload){ return jwt.sign(payload, SECRET, { expiresIn: "7d" }); }

export function authOptional(req, _res, next){
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (tok){
    try {
      const payload = jwt.verify(tok, SECRET);
      req.user = { id: payload.id || payload.sub, ...payload };
    } catch {
      req.user = null;
    }
  }
  next();
}

export function authRequired(req, res, next){
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tok) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(tok, SECRET);
    req.user = { id: payload.id || payload.sub, ...payload };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export function requireRole(...roles){
  return (req, res, next)=>{
    const role = req.user?.role;
    const isOwner = req.user?.is_owner;
    if (!role && !isOwner) return res.status(403).json({ error: "forbidden" });
    if (isOwner || roles.includes(role)) return next();
    return res.status(403).json({ error: "forbidden" });
  };
}
