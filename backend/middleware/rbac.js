
export function requireRole(...roles){
  return (req,res,next)=>{
    const user = req.user || {};
    if(roles.includes(user.role) || user.is_owner){ return next(); }
    return res.status(403).json({ error: 'forbidden' });
  };
}
