/**
 * Migration: Add multi-book support
 *
 * Phase 1 of zero-downtime migration:
 * - Creates `books` table
 * - Adds nullable `book_id` to chapters, chapter_content, payments, reviews, read_progress
 * - Backfills all existing rows with book_id = 'fake-god'
 * - Makes book_id NOT NULL + adds FKs
 * - Adds unique index on (book_id, id) for chapters
 *
 * Safe to run on live DB — all changes are additive.
 * Old code that doesn't reference book_id continues to work.
 *
 * Run: node api/db/migrate-books.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:WZnCkFsqaiMpYjliaJcJzBLelEplpZJA@shinkansen.proxy.rlwy.net:24032/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── 1. Create books table ───
    console.log('[MIGRATE] Creating books table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS books (
        id VARCHAR(50) PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        title_zh VARCHAR(300) NOT NULL,
        title_en VARCHAR(300) NOT NULL,
        author_zh VARCHAR(200),
        author_en VARCHAR(200),
        is_published BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        cover_verse_zh TEXT,
        cover_verse_en TEXT,
        cover_verse_ref VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ─── 2. Insert current book ───
    console.log('[MIGRATE] Inserting fake-god book...');
    await client.query(`
      INSERT INTO books (id, slug, title_zh, title_en, author_zh, author_en, is_published, sort_order,
                         cover_verse_zh, cover_verse_en, cover_verse_ref)
      VALUES ('fake-god', 'fake-god',
              '原来我们都在侍奉假神', 'Are We Serving a Fake God?',
              '颜志鸿', 'Gan Zhi Hong',
              true, 0,
              '耶和华对摩西说：「你下山吧，因为你从埃及地领出来的百姓已经败坏了。」',
              'The LORD said to Moses: "Go down, because your people, whom you brought up out of Egypt, have become corrupt."',
              '出埃及记 32:7 / Exodus 32:7')
      ON CONFLICT (id) DO NOTHING;
    `);

    // ─── 3. Add nullable book_id columns ───
    const tables = ['chapters', 'chapter_content', 'payments', 'reviews', 'read_progress'];
    for (const table of tables) {
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'book_id'
      `, [table]);

      if (colCheck.rows.length === 0) {
        console.log(`[MIGRATE] Adding book_id to ${table}...`);
        await client.query(`ALTER TABLE ${table} ADD COLUMN book_id VARCHAR(50)`);
      } else {
        console.log(`[MIGRATE] book_id already exists on ${table}, skipping`);
      }
    }

    // ─── 4. Backfill ───
    console.log('[MIGRATE] Backfilling book_id = fake-god...');
    for (const table of tables) {
      const result = await client.query(`
        UPDATE ${table} SET book_id = 'fake-god' WHERE book_id IS NULL
      `);
      console.log(`[MIGRATE]   ${table}: ${result.rowCount} rows updated`);
    }

    // ─── 5. Make NOT NULL (only chapters + chapter_content) ───
    console.log('[MIGRATE] Setting NOT NULL constraints...');
    await client.query(`ALTER TABLE chapters ALTER COLUMN book_id SET NOT NULL`);
    await client.query(`ALTER TABLE chapter_content ALTER COLUMN book_id SET NOT NULL`);

    // ─── 6. Add foreign keys ───
    console.log('[MIGRATE] Adding foreign keys...');

    const fkCheck = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'chapters' AND constraint_type = 'FOREIGN KEY'
    `);
    const existingFks = fkCheck.rows.map(r => r.constraint_name);

    if (!existingFks.includes('fk_chapters_book')) {
      await client.query(`ALTER TABLE chapters ADD CONSTRAINT fk_chapters_book FOREIGN KEY (book_id) REFERENCES books(id)`);
    }
    if (!existingFks.includes('fk_cc_book')) {
      await client.query(`ALTER TABLE chapter_content ADD CONSTRAINT fk_cc_book FOREIGN KEY (book_id) REFERENCES books(id)`);
    }

    // ─── 7. Unique index on (book_id, id) for chapters ───
    console.log('[MIGRATE] Creating unique index on chapters(book_id, id)...');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id, id)
    `);

    // ─── 8. Index on book_id for other tables ───
    for (const table of ['chapter_content', 'payments', 'reviews', 'read_progress']) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${table}_book_id ON ${table}(book_id)
      `);
    }

    await client.query('COMMIT');
    console.log('[MIGRATE] ✓ Multi-book migration complete');

    // ─── Verify ───
    const bookCount = await client.query('SELECT count(*)::int as n FROM books');
    const chapterBookIds = await client.query('SELECT book_id, count(*)::int as n FROM chapters GROUP BY book_id');
    console.log(`[MIGRATE] Verification: ${bookCount.rows[0].n} books, chapters by book:`, chapterBookIds.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[MIGRATE] ✗ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
