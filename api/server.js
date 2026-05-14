const express = require('express');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.API_PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ganzhihong'}`,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Initialize database table ───────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        role_church VARCHAR(150),
        comment TEXT NOT NULL,
        contact VARCHAR(150),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DB] reviews table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS read_progress (
        id SERIAL PRIMARY KEY,
        browser_id VARCHAR(100) NOT NULL,
        chapter VARCHAR(100) NOT NULL,
        reached_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(browser_id, chapter)
      );
    `);
    console.log('[DB] read_progress table ready');
  } finally {
    client.release();
  }
}

// ─── Health check (verifies DB connection) ───────────────────────────────────
app.get('/api/health', async (req, res) => {
  const checks = { api: 'ok', db: 'unknown', stripe: 'unknown', timestamp: new Date().toISOString() };
  
  // DB check
  try {
    await pool.query('SELECT 1');
    checks.db = 'connected';
  } catch (err) {
    checks.db = 'error: ' + err.message;
  }

  // Stripe check - just verify the key is valid
  try {
    const bal = await stripe.balance.retrieve();
    checks.stripe = 'connected (currency: ' + (bal.available[0]?.currency || 'unknown') + ')';
  } catch (err) {
    checks.stripe = 'error: ' + err.message;
  }

  const allOk = checks.db === 'connected' && checks.stripe.startsWith('connected');
  res.status(allOk ? 200 : 503).json(checks);
});

// ─── Public: Get all reviews (NEVER expose contact) ──────────────────────────
app.get('/api/reviews', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, role_church, comment, created_at FROM reviews ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/reviews]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Public: Submit a review ─────────────────────────────────────────────────
app.post('/api/reviews', async (req, res) => {
  const { name, role_church, comment, contact } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: '评语不能为空' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO reviews (name, role_church, comment, contact) VALUES ($1, $2, $3, $4) RETURNING id, name, role_church, comment, created_at',
      [
        name ? name.trim().slice(0, 100) : null,
        role_church ? role_church.trim().slice(0, 150) : null,
        comment.trim(),
        contact ? contact.trim().slice(0, 150) : null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/reviews]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Public: Record reading progress ─────────────────────────────────────────
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_CHAPTERS = [
  'opening', 'chapter_01', 'chapter_02', 'chapter_03', 'chapter_04',
  'chapter_05', 'chapter_06', 'chapter_07', 'chapter_08', 'chapter_09',
  'bonus', 'chapter_10', 'chapter_11', 'chapter_12', 'afterword', 'payment'
];

app.post('/api/reading-progress', async (req, res) => {
  const { browser_id, chapter } = req.body;

  if (!browser_id || !UUID_V4_RE.test(browser_id)) {
    return res.status(400).json({ error: 'Invalid browser_id' });
  }

  if (!chapter || !ALLOWED_CHAPTERS.includes(chapter)) {
    return res.status(400).json({ error: 'Invalid chapter' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO read_progress (browser_id, chapter) VALUES ($1, $2) ON CONFLICT (browser_id, chapter) DO NOTHING',
      [browser_id, chapter]
    );
    res.status(result.rowCount === 1 ? 201 : 200).json({ success: true });
  } catch (err) {
    console.error('[POST /api/reading-progress]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin middleware ────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Admin: Get all reviews INCLUDING contact ────────────────────────────────
app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, role_church, comment, contact, created_at FROM reviews ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/admin/reviews]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin: Delete a review ──────────────────────────────────────────────────
app.delete('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/admin/reviews]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin: Reading analytics funnel ─────────────────────────────────────────
app.get('/api/admin/reading', requireAdmin, async (req, res) => {
  const CHAPTER_ORDER = [
    'opening', 'chapter_01', 'chapter_02', 'chapter_03', 'chapter_04',
    'chapter_05', 'chapter_06', 'chapter_07', 'chapter_08', 'chapter_09',
    'bonus', 'chapter_10', 'chapter_11', 'chapter_12', 'afterword', 'payment'
  ];

  try {
    const result = await pool.query(
      'SELECT chapter, COUNT(DISTINCT browser_id) as readers FROM read_progress GROUP BY chapter'
    );

    // Build a map of chapter -> readers count
    const readerMap = {};
    for (const row of result.rows) {
      readerMap[row.chapter] = parseInt(row.readers, 10);
    }

    // Build response array in reading order
    const funnel = [];
    for (let i = 0; i < CHAPTER_ORDER.length; i++) {
      const chapter = CHAPTER_ORDER[i];
      const readers = readerMap[chapter] || 0;
      let dropoff = 0;
      let dropoff_pct = 0;

      if (i > 0) {
        const prevReaders = funnel[i - 1].readers;
        dropoff = prevReaders - readers;
        dropoff_pct = prevReaders > 0
          ? Math.round(((prevReaders - readers) / prevReaders) * 1000) / 10
          : 0;
      }

      funnel.push({ chapter, readers, dropoff, dropoff_pct, highlight: false });
    }

    // Calculate mean drop-off percentage (excluding first chapter which is always 0)
    const pcts = funnel.slice(1).map(f => f.dropoff_pct);
    const mean = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;

    // Mark highlights where drop-off % exceeds mean + 10
    for (let i = 1; i < funnel.length; i++) {
      if (funnel[i].dropoff_pct > mean + 10) {
        funnel[i].highlight = true;
      }
    }

    res.json(funnel);
  } catch (err) {
    console.error('[GET /api/admin/reading]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Stripe: Create checkout session ─────────────────────────────────────────
app.post('/api/checkout', async (req, res) => {
  const { amount, currency } = req.body;

  // Validate
  const validCurrencies = ['myr', 'usd'];
  const cur = (currency || 'myr').toLowerCase();
  if (!validCurrencies.includes(cur)) {
    return res.status(400).json({ error: 'Invalid currency. Use myr or usd.' });
  }

  const amountNum = parseInt(amount, 10);
  if (!amountNum || amountNum < 100) {
    // Stripe minimum is 100 cents = RM1 / $1
    return res.status(400).json({ error: 'Minimum amount is 1.00' });
  }

  if (amountNum > 999900) {
    return res.status(400).json({ error: 'Amount too large' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: cur,
          product_data: {
            name: '支持这本书 · Support This Book',
            description: '《原来我们都在侍奉假神》— 颜志鸿',
          },
          unit_amount: amountNum,
        },
        quantity: 1,
      }],
      success_url: `${req.headers.origin || 'https://ganzhihong.com'}/?thanks=1`,
      cancel_url: `${req.headers.origin || 'https://ganzhihong.com'}/`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[POST /api/checkout]', err.message, err.type, err.code);
    res.status(500).json({ error: 'Could not create checkout session', detail: err.message, type: err.type || null, code: err.code || null });
  }
});

// ─── Start server ────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API] Reviews server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('[FATAL] Could not initialize DB:', err.message);
  process.exit(1);
});
