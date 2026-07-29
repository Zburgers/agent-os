import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { closeDatabase, pool } from './db.ts';

const migrationDir = new URL('../db/migrations/', import.meta.url);
await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
await pool.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text');
const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort();
for (const file of files) {
  const sql = await readFile(join(migrationDir.pathname, file), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const existing = await pool.query<{ checksum: string | null }>('SELECT checksum FROM schema_migrations WHERE version = $1', [file]);
  if (existing.rowCount) {
    if (existing.rows[0].checksum && existing.rows[0].checksum !== checksum) throw new Error(`migration_checksum_mismatch:${file}`);
    if (!existing.rows[0].checksum) await pool.query('UPDATE schema_migrations SET checksum=$2 WHERE version=$1', [file, checksum]);
    continue;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version,checksum) VALUES ($1,$2)', [file, checksum]);
    await client.query('COMMIT');
    console.log(`applied ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
await closeDatabase();
