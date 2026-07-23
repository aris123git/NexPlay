import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'nexplay-dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  accessTokenTtlSec: 60 * 60 * 12,
  refreshTokenTtlSec: 60 * 60 * 24 * 30,
};
