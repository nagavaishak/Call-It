import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database connection pool
 */
export class Database {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool (for transactions)
   */
  async getClient(): Promise<pg.PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing database schema...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    try {
      await this.query(schema);
      console.log('✅ Database schema initialized');
    } catch (error) {
      console.error('❌ Failed to initialize schema:', error);
      throw error;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
let dbInstance: Database | null = null;

export function getDatabase(connectionString?: string): Database {
  if (!dbInstance) {
    const connString = connectionString || process.env.DATABASE_URL;
    if (!connString) {
      throw new Error('DATABASE_URL not configured');
    }
    dbInstance = new Database(connString);
  }
  return dbInstance;
}
