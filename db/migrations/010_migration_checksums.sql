-- Checksums are maintained by src/migrate.ts and make edited historical
-- migrations fail closed on every subsequent startup.
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text;
