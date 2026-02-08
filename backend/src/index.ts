import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { getDatabase } from './db/database.js';
import callsRouter from './routes/calls.js';
import oracleRouter from './routes/oracle.js';
import usersRouter from './routes/users.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API Routes
app.use('/api/calls', callsRouter);
app.use('/api/oracle', oracleRouter);
app.use('/api/users', usersRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    // Initialize database
    const db = getDatabase();
    await db.initialize();

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 CALL IT Backend API running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 API endpoints:`);
      console.log(`   - GET  /api/calls`);
      console.log(`   - GET  /api/calls/:id`);
      console.log(`   - GET  /api/calls/:id/challenges`);
      console.log(`   - GET  /api/users/:wallet`);
      console.log(`   - GET  /api/users/:wallet/calls`);
      console.log(`   - GET  /api/users/leaderboard`);
      console.log(`   - GET  /api/oracle/pending-calls`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  const db = getDatabase();
  await db.close();
  process.exit(0);
});
