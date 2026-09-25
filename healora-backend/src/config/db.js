import { PrismaClient } from '@prisma/client';
import env from './env.js';

const prisma = new PrismaClient();
export default prisma;