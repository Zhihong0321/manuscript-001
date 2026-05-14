(() => {
  /* ───── state ───── */
  let currentLang = localStorage.getItem('ebook-lang') || 'zh';
  let chapters = []; // loaded from API
  let currentChapterIdx = 0;
  let chapterCache = {}; // cache fetched content: { 'zh:ch1': {...}, ... }

  /* ───── i18n (UI strings only — no book content here anymore) ───── */
  const i18n = {
    zh: {
      openBook: '翻 开 此 书', viewToc: '查 看 目 录', tocLabel: 'CONTENTS',
      tocTitle: '目　　录', prevChapter: '← 上 一 章', nextChapter: '下 一 章 →',
      signoff: '章 · 终', settingsTitle: '阅 读 设 置', fontSize: '字 号',
      lineHeight: '行 距', theme: '主 题', lang: '语 言',
      share: '分享此书', shareTitle: '版 权 声 明',
      shareBody1: '© 2026 颜志鸿 Gan Zhihong. All rights reserved.',
      shareBody2: '本书内容受版权法保护。未经作者书面授权，不得以任何形式复制、修改、翻译、商业使用或重新出版本书内容。',
      shareRule1: '联系作者：<a href="https://wa.me/601121000099" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-underline-offset:3px;">WhatsApp 601121000099</a>',
      shareRule2: '但如果你愿意把这本书分享给你认识的人——<strong>转发这个网站链接，欢迎。</strong>这是作者的心愿。',
      shareRule3: '', shareWa: '通过 WhatsApp 分享', shareContact: '反馈或联系作者：',
      coverVol: 'Volume One', coverAudience: ['写给教牧', '传道人', '教会领袖'],
      coverSubtitle: '一面镜子',
      coverTitle: ['原来我们', '都在<span class="accent">侍奉</span>', '假　神'],
      coverVerse: '<span class="ref">— 出埃及记 32:7</span>耶和华对摩西说：<br/>「你下山吧，因为你从埃及地<br/>领出来的百姓已经败坏了。」',
      coverYear: '初版　·　2026', backCover: '返回封面', backToc: '返回目录',
      tocCrumb: '目　录 · CONTENTS', editing: '编 辑 中',
      editingMsg: '本章内容正在编排中。完整内容将在后续版本更新。',
      loading: '加载中…',
    },
    en: {
      openBook: 'OPEN BOOK', viewToc: 'TABLE OF CONTENTS', tocLabel: 'CONTENTS',
      tocTitle: 'Contents', prevChapter: '← PREV', nextChapter: 'NEXT →',
      signoff: '— END —', settingsTitle: 'READING SETTINGS', fontSize: 'Size',
      lineHeight: 'Spacing', theme: 'Theme', lang: 'Lang',
      share: 'Share', shareTitle: 'COPYRIGHT',
      shareBody1: '© 2026 颜志鸿 Gan Zhihong. All rights reserved.',
      shareBody2: 'The content of this book is protected by copyright. No part may be reproduced, modified, translated, used commercially, or republished without written permission from the author.',
      shareRule1: 'Contact the author: <a href="https://wa.me/601121000099" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-underline-offset:3px;">WhatsApp 601121000099</a>',
      shareRule2: 'But if you want to share this book with someone you know — <strong>sharing this website link is welcome.</strong> That is the author\'s wish.',
      shareRule3: '', shareWa: 'Share via WhatsApp', shareContact: 'Feedback or contact author:',
      coverVol: 'Volume One', coverAudience: ['For pastors', 'preachers', 'church leaders'],
      coverSubtitle: 'A Mirror',
      coverTitle: ['Are We', 'Actually <span class="accent">Serving</span>', 'a Fake God?'],
      coverVerse: '<span class="ref">— Exodus 32:7</span>The LORD said to Moses:<br/>"Go down, because your people,<br/>whom you brought up out of Egypt,<br/>have become corrupt."',
      coverYear: 'First Edition · 2026', backCover: 'Back to cover', backToc: 'Back to contents',
      tocCrumb: 'CONTENTS', editing: 'IN PROGRESS',
      editingMsg: 'This chapter is being prepared. Full content will be available in a future update.',
      loading: 'Loading…',
    }
  };


  function t(key) { return (i18n[currentLang] || i18n.zh)[key] || (i18n.zh)[key] || key; }

  /* ───── API helpers ───── */
  const API_BASE = '/api';

  async function fetchChaptersList() {
    const res = await fetch(`${API_BASE}/chapters?lang=${currentLang}`);
    if (!res.ok) throw new Error('Failed to load chapters');
    return res.json();
  }

  async function fetchChapterContent(chapterId) {
    const cacheKey = `${currentLang}:${chapterId}`;
    if (chapterCache[cacheKey]) return chapterCache[cacheKey];
    const res = await fetch(`${API_BASE}/chapters/${chapterId}?lang=${currentLang}`);
    if (!res.ok) throw new Error('Failed to load chapter');
    const data = await res.json();
    chapterCache[cacheKey] = data;
    return data;
  }

  /* ───── DOM refs ───── */
  const views = {
    cover: document.getElementById('view-cover'),
    toc: document.getElementById('view-toc'),
    reader: document.getElementById('view-reader'),
  };
  const progress = document.getElementById('progress');
  const crumb = document.querySelector('#view-reader .crumb');
  const readerArticle = document.querySelector('#view-reader .reader');

  /* ───── view routing ───── */
  function go(name, chapterId) {
    if (name === 'reader') {
      loadChapter(chapterId || chapters[currentChapterIdx]?.id || 'preface');
    }
    Object.entries(views).forEach(([k, el]) => el.classList.toggle('is-active', k === name));
    document.body.dataset.current = name;
    progress.style.display = (name === 'reader') ? 'block' : 'none';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function loadChapter(chapterId) {
    const idx = chapters.findIndex(c => c.id === chapterId);
    if (idx === -1) return;
    currentChapterIdx = idx;
    const ch = chapters[idx];

    // Show loading state
    readerArticle.innerHTML = `<div class="prose"><p class="pullquote">${t('loading')}</p></div>`;

    // Update crumb
    if (crumb) {
      const label = ch.chapter_num && ch.chapter_num.match(/^\d+$/)
        ? (currentLang === 'en' ? 'Ch.' + ch.chapter_num.replace(/^0/,'') : '第' + ch.chapter_num.replace(/^0/,'') + '章')
        : ch.title;
      crumb.textContent = label + ' · ' + ch.title;
    }

    // Highlight TOC
    document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('is-current'));
    const tocItem = document.querySelector(`.toc-item[data-chapter="${chapterId}"]`);
    if (tocItem) tocItem.classList.add('is-current');

    // Fetch content from API
    try {
      const data = await fetchChapterContent(chapterId);
      renderChapter(data, idx);
    } catch (err) {
      console.error('[LOAD]', err);
      renderChapterPlaceholder(ch, idx);
    }
  }

  function renderChapter(data, idx) {
    const ch = chapters[idx];
    const header = `
      <header class="chapter-header">
        <div class="chapter-eyebrow">${data.part_label || ch.part_label || ''}</div>
        <div class="chapter-num">${ch.chapter_num && ch.chapter_num.match(/^\d+$/) ? 'Chapter ' + ch.chapter_num : ''}</div>
        <h1 class="chapter-title">${data.title || ch.title}</h1>
        <div class="chapter-rule"></div>
      </header>
    `;
    const nav = buildNav(idx);
    const body = data.body_html || `<p>${t('editingMsg')}</p>`;
    readerArticle.innerHTML = header + '<div class="prose">' + body + '<div class="signoff">' + t('signoff') + '</div>' + nav + '</div>';
  }

  function renderChapterPlaceholder(ch, idx) {
    const header = `
      <header class="chapter-header">
        <div class="chapter-eyebrow">${ch.part_label || ''}</div>
        <h1 class="chapter-title">${ch.title || ''}</h1>
        <div class="chapter-rule"></div>
      </header>
    `;
    const nav = buildNav(idx);
    readerArticle.innerHTML = header + `
      <div class="prose">
        <div class="callout"><span class="tag">${t('editing')}</span> ${t('editingMsg')}</div>
        <div class="signoff">${t('signoff')}</div>
        ${nav}
      </div>`;
  }

  function buildNav(idx) {
    const prevCh = idx > 0 ? chapters[idx - 1] : null;
    const nextCh = idx < chapters.length - 1 ? chapters[idx + 1] : null;
    return `
      <nav class="chapter-nav" aria-label="章节导航">
        ${prevCh ? `<a class="prev" data-goto="reader" data-chapter="${prevCh.id}"><div class="nav-label">${t('prevChapter')}</div><div class="nav-title">${prevCh.title}</div></a>` : `<a class="prev disabled"><div class="nav-label">${t('prevChapter')}</div><div class="nav-title">—</div></a>`}
        ${nextCh ? `<a class="next" data-goto="reader" data-chapter="${nextCh.id}"><div class="nav-label">${t('nextChapter')}</div><div class="nav-title">${nextCh.title}</div></a>` : `<a class="next disabled"><div class="nav-label">${t('nextChapter')}</div><div class="nav-title">—</div></a>`}
      </nav>`;
  }


  /* ───── TOC rendering (dynamic from API) ───── */
  function renderToc() {
    const tocList = document.querySelector('#view-toc .toc-body');
    if (!tocList) return;

    // Group chapters by part_group
    const groups = {};
    const groupOrder = [];
    for (const ch of chapters) {
      const g = ch.part_group || 'other';
      if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
      groups[g].push(ch);
    }

    // Part group display names
    const partNames = {
      zh: { intro: '引', part1: '第一部　我们看见了什么', part2: '第二部　诊断——敌人在哪里', part3: '第三部　连护教学都可能在服务假神', part4a: '第四部（续）　信心的真相', part4b: '第四部　原型——历史已经给过我们答案', bonus: '番外篇', part5: '第五部　呼召——对教牧领袖说的话', final: '终章　建造', backmatter: '后记与附录', appendix: '附录' },
      en: { intro: 'Preface', part1: 'Part I · What We See', part2: 'Part II · Diagnosis', part3: 'Part III · Apologetics & the Fake God', part4a: 'Part IV · The Truth About Faith', part4b: 'Part IV · The Pattern', bonus: 'Bonus', part5: 'Part V · A Call to Leaders', final: 'Final · Building', backmatter: 'Back Matter', appendix: 'Appendix' }
    };
    const pn = partNames[currentLang] || partNames.zh;

    let html = '';
    for (const g of groupOrder) {
      const label = pn[g] || g;
      html += `<div class="toc-part"><div class="toc-part-head"><span class="toc-part-title">${label}</span></div><ul class="toc-list">`;
      for (const ch of groups[g]) {
        html += `<li class="toc-item" data-goto="reader" data-chapter="${ch.id}">
          <div class="toc-row">
            <span class="toc-num">${ch.chapter_num || '·'}</span>
            <span class="toc-name">${ch.title}</span>
            ${ch.page_num ? `<span class="toc-page">${ch.page_num}</span>` : ''}
          </div>
          ${ch.subtitle ? `<div class="toc-sub">${ch.subtitle}</div>` : ''}
        </li>`;
      }
      html += '</ul></div>';
    }
    tocList.innerHTML = html;
  }

  /* ───── UI language update ───── */
  function updateUILanguage() {
    const coverOpen = document.querySelector('.cover-open span:first-child');
    const coverToc = document.querySelector('.cover-toc-link');
    if (coverOpen) coverOpen.textContent = t('openBook');
    if (coverToc) coverToc.textContent = t('viewToc');

    const coverSub = document.querySelector('.cover-subtitle');
    if (coverSub) coverSub.textContent = t('coverSubtitle');

    const eyebrowSpans = document.querySelectorAll('.cover-eyebrow > span:not(.dot)');
    const aud = t('coverAudience');
    if (eyebrowSpans.length >= 3) { eyebrowSpans[0].textContent = aud[0]; eyebrowSpans[1].textContent = aud[1]; eyebrowSpans[2].textContent = aud[2]; }

    const titleRows = document.querySelectorAll('.cover-title .row');
    const titleData = t('coverTitle');
    if (titleRows.length >= 3 && titleData) { titleRows[0].innerHTML = titleData[0]; titleRows[1].innerHTML = titleData[1]; titleRows[2].innerHTML = titleData[2]; }

    const coverVerse = document.querySelector('.cover-verse');
    if (coverVerse) coverVerse.innerHTML = t('coverVerse');

    const coverFoot = document.querySelector('.cover-foot span:first-child');
    if (coverFoot) coverFoot.textContent = t('coverYear');

    const tocCrumb = document.querySelector('#view-toc .crumb');
    if (tocCrumb) tocCrumb.textContent = t('tocCrumb');

    const tocTitle = document.querySelector('.toc-head .title');
    if (tocTitle) tocTitle.textContent = t('tocTitle');

    const drawerTitle = document.querySelector('#drawer h6');
    if (drawerTitle) drawerTitle.textContent = t('settingsTitle');

    const labels = document.querySelectorAll('#drawer .row > .label');
    const labelKeys = ['fontSize', 'lineHeight', 'theme', 'lang'];
    labels.forEach((el, i) => { if (labelKeys[i]) el.textContent = t(labelKeys[i]); });

    const shareBtn = document.getElementById('drawerSupportLink');
    if (shareBtn) shareBtn.lastChild.textContent = ' ' + (currentLang === 'en' ? 'Want to support this book?' : '想支持这本书？');

    const shareTitle = document.querySelector('#shareModal h6');
    if (shareTitle) shareTitle.textContent = t('shareTitle');
    const shareBodies = document.querySelectorAll('#shareModal .gate-body');
    if (shareBodies[0]) shareBodies[0].innerHTML = t('shareBody1');
    if (shareBodies[1]) shareBodies[1].innerHTML = t('shareBody2');
    const shareRules = document.querySelectorAll('#shareModal .share-rules li');
    if (shareRules[0]) shareRules[0].innerHTML = t('shareRule1');
    if (shareRules[1]) shareRules[1].innerHTML = t('shareRule2');
    if (shareRules[2]) { shareRules[2].innerHTML = t('shareRule3'); shareRules[2].style.display = t('shareRule3') ? '' : 'none'; }

    document.documentElement.lang = currentLang === 'en' ? 'en' : 'zh-Hans';
  }


  /* ───── Event delegation: navigation clicks ───── */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-goto]');
    if (!el) return;
    e.preventDefault();
    const target = el.dataset.goto;
    const chapterId = el.dataset.chapter;
    if (views[target]) go(target, chapterId);
  });

  /* ───── Reading progress bar ───── */
  const bar = document.getElementById('progressBar');
  function updateProgress() {
    if (document.body.dataset.current !== 'reader') return;
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? (h.scrollTop / max) * 100 : 0;
    bar.style.width = p + '%';
  }
  document.addEventListener('scroll', updateProgress, { passive: true });

  /* ───── Settings drawer ───── */
  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('scrim');
  const btn = document.getElementById('btnSettings');
  function openDrawer() { drawer.classList.add('is-open'); scrim.classList.add('is-open'); drawer.setAttribute('aria-hidden','false'); }
  function closeDrawer() { drawer.classList.remove('is-open'); scrim.classList.remove('is-open'); drawer.setAttribute('aria-hidden','true'); }
  btn.addEventListener('click', openDrawer);
  scrim.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (drawer.classList.contains('is-open')) closeDrawer();
      const shareScrim = document.getElementById('shareScrim');
      if (shareScrim && shareScrim.classList.contains('is-open')) shareScrim.classList.remove('is-open');
    }
  });

  /* ───── Share/copyright modal ───── */
  const shareScrim = document.getElementById('shareScrim');
  const shareClose = document.getElementById('shareClose');
  const shareWaBtn = document.getElementById('shareWaBtn');

  function openShare() {
    closeDrawer();
    const url = window.location.href;
    const text = encodeURIComponent('推荐你读这本书：《原来我们都在侍奉假神》\n' + url);
    if (shareWaBtn) shareWaBtn.href = 'https://wa.me/?text=' + text;
    setTimeout(() => { if (shareScrim) shareScrim.classList.add('is-open'); }, 200);
  }
  function closeShare() { if (shareScrim) shareScrim.classList.remove('is-open'); }
  if (shareClose) shareClose.addEventListener('click', closeShare);
  if (shareScrim) shareScrim.addEventListener('click', (e) => { if (e.target === shareScrim) closeShare(); });

  /* ───── Font size ───── */
  const segFont = document.getElementById('segFont');
  if (segFont) segFont.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    segFont.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    document.documentElement.style.setProperty('--reader-fs', b.dataset.fs + 'px');
  });

  /* ───── Line height ───── */
  const segLine = document.getElementById('segLine');
  if (segLine) segLine.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    segLine.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    document.documentElement.style.setProperty('--reader-lh', b.dataset.lh);
  });

  /* ───── Theme ───── */
  const segTheme = document.getElementById('segTheme');
  if (segTheme) segTheme.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    segTheme.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    const theme = b.dataset.theme;
    if (theme === 'night') document.documentElement.setAttribute('data-theme','night');
    else if (theme === 'day') document.documentElement.setAttribute('data-theme','day');
    else document.documentElement.removeAttribute('data-theme');
  });

  /* ───── Language toggle ───── */
  const segLang = document.getElementById('segLang');
  const fontSizes = { zh: [15, 17, 19, 22], en: [16, 18, 20, 23] };

  function updateFontButtons() {
    if (!segFont) return;
    const sizes = fontSizes[currentLang] || fontSizes.zh;
    const buttons = segFont.querySelectorAll('button');
    buttons.forEach((btn, i) => { if (sizes[i]) btn.dataset.fs = sizes[i]; });
    const activeBtn = segFont.querySelector('button.is-on');
    if (activeBtn) document.documentElement.style.setProperty('--reader-fs', activeBtn.dataset.fs + 'px');
  }

  async function switchLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('ebook-lang', currentLang);
    chapterCache = {}; // clear cache on language switch
    // Reload chapters list from API
    try {
      chapters = await fetchChaptersList();
      renderToc();
    } catch (e) { console.error('[LANG SWITCH]', e); }
    updateCoverLangSwap();
    updateUILanguage();
    updateFontButtons();
    if (document.body.dataset.current === 'reader') {
      loadChapter(chapters[currentChapterIdx]?.id || 'preface');
    }
  }

  if (segLang) {
    segLang.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      segLang.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
      b.classList.add('is-on');
      switchLanguage(b.dataset.lang);
    });
  }

  /* ───── Cover language swap button ───── */
  const coverLangSwap = document.getElementById('coverLangSwap');
  function updateCoverLangSwap() {
    if (!coverLangSwap) return;
    const zhSpan = coverLangSwap.querySelector('.lang-zh');
    const enSpan = coverLangSwap.querySelector('.lang-en');
    if (zhSpan) zhSpan.dataset.active = currentLang === 'zh' ? 'true' : 'false';
    if (enSpan) enSpan.dataset.active = currentLang === 'en' ? 'true' : 'false';
  }
  if (coverLangSwap) {
    coverLangSwap.addEventListener('click', () => {
      const newLang = currentLang === 'zh' ? 'en' : 'zh';
      if (segLang) {
        segLang.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
        const btn = segLang.querySelector('button[data-lang="' + newLang + '"]');
        if (btn) btn.classList.add('is-on');
      }
      switchLanguage(newLang);
    });
    updateCoverLangSwap();
  }


  /* ───── Keyboard navigation ───── */
  document.addEventListener('keydown', (e) => {
    if (document.body.dataset.current !== 'reader') return;
    if (e.key === 'ArrowLeft' && currentChapterIdx > 0) {
      go('reader', chapters[currentChapterIdx - 1].id);
    } else if (e.key === 'ArrowRight' && currentChapterIdx < chapters.length - 1) {
      go('reader', chapters[currentChapterIdx + 1].id);
    }
  });

  /* ───── Scripture scroll reveal ───── */
  const verseObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('is-visible'); });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  function observeVerses() {
    document.querySelectorAll('blockquote.verse:not(.is-visible)').forEach(el => verseObserver.observe(el));
  }
  if (readerArticle) {
    new MutationObserver(() => setTimeout(observeVerses, 30)).observe(readerArticle, { childList: true, subtree: true });
  }
  observeVerses();

  /* ───── Support page: sharing ───── */
  const SITE_URL = window.location.origin + window.location.pathname;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-share]');
    if (!btn) return;
    e.preventDefault();
    const type = btn.dataset.share;
    const text = currentLang === 'en' ? 'I recommend this book: "All This Time, We\'ve Been Serving a Fake God"\n' : '推荐你读这本书：《原来我们都在侍奉假神》\n';
    const url = SITE_URL;
    if (type === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent(text + url), '_blank');
    else if (type === 'telegram') window.open('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank');
    else if (type === 'copy') {
      navigator.clipboard.writeText(url).then(() => {
        btn.textContent = currentLang === 'en' ? '✓ Copied' : '✓ 已复制';
        setTimeout(() => { btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ' + (currentLang === 'en' ? 'Copy Link' : '复制链接'); }, 2000);
      });
    }
  });

  /* ───── Support form: currency + amount ───── */
  document.addEventListener('click', (e) => {
    const curBtn = e.target.closest('.support-cur-btn');
    if (curBtn) { curBtn.closest('.support-currency').querySelectorAll('.support-cur-btn').forEach(b => b.classList.remove('is-on')); curBtn.classList.add('is-on'); return; }
    const amtBtn = e.target.closest('.support-amt-btn');
    if (amtBtn) { amtBtn.closest('.support-amounts').querySelectorAll('.support-amt-btn').forEach(b => b.classList.remove('is-on')); amtBtn.classList.add('is-on'); const input = amtBtn.closest('.support-form').querySelector('input[type="number"]'); if (input) input.value = amtBtn.dataset.amt; return; }
  });

  /* ───── Stripe checkout ───── */
  document.addEventListener('click', async (e) => {
    const payBtn = e.target.closest('.support-pay-btn');
    if (!payBtn) return;
    e.preventDefault();
    const form = payBtn.closest('.support-form');
    const input = form.querySelector('input[type="number"]');
    const curBtn = form.querySelector('.support-cur-btn.is-on');
    const amount = parseInt(input.value, 10);
    const currency = curBtn ? curBtn.dataset.cur : 'myr';
    if (!amount || amount < 1) { input.style.borderColor = 'var(--accent)'; return; }
    payBtn.disabled = true; payBtn.textContent = '...';
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amount * 100, currency }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || 'Unknown error');
    } catch (err) {
      console.error('[Checkout]', err);
      payBtn.textContent = currentLang === 'en' ? 'Error — try again' : '出错了，请重试';
      payBtn.disabled = false;
      setTimeout(() => { payBtn.textContent = currentLang === 'en' ? 'Support This Book' : '支持这本书'; }, 3000);
    }
  });

  /* ───── Drawer support link ───── */
  const drawerSupportLink = document.getElementById('drawerSupportLink');
  if (drawerSupportLink) {
    drawerSupportLink.addEventListener('click', (e) => {
      e.preventDefault(); closeDrawer();
      setTimeout(() => go('reader', 'support'), 200);
    });
  }

  /* ───── Init: load chapters from API then render ───── */
  async function init() {
    try {
      chapters = await fetchChaptersList();
      renderToc();
      updateUILanguage();
      updateFontButtons();
      // Restore language if saved as EN
      if (currentLang === 'en') {
        if (segLang) {
          segLang.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
          const enBtn = segLang.querySelector('button[data-lang="en"]');
          if (enBtn) enBtn.classList.add('is-on');
        }
        updateCoverLangSwap();
        updateUILanguage();
      }
    } catch (err) {
      console.error('[INIT] Failed to load chapters from API:', err);
      // Fallback: show error in TOC area
      const tocBody = document.querySelector('#view-toc .toc-body');
      if (tocBody) tocBody.innerHTML = '<p style="padding:2rem;color:var(--accent);">无法加载内容。请稍后再试。</p>';
    }
  }

  init();

})();



/* ═══════════════════════════════════════════════════════════════════════════
   REVIEWS MODULE
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  const form = document.getElementById('reviewForm');
  const list = document.getElementById('reviewsList');
  const successMsg = document.getElementById('formSuccess');
  const submitBtn = document.getElementById('reviewSubmitBtn');

  if (!form || !list) return;

  loadReviews();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const comment = document.getElementById('reviewComment').value.trim();
    if (!comment) return;
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
    const payload = {
      name: document.getElementById('reviewName').value.trim() || null,
      role_church: document.getElementById('reviewRole').value.trim() || null,
      comment: comment,
      contact: document.getElementById('reviewContact').value.trim() || null,
    };
    try {
      const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        form.reset();
        successMsg.style.display = 'block';
        setTimeout(() => { successMsg.style.display = 'none'; }, 4000);
        loadReviews();
      } else { throw new Error('Submit failed'); }
    } catch (err) {
      console.error('[REVIEW]', err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '提交回应';
    }
  });

  async function loadReviews() {
    try {
      const res = await fetch('/api/reviews');
      const reviews = await res.json();
      if (!reviews.length) { list.innerHTML = '<p class="reviews-empty">暂无回应。</p>'; return; }
      list.innerHTML = reviews.map(r => `
        <div class="review-card">
          <div class="review-meta">${r.name || '匿名'} ${r.role_church ? '· ' + r.role_church : ''}</div>
          <div class="review-body">${escapeHtml(r.comment)}</div>
          <div class="review-date">${new Date(r.created_at).toLocaleDateString('zh-CN')}</div>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = '<p class="reviews-empty">加载失败。</p>';
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
