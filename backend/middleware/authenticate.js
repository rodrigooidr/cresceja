// backend/middleware/authenticate.js
import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  try {
    let token = req.headers?.authorization || '';
    if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7);
    } else {
      token = null;
    }

    if (!token) {
      return res.status(401).json({ error: 'missing_token' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'segredo');
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Export default para compatibilizar com `import authenticate from ...`
export default authenticate;
