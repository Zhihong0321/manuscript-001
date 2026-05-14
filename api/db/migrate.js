/**
 * Database migration: Create chapters + chapter_content tables
 * 
 * Schema design:
 * - `chapters` holds structural/metadata (order, id, part grouping)
 * - `chapter_content` holds the actual text per language (1 chapter → N languages)
 * - This allows adding new languages without touching the chapters table
 * 
 * Run: node api/db/migrate.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:WZnCkFsqaiMpYjliaJcJzBLelEplpZJA@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── chapters: structural metadata (language-independent) ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapters (
        id VARCHAR(50) PRIMARY KEY,          -- e.g. 'preface', 'ch1', 'appendixA'
        sort_order INTEGER NOT NULL,          -- display order (0-based)
        chapter_num VARCHAR(10),              -- display number: '01', '02', '·', 'i', 'ii'
        part_group VARCHAR(100),              -- grouping label (used for TOC sections)
        page_num INTEGER,                     -- approximate page number for TOC display
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ─── chapter_content: per-language content ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapter_content (
        id SERIAL PRIMARY KEY,
        chapter_id VARCHAR(50) NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        lang VARCHAR(10) NOT NULL,            -- 'zh', 'en', future: 'ms', 'id', etc.
        title VARCHAR(300) NOT NULL,          -- chapter title in this language
        subtitle VARCHAR(500),                -- subtitle / opening question
        part_label VARCHAR(200),              -- part label in this language (e.g. '第一部 · 我们看见了什么')
        body_html TEXT NOT NULL,              -- the actual chapter content as HTML
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(chapter_id, lang)
      );
    `);

    // ─── indexes ───
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chapter_content_lang ON chapter_content(lang);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chapter_content_chapter_lang ON chapter_content(chapter_id, lang);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chapters_sort ON chapters(sort_order);
    `);

    await client.query('COMMIT');
    console.log('[MIGRATE] ✓ chapters + chapter_content tables created');
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
