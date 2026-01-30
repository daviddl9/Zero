#!/usr/bin/env tsx
/**
 * Robust migration script that handles common migration errors.
 *
 * This script:
 * 1. Runs drizzle-kit migrations
 * 2. If migrations fail with "already exists" errors, attempts to fix the migration table
 * 3. Retries migrations after fixing
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zerodotemail';
const MIGRATIONS_FOLDER = path.join(__dirname, '../src/db/migrations');

// Known errors that indicate a migration is already applied
const ALREADY_EXISTS_ERRORS = [
  'already exists',
  'duplicate key value',
];

function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function getMigrationFiles(): Promise<{ name: string; hash: string; idx: number }[]> {
  const journalPath = path.join(MIGRATIONS_FOLDER, 'meta/_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

  return journal.entries.map((entry: { tag: string; idx: number }) => {
    const filePath = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    return {
      name: entry.tag,
      hash: fs.existsSync(filePath) ? computeFileHash(filePath) : '',
      idx: entry.idx,
    };
  });
}

async function fixMigrationTable(sql: postgres.Sql): Promise<void> {
  console.log('Attempting to fix migration table...');

  const migrations = await getMigrationFiles();
  const appliedMigrations = await sql`
    SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id
  `;

  for (const migration of migrations) {
    const applied = appliedMigrations.find((m: { id: number }) => m.id === migration.idx + 1);
    if (applied && applied.hash !== migration.hash) {
      console.log(`Updating hash for migration ${migration.idx + 1} (${migration.name})`);
      await sql`
        UPDATE drizzle.__drizzle_migrations
        SET hash = ${migration.hash}
        WHERE id = ${migration.idx + 1}
      `;
    }
  }
}

async function runMigrations(): Promise<void> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  console.log('Running database migrations...');
  console.log(`Migrations folder: ${MIGRATIONS_FOLDER}`);

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log('✓ Migrations completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isAlreadyExistsError = ALREADY_EXISTS_ERRORS.some(e =>
      errorMessage.toLowerCase().includes(e.toLowerCase())
    );

    if (isAlreadyExistsError) {
      console.log('Migration failed with "already exists" error. Attempting to fix...');

      try {
        await fixMigrationTable(sql);
        console.log('Migration table fixed. Retrying migrations...');

        // Create a new connection for retry
        const sql2 = postgres(DATABASE_URL, { max: 1 });
        const db2 = drizzle(sql2);

        await migrate(db2, { migrationsFolder: MIGRATIONS_FOLDER });
        console.log('✓ Migrations completed successfully after fix');

        await sql2.end();
      } catch (retryError) {
        console.error('Failed to fix migration table:', retryError);
        process.exit(1);
      }
    } else {
      console.error('Migration failed:', errorMessage);
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

runMigrations().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
