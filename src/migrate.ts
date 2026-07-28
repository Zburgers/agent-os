import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { closeDatabase, pool } from './db.ts';

const migrationDir = new URL('../db/migrations/', import.meta.url);
const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort();
for (const file of files) {
  const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
  if (existing.rowCount) continue;
  const sql = await readFile(join(migrationDir.pathname, file), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`applied ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
await closeDatabase();
