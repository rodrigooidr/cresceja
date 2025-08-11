
import jwt from 'jsonwebtoken';

export function authRequired(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token) return res.status(401).json({error:'unauthorized'});
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = payload;
    next();
  }catch(e){
    return res.status(401).json({error:'invalid_token'});
  }
}
