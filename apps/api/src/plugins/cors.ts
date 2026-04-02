import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      /\.vercel\.app$/,
      /\.likemove360\.com\.br$/,
      /\.bildee\.com\.br$/,
      'https://vendamais.bildee.com.br',
    ],
    credentials: true,
  });
}
