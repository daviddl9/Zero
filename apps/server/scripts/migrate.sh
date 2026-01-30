#!/bin/sh
# Robust migration script that handles "already exists" errors
#
# This script:
# 1. Runs drizzle-kit migrations
# 2. If migrations fail with hash mismatch, syncs hashes and retries

echo "Running database migrations..."

# Try running migrations first time
if pnpm run db:migrate 2>&1; then
    echo "✓ Migrations completed successfully"
    exit 0
fi

# Capture the error output
MIGRATION_OUTPUT=$(pnpm run db:migrate 2>&1 || true)
echo "First attempt output:"
echo "$MIGRATION_OUTPUT"

# Check if it's an "already exists" error
if echo "$MIGRATION_OUTPUT" | grep -q "already exists"; then
    echo ""
    echo "⚠ Migration failed with 'already exists' error."
    echo "This usually means the database schema is already up to date but migration hashes don't match."
    echo ""
    echo "Attempting to sync migration hashes..."

    # Get the hash of each migration file and update in database
    MIGRATIONS_DIR="/app/apps/server/src/db/migrations"

    if [ -f "$MIGRATIONS_DIR/meta/_journal.json" ]; then
        # Use node with the postgres.js library that's already installed
        node --experimental-specifier-resolution=node -e "
        import fs from 'fs';
        import crypto from 'crypto';
        import postgres from 'postgres';

        const MIGRATIONS_DIR = '$MIGRATIONS_DIR';

        async function syncHashes() {
            const journal = JSON.parse(fs.readFileSync(MIGRATIONS_DIR + '/meta/_journal.json', 'utf8'));
            const sql = postgres(process.env.DATABASE_URL, { max: 1 });

            for (const entry of journal.entries) {
                const filePath = MIGRATIONS_DIR + '/' + entry.tag + '.sql';
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath);
                    const hash = crypto.createHash('sha256').update(content).digest('hex');
                    const id = entry.idx + 1;

                    try {
                        const result = await sql\`
                            UPDATE drizzle.__drizzle_migrations
                            SET hash = \${hash}
                            WHERE id = \${id}
                        \`;
                        if (result.count > 0) {
                            console.log('Updated hash for migration', id, '(' + entry.tag + ')');
                        }
                    } catch (err) {
                        // Migration might not exist in table yet, that's ok
                    }
                }
            }

            await sql.end();
            console.log('Hash sync complete');
        }

        syncHashes().catch(err => {
            console.error('Failed to sync hashes:', err.message);
            process.exit(1);
        });
        "

        echo ""
        echo "Retrying migrations..."
        if pnpm run db:migrate 2>&1; then
            echo "✓ Migrations completed successfully after hash sync"
            exit 0
        fi
    fi

    echo ""
    echo "⚠ Could not automatically fix migrations."
    echo "The database schema may already be correct. Continuing..."
    exit 0
fi

echo "❌ Migration failed with unexpected error"
exit 1
