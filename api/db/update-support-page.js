/**
 * Update support page: remove preset amount buttons, just show free input.
 * Run: node api/db/update-support-page.js
 */
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:WZnCkFsqaiMpYjliaJcJzBLelEplpZJA@shinkansen.proxy.rlwy.net:24032/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

const zhBody = `
<p class="pullquote">如果这本书曾触动你，<br/>你可以选择支持它继续走下去。</p>

<p style="text-align:center;font-size:14px;color:var(--ink-soft);line-height:1.9;">
把这本书分享给你认识的人——<br/>
<strong>转发这个网站链接，就是最大的支持。</strong>
</p>

<div class="support-share">
  <button class="support-share-btn" data-share="whatsapp">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.616l4.584-1.476A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.326-.724-6.022-1.95l-.422-.318-2.732.88.896-2.675-.348-.453A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
    WhatsApp
  </button>
  <button class="support-share-btn" data-share="telegram">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
    Telegram
  </button>
  <button class="support-share-btn" data-share="copy">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    复制链接
  </button>
</div>

<div class="support-divider"></div>

<p style="text-align:center;font-size:14px;color:var(--ink-soft);line-height:1.9;margin-bottom:8px;">
如果你愿意支持作者继续写作与出版，<br/>
任何金额都是一份鼓励。
</p>

<div class="support-form">
  <div class="support-currency">
    <button class="support-cur-btn is-on" data-cur="myr">MYR</button>
    <button class="support-cur-btn" data-cur="usd">USD</button>
  </div>
  <div class="support-custom">
    <input type="number" min="1" max="9999" placeholder="输入任意金额" value="" />
  </div>
  <button class="support-pay-btn">支持这本书</button>
  <p class="support-note">通过 Stripe 安全支付 · 无需注册</p>
</div>

<p style="text-align:center;font-size:13px;color:var(--ink-mute);line-height:1.8;margin-top:24px;">
任何疑问，可联系作者：<br/>
<a href="https://wa.me/601121000099" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-underline-offset:3px;">WhatsApp 601121000099</a>
</p>
`;

const enBody = `
<p class="pullquote">If this book has moved you,<br/>you can choose to help it reach further.</p>

<p style="text-align:center;font-size:14px;color:var(--ink-soft);line-height:1.9;">
Share this book with someone you know —<br/>
<strong>sharing this link is the greatest support.</strong>
</p>

<div class="support-share">
  <button class="support-share-btn" data-share="whatsapp">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.616l4.584-1.476A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.326-.724-6.022-1.95l-.422-.318-2.732.88.896-2.675-.348-.453A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
    WhatsApp
  </button>
  <button class="support-share-btn" data-share="telegram">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
    Telegram
  </button>
  <button class="support-share-btn" data-share="copy">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    Copy Link
  </button>
</div>

<div class="support-divider"></div>

<p style="text-align:center;font-size:14px;color:var(--ink-soft);line-height:1.9;margin-bottom:8px;">
If you'd like to support the author's continued writing,<br/>
any amount is an encouragement.
</p>

<div class="support-form">
  <div class="support-currency">
    <button class="support-cur-btn is-on" data-cur="myr">MYR</button>
    <button class="support-cur-btn" data-cur="usd">USD</button>
  </div>
  <div class="support-custom">
    <input type="number" min="1" max="9999" placeholder="Enter any amount" value="" />
  </div>
  <button class="support-pay-btn">Support This Book</button>
  <p class="support-note">Secure payment via Stripe · No registration needed</p>
</div>

<p style="text-align:center;font-size:13px;color:var(--ink-mute);line-height:1.8;margin-top:24px;">
Any questions? Contact the author:<br/>
<a href="https://wa.me/601121000099" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-underline-offset:3px;">WhatsApp 601121000099</a>
</p>
`;

async function run() {
  try {
    // Update Chinese support page
    const zhResult = await pool.query(
      `UPDATE chapter_content SET body_html = $1, updated_at = NOW() WHERE chapter_id = 'support' AND lang = 'zh'`,
      [zhBody.trim()]
    );
    console.log('[UPDATE] zh support page:', zhResult.rowCount, 'row(s) updated');

    // Update English support page
    const enResult = await pool.query(
      `UPDATE chapter_content SET body_html = $1, updated_at = NOW() WHERE chapter_id = 'support' AND lang = 'en'`,
      [enBody.trim()]
    );
    console.log('[UPDATE] en support page:', enResult.rowCount, 'row(s) updated');

    console.log('[DONE] Support page updated — no more preset amounts, just free input.');
  } catch (err) {
    console.error('[ERROR]', err.message);
  } finally {
    await pool.end();
  }
}

run();
