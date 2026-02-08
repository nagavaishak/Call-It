import express from 'express';
import { getDatabase } from '../db/database.js';

const router = express.Router();
const db = getDatabase();

/**
 * GET /api/users/:wallet - Get user profile
 */
router.get('/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;

    const result = await db.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [wallet]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:wallet/calls - Get user's calls
 */
router.get('/:wallet/calls', async (req, res) => {
  try {
    const { wallet } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT * FROM calls WHERE caller = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [wallet, Number(limit), Number(offset)]
    );

    res.json({ calls: result.rows });
  } catch (error: any) {
    console.error('Error fetching user calls:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:wallet/challenges - Get user's challenges
 */
router.get('/:wallet/challenges', async (req, res) => {
  try {
    const { wallet } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT * FROM challenges WHERE challenger = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [wallet, Number(limit), Number(offset)]
    );

    res.json({ challenges: result.rows });
  } catch (error: any) {
    console.error('Error fetching user challenges:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leaderboard - Get top users by score
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await db.query(
      `SELECT wallet_address, callit_score, tier, total_calls, won_calls,
              current_streak
       FROM users
       WHERE total_calls > 0
       ORDER BY callit_score DESC LIMIT $1`,
      [Number(limit)]
    );

    res.json({ leaderboard: result.rows });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
