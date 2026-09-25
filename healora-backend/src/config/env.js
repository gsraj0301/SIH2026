import 'dotenv/config';

const env = {
    port: process.env.PORT || 3000,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    voiceServiceUrl: process.env.VOICE_SERVICE_URL || 'http://localhost:4000',
    databaseUrl: process.env.DATABASE_URL,
};

export default env;