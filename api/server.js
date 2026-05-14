const express = require('express');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.API_PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

// Stripe: live and demo keys
const stripeLive = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const stripeDemo = process.env.STRIPE_DEMO_KEY ? new Stripe(process.env.STRIPE_DEMO_KEY) : null;

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
