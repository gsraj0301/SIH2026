import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import triageRoutes from './routes/triageRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import syncRoutes from './routes/syncRoutes.js';

import errorHandler from './middleware/errorHandler.js';

const app = express();

// CORS so the React Native app (during dev via Expo) can call us.
app.use(cors());
// JSON bodies for everything except multipart triage uploads.
app.use(express.json({ limit: '5mb' }));

// Liveness probe — handy for the demo.
app.get('/health', (req, res) => {
  res.json({ success: true, service: 'healora-backend', time: new Date().toISOString() });
});

// Route mounting. Order matters: everything below /api/auth is guarded by JWT.
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/sync', syncRoutes);

// 404 for anything unmatched.
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// The central error handler MUST be the last middleware — errors from any of
// the routes above funnel down here instead of crashing the process.
app.use(errorHandler);

export default app;