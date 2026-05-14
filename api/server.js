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
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ganzhihong',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
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
  } finally {
    client.release();
  }
}

// ─── Health check (verifies DB connection) ───────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[HEALTH]', err.message);
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
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
    console.error('[POST /api/checkout]', err.message);
    res.status(500).json({ error: 'Could not create checkout session' });
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
