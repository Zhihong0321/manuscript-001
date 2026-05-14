const express = require('express');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.API_PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

// Stripe: live and demo keys (don't crash if missing/invalid)
let stripeLive = null;
let stripeDemo = null;
try { if (process.env.STRIPE_SECRET_KEY) stripeLive = new Stripe(process.env.STRIPE_SECRET_KEY); } catch(e) { console.error('[STRIPE] Live key error:', e.message); }
try { if (process.env.STRIPE_DEMO_KEY) stripeDemo = new Stripe(process.env.STRIPE_DEMO_KEY); } catch(e) { console.error('[STRIPE] Demo key error:', e.message); }

// Default mode: use demo if live key missing
let stripeMode = stripeLive ? 'live' : 'demo';
function getStripe() { return stripeMode === 'live' ? stripeLive : stripeDemo; }

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ganzhihong'}`,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Initialize database ─────────────────────────────────────────────────────
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS read_progress (
        id SERIAL PRIMARY KEY,
        browser_id VARCHAR(100) NOT NULL,
        chapter VARCHAR(100) NOT NULL,
        reached_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(browser_id, chapter)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        customer_email VARCHAR(255),
        mode VARCHAR(10) DEFAULT 'live',
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapters (
        id VARCHAR(50) PRIMARY KEY,
        sort_order INTEGER NOT NULL,
        chapter_num VARCHAR(10),
        part_group VARCHAR(100),
        page_num INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapter_content (
        id SERIAL PRIMARY KEY,
        chapter_id VARCHAR(50) NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        lang VARCHAR(10) NOT NULL,
        title VARCHAR(300) NOT NULL,
        subtitle VARCHAR(500),
        part_label VARCHAR(200),
        body_html TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(chapter_id, lang)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chapter_content_chapter_lang ON chapter_content(chapter_id, lang);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chapters_sort ON chapters(sort_order);`);
    console.log('[DB] all tables ready');
  } finally {
    client.release();
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const checks = {
    api: 'ok',
    db: 'unknown',
    stripe_mode: stripeMode,
    stripe_live: stripeLive ? 'key set' : 'no key',
    stripe_demo: stripeDemo ? 'key set' : 'no key',
    stripe_status: 'unknown',
    timestamp: new Date().toISOString()
  };

  try {
    await pool.query('SELECT 1');
    checks.db = 'connected';
  } catch (err) {
    checks.db = 'error: ' + err.message;
  }

  const s = getStripe();
  if (s) {
    try {
      const bal = await s.balance.retrieve();
      checks.stripe_status = 'connected (' + stripeMode + ', ' + (bal.available[0]?.currency || '?') + ')';
    } catch (err) {
      checks.stripe_status = 'error: ' + err.message;
    }
  } else {
    checks.stripe_status = 'no key for current mode';
  }

  res.json(checks);
});

// ─── Admin dashboard page (served from API so it always works) ───────────────
app.get('/admin', (req, res) => {
  res.sendFile('/usr/share/nginx/html/admin/health.html');
});

// ─── Public: Get table of contents (all chapters with metadata) ──────────────
app.get('/api/chapters', async (req, res) => {
  const lang = req.query.lang || 'zh';
  try {
    const result = await pool.query(`
      SELECT c.id, c.sort_order, c.chapter_num, c.part_group, c.page_num,
             cc.title, cc.subtitle, cc.part_label
      FROM chapters c
      LEFT JOIN chapter_content cc ON cc.chapter_id = c.id AND cc.lang = $1
      ORDER BY c.sort_order
    `, [lang]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: Get single chapter content ──────────────────────────────────────
app.get('/api/chapters/:id', async (req, res) => {
  const lang = req.query.lang || 'zh';
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT c.id, c.sort_order, c.chapter_num, c.part_group, c.page_num,
             cc.title, cc.subtitle, cc.part_label, cc.body_html
      FROM chapters c
      LEFT JOIN chapter_content cc ON cc.chapter_id = c.id AND cc.lang = $1
      WHERE c.id = $2
    `, [lang, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: Get available languages ─────────────────────────────────────────
app.get('/api/languages', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT lang FROM chapter_content ORDER BY lang');
    res.json(result.rows.map(r => r.lang));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Update chapter content ───────────────────────────────────────────
app.put('/api/admin/chapters/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { lang, title, subtitle, part_label, body_html } = req.body;
  if (!lang || !title || !body_html) {
    return res.status(400).json({ error: 'lang, title, and body_html are required' });
  }
  try {
    const result = await pool.query(`
      INSERT INTO chapter_content (chapter_id, lang, title, subtitle, part_label, body_html, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (chapter_id, lang) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        part_label = EXCLUDED.part_label,
        body_html = EXCLUDED.body_html,
        updated_at = NOW()
      RETURNING *
    `, [id, lang, title, subtitle || '', part_label || '', body_html]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Switch Stripe mode ───────────────────────────────────────────────
app.post('/api/admin/stripe-mode', requireAdmin, (req, res) => {
  const { mode } = req.body;
  if (mode === 'live' && stripeLive) { stripeMode = 'live'; return res.json({ mode: stripeMode }); }
  if (mode === 'demo' && stripeDemo) { stripeMode = 'demo'; return res.json({ mode: stripeMode }); }
  res.status(400).json({ error: 'Invalid mode or key not set', available: { live: !!stripeLive, demo: !!stripeDemo } });
});

// ─── Public: Reviews ─────────────────────────────────────────────────────────
app.get('/api/reviews', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, role_church, comment, created_at FROM reviews ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  const { name, role_church, comment, contact } = req.body;
  if (!comment || !comment.trim()) return res.status(400).json({ error: '评语不能为空' });
  try {
    const result = await pool.query(
      'INSERT INTO reviews (name, role_church, comment, contact) VALUES ($1, $2, $3, $4) RETURNING id, name, role_church, comment, created_at',
      [name?.trim().slice(0,100) || null, role_church?.trim().slice(0,150) || null, comment.trim(), contact?.trim().slice(0,150) || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: Reading progress ────────────────────────────────────────────────
app.post('/api/reading-progress', async (req, res) => {
  const { browser_id, chapter } = req.body;
  if (!browser_id || !chapter) return res.status(400).json({ error: 'Missing fields' });
  try {
    await pool.query('INSERT INTO read_progress (browser_id, chapter) VALUES ($1, $2) ON CONFLICT DO NOTHING', [browser_id, chapter]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stripe: Create checkout ─────────────────────────────────────────────────
app.post('/api/checkout', async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'Stripe not configured for mode: ' + stripeMode });

  const { amount, currency } = req.body;
  const cur = (currency || 'myr').toLowerCase();
  if (!['myr', 'usd'].includes(cur)) return res.status(400).json({ error: 'Invalid currency' });

  const amountNum = parseInt(amount, 10);
  if (!amountNum || amountNum < 100) return res.status(400).json({ error: 'Minimum RM1 / $1' });
  if (amountNum > 999900) return res.status(400).json({ error: 'Too large' });

  try {
    const session = await s.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: cur,
          product_data: { name: '支持这本书 · Support This Book', description: '《原来我们都在侍奉假神》— 颜志鸿' },
          unit_amount: amountNum,
        },
        quantity: 1,
      }],
      success_url: `${req.headers.origin || 'https://ganzhihong.com'}/?thanks=1`,
      cancel_url: `${req.headers.origin || 'https://ganzhihong.com'}/`,
    });

    // Record payment in DB
    await pool.query(
      'INSERT INTO payments (stripe_session_id, amount_cents, currency, status, mode) VALUES ($1, $2, $3, $4, $5)',
      [session.id, amountNum, cur, 'pending', stripeMode]
    );

    res.json({ url: session.url, session_id: session.id, mode: stripeMode });
  } catch (err) {
    res.status(500).json({ error: err.message, type: err.type, code: err.code });
  }
});

// ─── Stripe: Webhook to update payment status ────────────────────────────────
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Simple webhook - just update payment status
  try {
    const event = JSON.parse(req.body);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await pool.query(
        'UPDATE payments SET status = $1, customer_email = $2, completed_at = NOW() WHERE stripe_session_id = $3',
        ['completed', session.customer_details?.email || null, session.id]
      );
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─── Admin middleware ────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── Admin: Reviews ──────────────────────────────────────────────────────────
app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin: Payments ─────────────────────────────────────────────────────────
app.get('/api/admin/payments', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 100');
    const totals = await pool.query(`
      SELECT currency, mode, status, COUNT(*) as count, SUM(amount_cents) as total_cents
      FROM payments GROUP BY currency, mode, status ORDER BY currency, mode, status
    `);
    res.json({ payments: result.rows, summary: totals.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin: Sync payment statuses from Stripe ────────────────────────────────
app.post('/api/admin/payments/sync', requireAdmin, async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'No stripe key' });

  try {
    const pending = await pool.query("SELECT stripe_session_id FROM payments WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20");
    let updated = 0;
    for (const row of pending.rows) {
      try {
        const session = await s.checkout.sessions.retrieve(row.stripe_session_id);
        if (session.payment_status === 'paid') {
          await pool.query(
            'UPDATE payments SET status = $1, customer_email = $2, completed_at = NOW() WHERE stripe_session_id = $3',
            ['completed', session.customer_details?.email || null, row.stripe_session_id]
          );
          updated++;
        } else if (session.status === 'expired') {
          await pool.query("UPDATE payments SET status = 'expired' WHERE stripe_session_id = $1", [row.stripe_session_id]);
          updated++;
        }
      } catch (e) { /* skip individual errors */ }
    }
    res.json({ synced: updated, checked: pending.rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin: Reading analytics ────────────────────────────────────────────────
app.get('/api/admin/reading', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT chapter, COUNT(DISTINCT browser_id) as readers FROM read_progress GROUP BY chapter ORDER BY chapter');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ───────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API] Running on :${PORT} | Stripe mode: ${stripeMode}`);
  });
}).catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
