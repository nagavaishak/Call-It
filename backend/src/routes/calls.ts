import express from 'express';
import { getDatabase } from '../db/database.js';

const router = express.Router();
const db = getDatabase();

/**
 * GET /api/calls - Get all calls (with pagination)
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;

    let query = 'SELECT * FROM calls';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(Number(limit), Number(offset));

    const result = await db.query(query, params);

    res.json({
      calls: result.rows,
      total: result.rowCount,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/calls/:id - Get call by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM calls WHERE id = $1 OR onchain_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json({ call: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching call:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/calls/:id/challenges - Get challenges for a call
 */
router.get('/:id/challenges', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM challenges WHERE call_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json({ challenges: result.rows });
  } catch (error: any) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/calls - Create a new call (webhook from indexer)
 */
router.post('/', async (req, res) => {
  try {
    const {
      onchain_id,
      caller_address,
      claim,
      category,
      token_address,
      target_price,
      creation_price,
      stake,
      confidence,
      deadline,
    } = req.body;

    const id = `call_${onchain_id}`;
    const created_at = Math.floor(Date.now() / 1000);

    // Upsert user
    await db.query(
      `INSERT INTO users (wallet_address, created_at, updated_at)
       VALUES ($1, $2, $2)
       ON CONFLICT (wallet_address) DO UPDATE SET updated_at = $2`,
      [caller_address, created_at]
    );

    // Insert call
    await db.query(
      `INSERT INTO calls (
        id, onchain_id, caller, caller_address, claim, category,
        token_address, target_price, creation_price, stake, confidence,
        deadline, created_at, status, challengers_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (onchain_id) DO NOTHING`,
      [
        id, onchain_id, caller_address, caller_address, claim, category,
        token_address, target_price, creation_price, stake, confidence,
        deadline, created_at, 'Active', 0
      ]
    );

    // Update user stats
    await db.query(
      `UPDATE users SET total_calls = total_calls + 1 WHERE wallet_address = $1`,
      [caller_address]
    );

    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Error creating call:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
