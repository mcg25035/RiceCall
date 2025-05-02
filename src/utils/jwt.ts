import jwt from 'jsonwebtoken';

// Config
import { jwtConfig } from '@/config';

export function generateJWT(data: any) {
  const encoded = jwt.sign(data, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
  return encoded;
}

export function verifyJWT(token: string) {
  const decoded = jwt.verify(token, jwtConfig.secret) as any;
  return { valid: true, ...decoded };
}
