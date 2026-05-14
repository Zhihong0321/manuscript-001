/**
 * Seed script: Extract all chapter content from index.html and insert into Postgres.
 * 
 * This reads the current ebook/index.html, parses out all <div id="content-*"> blocks,
 * and inserts them into the chapters + chapter_content tables.
 * 
 * Also seeds the two appendices from the markdown source (v8.1) since they were
 * never added to the HTML.
 * 
 * Run: node api/db/seed.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:WZnCkFsqaiMpYjliaJcJzBLelEplpZJA@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

// ─── Chapter metadata (language-independent structure) ───
const chaptersMeta = [
  { id: 'preface',    sort_order: 0,  chapter_num: 'i',  part_group: 'intro',     page_num: 1 },
  { id: 'opening',    sort_order: 1,  chapter_num: 'ii', part_group: 'intro',     page_num: 7 },
  { id: 'ch1',        sort_order: 2,  chapter_num: '01', part_group: 'part1',     page_num: 21 },
  { id: 'ch2',        sort_order: 3,  chapter_num: '02', part_group: 'part2',     page_num: 43 },
  { id: 'ch3',        sort_order: 4,  chapter_num: '03', part_group: 'part2',     page_num: 63 },
  { id: 'ch4',        sort_order: 5,  chapter_num: '04', part_group: 'part2',     page_num: 75 },
  { id: 'ch5',        sort_order: 6,  chapter_num: '05', part_group: 'part3',     page_num: 107 },
  { id: 'ch6',        sort_order: 7,  chapter_num: '06', part_group: 'part4a',    page_num: 135 },
  { id: 'ch7',        sort_order: 8,  chapter_num: '07', part_group: 'part4a',    page_num: 155 },
  { id: 'ch8',        sort_order: 9,  chapter_num: '08', part_group: 'part4a',    page_num: 177 },
  { id: 'ch9',        sort_order: 10, chapter_num: '09', part_group: 'part4b',    page_num: 193 },
  { id: 'extra',      sort_order: 11, chapter_num: '·',  part_group: 'bonus',     page_num: 195 },
  { id: 'ch10',       sort_order: 12, chapter_num: '10', part_group: 'part5',     page_num: 213 },
  { id: 'ch11',       sort_order: 13, chapter_num: '11', part_group: 'part5',     page_num: 229 },
  { id: 'ch12',       sort_order: 14, chapter_num: '12', part_group: 'final',     page_num: 247 },
  { id: 'afterword',  sort_order: 15, chapter_num: '·',  part_group: 'backmatter', page_num: 265 },
  { id: 'support',    sort_order: 16, chapter_num: '·',  part_group: 'backmatter', page_num: null },
  { id: 'ack',        sort_order: 17, chapter_num: '·',  part_group: 'backmatter', page_num: 269 },
  { id: 'appendixA',  sort_order: 18, chapter_num: '·',  part_group: 'appendix',  page_num: 271 },
  { id: 'appendixB',  sort_order: 19, chapter_num: '·',  part_group: 'appendix',  page_num: 285 },
  { id: 'sources',    sort_order: 20, chapter_num: '·',  part_group: 'appendix',  page_num: 301 },
];

// ─── Content metadata per language ───
const contentMeta = {
  zh: {
    preface:   { title: '开场白', subtitle: '这本书最可怕的不是题目——是如果题目真的说中了。', part_label: '引' },
    opening:   { title: '开场：一个问题，一把钥匙', subtitle: '是谁给了我们权柄，去决定耶稣可以做什么、不可以做什么？', part_label: '引' },
    ch1:       { title: '教会正在发生什么', subtitle: '如果神没有失败，那为什么我们建造的东西正在倒塌？', part_label: '第一部 · 我们看见了什么' },
    ch2:       { title: '给敌人命名——假神', subtitle: '如果最危险的偶像，不是我们去信别神，而是理性告诉我们，我们有权审判神呢？', part_label: '第二部 · 诊断——敌人在哪里' },
    ch3:       { title: '这颗种子从哪里来——伊甸园', subtitle: '"神岂是真说……"——假神与原罪', part_label: '第二部 · 诊断——敌人在哪里' },
    ch4:       { title: '迷信之母', subtitle: '最深的迷信不是信得太盲目，而是太盲目相信自己。', part_label: '第二部 · 诊断——敌人在哪里' },
    ch5:       { title: '假神穿上了学袍', subtitle: '当我们以为自己是在为神辩护时，我们到底在保护什么？', part_label: '第三部 · 连护教学都可能在服务假神' },
    ch6:       { title: '有一种信，比不信还可怕', subtitle: '一个人相信神存在，却仍然不让神作主，这到底算什么信？', part_label: '第四部（续） · 信心的真相' },
    ch7:       { title: '苦难，祷告被拒绝，漫长等待', subtitle: '如果你用的不是耶稣牌心脏，你能面对多少次祷告被拒绝？', part_label: '第四部（续） · 信心的真相' },
    ch8:       { title: '器皿的自觉——我不主动，祂主动', subtitle: '当牧者不再替神操心，教会真的会塌吗？', part_label: '第四部（续） · 信心的真相' },
    ch9:       { title: '西奈山，人类第一间巨型教会', subtitle: '为什么人在真理面前，仍然会选择一头金牛犊？', part_label: '第四部 · 原型——历史已经给过我们答案' },
    extra:     { title: '今晚就要你灵魂，你怎么办？', subtitle: '濒死体验研究与一个无法回避的结论', part_label: '番外篇' },
    ch10:      { title: '牧师，教会领袖们，我们也有一个假神', subtitle: '我们的假神叫做："我的会众"', part_label: '第五部 · 呼召——对教牧领袖说的话' },
    ch11:      { title: '不要害怕真理得罪人', subtitle: '当真理得罪人时，我们是在牧养人，还是在替真理道歉？', part_label: '第五部 · 呼召——对教牧领袖说的话' },
    ch12:      { title: '由拆毁为起点的建造', subtitle: '如果不先打碎假神，我们到底在建造什么？', part_label: '终章 · 建造' },
    afterword: { title: '后记：给读者的一句话', subtitle: '当所有论证结束之后，我还敢诚实回答：我到底在侍奉谁吗？', part_label: '后记' },
    support:   { title: '支持这本书', subtitle: '', part_label: '后记' },
    ack:       { title: '致　谢', subtitle: '', part_label: '致谢' },
    appendixA: { title: '合书之前，有人替你问了这些问题', subtitle: '', part_label: '附录' },
    appendixB: { title: '第一章案例完整版', subtitle: '', part_label: '附录' },
    sources:   { title: '资料与来源', subtitle: '', part_label: '附录' },
  },
  en: {
    preface:   { title: 'Preface', subtitle: 'The most terrifying thing about this book is not the title — it\'s if the title is right.', part_label: 'Preface' },
    opening:   { title: 'One Question. One Key.', subtitle: 'Who gave us the authority to decide what Jesus is allowed to do?', part_label: 'Opening' },
    ch1:       { title: 'What Is Happening to the Church', subtitle: 'If God has not failed, why is everything we\'ve built coming down?', part_label: 'Part I · What We See' },
    ch2:       { title: 'Naming the Enemy: The Fake God', subtitle: 'What if the most dangerous idol is our own reason telling us we can put God on trial?', part_label: 'Part II · Diagnosis' },
    ch3:       { title: 'Where Did This Seed Come From: The Garden', subtitle: '"Did God really say…" — The Fake God and original sin.', part_label: 'Part II · Diagnosis' },
    ch4:       { title: 'The Mother of All Superstition', subtitle: 'The deepest superstition is not blind belief in religion — but blind belief in yourself.', part_label: 'Part II · Diagnosis' },
    ch5:       { title: 'The Fake God Puts On Academic Robes', subtitle: 'When we think we are defending God, what exactly are we protecting?', part_label: 'Part III · Even Apologetics Can Serve the Fake God' },
    ch6:       { title: 'One Kind of Faith Worse Than No Faith', subtitle: 'A person can believe God exists and still refuse to let God be in charge.', part_label: 'Part IV · The Truth About Faith' },
    ch7:       { title: 'Suffering, Unanswered Prayer, the Long Wait', subtitle: 'If you\'re not running on a Jesus-model heart, how many times can you take no?', part_label: 'Part IV · The Truth About Faith' },
    ch8:       { title: 'The Vessel Knows Its Place', subtitle: 'If a pastor stops managing God\'s affairs, will the church actually fall?', part_label: 'Part IV · The Truth About Faith' },
    ch9:       { title: 'Sinai: Humanity\'s First Megachurch', subtitle: 'Why do people choose a golden calf when truth is right in front of them?', part_label: 'Part IV · The Pattern' },
    extra:     { title: 'Tonight Your Soul Is Required', subtitle: 'Near-death experience research and an unavoidable conclusion.', part_label: 'Bonus' },
    ch10:      { title: 'Pastors, We Also Have a Fake God', subtitle: 'Our Fake God is called: "my congregation."', part_label: 'Part V · A Call to Leaders' },
    ch11:      { title: 'Do Not Fear Truth Offending People', subtitle: 'When truth offends, are we shepherding — or apologizing for truth?', part_label: 'Part V · A Call to Leaders' },
    ch12:      { title: 'Building That Begins With Demolition', subtitle: 'If we don\'t first break the Fake God, what are we building?', part_label: 'Final · Building' },
    afterword: { title: 'Afterword: One Word to the Reader', subtitle: 'When all arguments end, do I dare honestly answer: who am I actually serving?', part_label: 'Afterword' },
    support:   { title: 'Support This Book', subtitle: '', part_label: 'Support' },
    ack:       { title: 'Acknowledgments', subtitle: '', part_label: 'Acknowledgments' },
    appendixA: { title: 'Questions Before You Close This Book', subtitle: '', part_label: 'Appendix' },
    appendixB: { title: 'Chapter 1 Case Studies (Full)', subtitle: '', part_label: 'Appendix' },
    sources:   { title: 'Sources & References', subtitle: '', part_label: 'Appendix' },
  }
};

/**
 * Extract innerHTML from <div id="content-{id}">...</div> blocks in the HTML file.
 * Returns a map: { 'preface': '<p>...</p>', 'en-preface': '<p>...</p>', ... }
 */
function extractContentBlocks(html) {
  const blocks = {};
  // Match <div id="content-XXXX"> ... </div> (greedy within reason)
  // We use a state machine approach since regex can't handle nested divs reliably
  const marker = '<div id="content-';
  let pos = 0;

  while (true) {
    const start = html.indexOf(marker, pos);
    if (start === -1) break;

    // Extract the ID
    const idStart = start + marker.length;
    const idEnd = html.indexOf('"', idStart);
    const id = html.substring(idStart, idEnd);

    // Find the closing tag by counting div depth
    const contentStart = html.indexOf('>', idEnd) + 1;
    let depth = 1;
    let i = contentStart;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          blocks[id] = html.substring(contentStart, nextClose).trim();
        }
        i = nextClose + 6;
      }
    }

    pos = i;
  }

  return blocks;
}

async function seed() {
  // Read the HTML file
  const htmlPath = path.join(__dirname, '..', '..', 'index.html');
  console.log('[SEED] Reading:', htmlPath);
  const html = fs.readFileSync(htmlPath, 'utf-8');

  // Extract all content blocks
  const blocks = extractContentBlocks(html);
  console.log(`[SEED] Extracted ${Object.keys(blocks).length} content blocks from HTML`);

  // Check for appendix content from markdown if not in HTML
  if (!blocks['appendixA'] || !blocks['appendixB']) {
    console.log('[SEED] Appendix content not found in HTML, will load from markdown...');
    await loadAppendicesFromMarkdown(blocks);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM chapter_content');
    await client.query('DELETE FROM chapters');

    // Insert chapters metadata
    for (const ch of chaptersMeta) {
      await client.query(
        'INSERT INTO chapters (id, sort_order, chapter_num, part_group, page_num) VALUES ($1, $2, $3, $4, $5)',
        [ch.id, ch.sort_order, ch.chapter_num, ch.part_group, ch.page_num]
      );
    }
    console.log(`[SEED] Inserted ${chaptersMeta.length} chapters`);

    // Insert content for each language
    let contentCount = 0;
    for (const ch of chaptersMeta) {
      // Chinese content
      const zhMeta = contentMeta.zh[ch.id];
      const zhBody = blocks[ch.id] || '<p class="placeholder">内容编排中。</p>';
      
      await client.query(
        `INSERT INTO chapter_content (chapter_id, lang, title, subtitle, part_label, body_html) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ch.id, 'zh', zhMeta.title, zhMeta.subtitle, zhMeta.part_label, zhBody]
      );
      contentCount++;

      // English content
      const enMeta = contentMeta.en[ch.id];
      const enBody = blocks['en-' + ch.id] || '<p class="placeholder">Content in progress.</p>';
      
      await client.query(
        `INSERT INTO chapter_content (chapter_id, lang, title, subtitle, part_label, body_html) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ch.id, 'en', enMeta.title, enMeta.subtitle, enMeta.part_label, enBody]
      );
      contentCount++;
    }

    await client.query('COMMIT');
    console.log(`[SEED] ✓ Inserted ${contentCount} content entries (${chaptersMeta.length} chapters × 2 languages)`);

    // Report any missing content
    const missing = [];
    for (const ch of chaptersMeta) {
      if (!blocks[ch.id]) missing.push(`zh:${ch.id}`);
      if (!blocks['en-' + ch.id]) missing.push(`en:${ch.id}`);
    }
    if (missing.length > 0) {
      console.log(`[SEED] ⚠ Missing HTML content (placeholder used): ${missing.join(', ')}`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SEED] ✗ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Load appendix content from the v8.1 markdown file and convert to basic HTML
 */
async function loadAppendicesFromMarkdown(blocks) {
  const mdPath = path.join(__dirname, '..', '..', '..', 'Are_We_Serving_Fake_God_v8.1.md');
  if (!fs.existsSync(mdPath)) {
    console.log('[SEED] Markdown file not found, skipping appendix extraction');
    return;
  }

  const md = fs.readFileSync(mdPath, 'utf-8');

  // Extract Appendix A: "合书之前，有人替你问了这些问题"
  const appAStart = md.indexOf('## 附录：合书之前，有人替你问了这些问题');
  const appBStart = md.indexOf('## 附录：第一章案例完整版——公开案例的前车之鉴');
  const sourcesStart = md.indexOf('## 资料与来源');

  if (appAStart !== -1 && !blocks['appendixA']) {
    const endPos = appBStart !== -1 ? appBStart : sourcesStart !== -1 ? sourcesStart : md.length;
    const appAMd = md.substring(appAStart, endPos).trim();
    blocks['appendixA'] = markdownToHtml(appAMd);
    console.log('[SEED] ✓ Loaded appendixA from markdown');
  }

  if (appBStart !== -1 && !blocks['appendixB']) {
    const endPos = sourcesStart !== -1 ? sourcesStart : md.length;
    const appBMd = md.substring(appBStart, endPos).trim();
    blocks['appendixB'] = markdownToHtml(appBMd);
    console.log('[SEED] ✓ Loaded appendixB from markdown');
  }
}

/**
 * Simple markdown → HTML converter (handles the patterns used in this book)
 */
function markdownToHtml(md) {
  let html = md
    // Remove the top-level ## heading (already in metadata)
    .replace(/^## .+\n+/, '')
    // H3 → section headers
    .replace(/^### (.+)$/gm, '<h3 class="section">$1</h3>')
    // H4 → sub headers
    .replace(/^#### (.+)$/gm, '<h4 class="sub">$1</h4>')
    // H5 → smaller headers
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Blockquotes (multi-line)
    .replace(/^> (.+)$/gm, '<blockquote-line>$1</blockquote-line>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr/>')
    // List items
    .replace(/^- (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive blockquote-lines
  html = html.replace(/((?:<blockquote-line>.+<\/blockquote-line>\n?)+)/g, (match) => {
    const inner = match.replace(/<\/?blockquote-line>/g, '').trim().split('\n').join('<br/>');
    return `<blockquote class="verse">${inner}</blockquote>`;
  });

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.+<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Wrap remaining plain text lines in <p>
  const lines = html.split('\n');
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('<')) {
      result.push(trimmed);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }

  return result.join('\n');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
