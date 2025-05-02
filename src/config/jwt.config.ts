export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'secret',
  expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '3600000'),
};
