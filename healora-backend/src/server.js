import app from './app.js';
import prisma from './config/db.js';
import env from './config/env.js';

// Boot sequence: verify the DB connection first, then start listening.
// If Postgres is down we exit cleanly with a readable message instead of
// crashing somewhere inside a request later.
const start = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');

    app.listen(env.port, () => {
      console.log(`✅ Healora backend running → http://localhost:${env.port}`);
      console.log(`   Voice service → ${env.voiceServiceUrl}/api/v1/voice/process`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

start();