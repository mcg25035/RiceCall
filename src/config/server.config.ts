export const serverConfig = {
  url: process.env.SERVER_URL || 'http://localhost',
  port: parseInt(process.env.SERVER_PORT || '4500'),
};
