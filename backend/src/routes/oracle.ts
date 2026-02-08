import express from 'express';
import { getDatabase } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/oracle/pending-calls - Get calls ready for resolution
 * Used by oracle nodes to find calls past their deadline
 */
router.get('/pending-calls', async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);

    const result = await getDatabase().query(
      `SELECT * FROM calls
       WHERE status = 'Active'
       AND deadline <= $1
       ORDER BY deadline ASC`,
      [now]
    );

    res.json({ calls: result.rows });
  } catch (error: any) {
    console.error('Error fetching pending calls:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/resolve - Webhook when oracle resolves a call
 */
router.post('/resolve', async (req, res) => {
  try {
    const { call_id, outcome, tx_signature } = req.body;

    const status = outcome === 'CallerWins' ? 'ResolvedCallerWins' : 'ResolvedCallerLoses';
    const resolved_at = Math.floor(Date.now() / 1000);

    await getDatabase().query(
      `UPDATE calls SET status = $1, resolved_at = $2 WHERE id = $3 OR onchain_id = $3`,
      [status, resolved_at, call_id]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating resolved call:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
