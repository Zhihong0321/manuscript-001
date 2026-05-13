(() => {

  /* ───── language state ───── */
  let currentLang = localStorage.getItem('ebook-lang') || 'zh';

  /* ───── chapter data registry ───── */
  const chapters = [
    { id: 'preface', num: 'i', part: '引', title: '开场白', subtitle: '这本书最可怕的不是题目——是如果题目真的说中了。' },
    { id: 'opening', num: 'ii', part: '引', title: '开场：一个问题，一把钥匙', subtitle: '是谁给了我们权柄，去决定耶稣可以做什么、不可以做什么？' },
    { id: 'ch1', num: '01', part: '第一部 · 我们看见了什么', title: '教会正在发生什么', subtitle: '如果神没有失败，那为什么我们建造的东西正在倒塌？' },
    { id: 'ch2', num: '02', part: '第二部 · 诊断——敌人在哪里', title: '给敌人命名——假神', subtitle: '如果最危险的偶像，不是我们去信别神，而是理性告诉我们，我们有权审判神呢？' },
    { id: 'ch3', num: '03', part: '第二部 · 诊断——敌人在哪里', title: '这颗种子从哪里来——伊甸园', subtitle: '"神岂是真说……"——假神与原罪' },
    { id: 'ch4', num: '04', part: '第二部 · 诊断——敌人在哪里', title: '迷信之母', subtitle: '最深的迷信不是信得太盲目，而是太盲目相信自己。' },
    { id: 'ch5', num: '05', part: '第三部 · 连护教学都可能在服务假神', title: '假神穿上了学袍', subtitle: '当我们以为自己是在为神辩护时，我们到底在保护什么？' },
    { id: 'ch6', num: '06', part: '第四部（续） · 信心的真相', title: '有一种信，比不信还可怕', subtitle: '一个人相信神存在，却仍然不让神作主，这到底算什么信？' },
    { id: 'ch7', num: '07', part: '第四部（续） · 信心的真相', title: '苦难，祷告被拒绝，漫长等待', subtitle: '如果你用的不是耶稣牌心脏，你能面对多少次祷告被拒绝？' },
    { id: 'ch8', num: '08', part: '第四部（续） · 信心的真相', title: '器皿的自觉——我不主动，祂主动', subtitle: '当牧者不再替神操心，教会真的会塌吗？' },
    { id: 'ch9', num: '09', part: '第四部 · 原型——历史已经给过我们答案', title: '西奈山，人类第一间巨型教会', subtitle: '为什么人在真理面前，仍然会选择一头金牛犊？' },
    { id: 'extra', num: '·', part: '番外篇', title: '今晚就要你灵魂，你怎么办？', subtitle: '濒死体验研究与一个无法回避的结论' },
    { id: 'ch10', num: '10', part: '第五部 · 呼召——对教牧领袖说的话', title: '牧师，教会领袖们，我们也有一个假神', subtitle: '我们的假神叫做："我的会众"' },
    { id: 'ch11', num: '11', part: '第五部 · 呼召——对教牧领袖说的话', title: '不要害怕真理得罪人', subtitle: '当真理得罪人时，我们是在牧养人，还是在替真理道歉？' },
    { id: 'ch12', num: '12', part: '终章 · 建造', title: '由拆毁为起点的建造', subtitle: '如果不先打碎假神，我们到底在建造什么？' },
    { id: 'afterword', num: '·', part: '后记与附录', title: '后记：给读者的一句话', subtitle: '当所有论证结束之后，我还敢诚实回答：我到底在侍奉谁吗？' },
    { id: 'appendixA', num: '·', part: '附录', title: '合书之前，有人替你问了这些问题', subtitle: '' },
    { id: 'appendixB', num: '·', part: '附录', title: '第一章案例完整版', subtitle: '' },
    { id: 'sources', num: '·', part: '附录', title: '资料与来源', subtitle: '' },
  ];

  let currentChapterIdx = 2; // default to ch1

  /* ───── view routing ───── */
  const views = {
    cover:  document.getElementById('view-cover'),
    toc:    document.getElementById('view-toc'),
    reader: document.getElementById('view-reader'),
  };
  const progress = document.getElementById('progress');
  const crumb = document.querySelector('#view-reader .crumb');
  const readerArticle = document.querySelector('#view-reader .reader');

  function go(name, chapterId) {
    if (name === 'reader') {
      loadChapter(chapterId || chapters[currentChapterIdx].id);
    }
    Object.entries(views).forEach(([k, el]) => el.classList.toggle('is-active', k === name));
    document.body.dataset.current = name;
    progress.style.display = (name === 'reader') ? 'block' : 'none';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function loadChapter(chapterId) {
    const idx = chapters.findIndex(c => c.id === chapterId);
    if (idx === -1) return;
    currentChapterIdx = idx;
    const ch = chapters[idx];

    // Update crumb
    if (crumb) {
      const label = ch.num.match(/^\d+$/) ? '第' + ch.num.replace(/^0/,'') + '章' : ch.title;
      crumb.textContent = label + ' · ' + ch.title;
    }

    // Update TOC highlighting
    document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('is-current'));
    const tocItem = document.querySelector(`.toc-item[data-chapter="${chapterId}"]`);
    if (tocItem) tocItem.classList.add('is-current');

    // Check if chapter content exists in DOM (language-aware)
    const langPrefix = currentLang === 'en' ? 'content-en-' : 'content-';
    const chapterContent = document.getElementById(langPrefix + chapterId);
    
    // Build chapter header
    const header = `
      <header class="chapter-header">
        <div class="chapter-eyebrow">${ch.part}</div>
        <div class="chapter-num">${ch.num.match(/^\d+$/) ? 'Chapter ' + ch.num : ''}</div>
        <h1 class="chapter-title">${ch.title}</h1>
        <div class="chapter-rule"></div>
      </header>
    `;

    // Build nav
    const prevCh = idx > 0 ? chapters[idx - 1] : null;
    const nextCh = idx < chapters.length - 1 ? chapters[idx + 1] : null;
    const nav = `
      <nav class="chapter-nav" aria-label="章节导航">
        ${prevCh ? `<a class="prev" data-goto="reader" data-chapter="${prevCh.id}"><div class="nav-label">← 上 一 章</div><div class="nav-title">${prevCh.title}</div></a>` : `<a class="prev disabled"><div class="nav-label">← 上 一 章</div><div class="nav-title">—</div></a>`}
        ${nextCh ? `<a class="next" data-goto="reader" data-chapter="${nextCh.id}"><div class="nav-label">下 一 章 →</div><div class="nav-title">${nextCh.title}</div></a>` : `<a class="next disabled"><div class="nav-label">下 一 章 →</div><div class="nav-title">—</div></a>`}
      </nav>
    `;

    // If we have pre-rendered content for this chapter, use it
    if (chapterContent) {
      readerArticle.innerHTML = header + '<div class="prose">' + chapterContent.innerHTML + '<div class="signoff">章 · 终</div>' + nav + '</div>';
    } else {
      // Placeholder for chapters not yet populated
      const placeholder = `
        <div class="prose">
          <div class="opener">
            <div class="label">开 篇 提 问</div>
            <div class="q">${ch.subtitle || ''}</div>
          </div>
          <div class="callout">
            <span class="tag">编 辑 中</span>
            本章内容正在编排中。完整内容将在后续版本更新。
          </div>
          <div class="signoff">章 · 终</div>
          ${nav}
        </div>
      `;
      readerArticle.innerHTML = header + placeholder;
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-goto]');
    if (!t) return;
    e.preventDefault();
    const target = t.dataset.goto;
    const chapterId = t.dataset.chapter;
    if (views[target]) go(target, chapterId);
  });

  /* ───── reading progress ───── */
  const bar = document.getElementById('progressBar');
  function updateProgress() {
    if (document.body.dataset.current !== 'reader') return;
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? (h.scrollTop / max) * 100 : 0;
    bar.style.width = p + '%';
  }
  document.addEventListener('scroll', updateProgress, { passive: true });

  /* ───── settings drawer ───── */
  const drawer = document.getElementById('drawer');
  const scrim  = document.getElementById('scrim');
  const btn    = document.getElementById('btnSettings');
  function openDrawer()  { drawer.classList.add('is-open'); scrim.classList.add('is-open'); drawer.setAttribute('aria-hidden','false'); }
  function closeDrawer() { drawer.classList.remove('is-open'); scrim.classList.remove('is-open'); drawer.setAttribute('aria-hidden','true'); }
  btn.addEventListener('click', openDrawer);
  scrim.addEventListener('click', closeDrawer);

  /* close drawer on Escape key */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (drawer.classList.contains('is-open')) closeDrawer();
      if (document.getElementById('shareScrim').classList.contains('is-open')) {
        document.getElementById('shareScrim').classList.remove('is-open');
      }
    }
  });

  /* ───── share modal ───── */
  const shareScrim = document.getElementById('shareScrim');
  const shareClose = document.getElementById('shareClose');
  const shareBtn = document.getElementById('btnShare');
  const shareWaBtn = document.getElementById('shareWaBtn');

  function openShare() {
    closeDrawer();
    const url = window.location.href;
    const text = encodeURIComponent('推荐你读这本书：《原来我们都在侍奉假神》\n' + url);
    if (shareWaBtn) shareWaBtn.href = 'https://wa.me/?text=' + text;
    setTimeout(() => { shareScrim.classList.add('is-open'); }, 200);
  }
  function closeShare() { shareScrim.classList.remove('is-open'); }

  if (shareBtn) shareBtn.addEventListener('click', openShare);
  if (shareClose) shareClose.addEventListener('click', closeShare);
  if (shareScrim) shareScrim.addEventListener('click', (e) => {
    if (e.target === shareScrim) closeShare();
  });

  /* ───── font size ───── */
  document.getElementById('segFont').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#segFont button').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    document.documentElement.style.setProperty('--reader-fs', b.dataset.fs + 'px');
  });

  /* ───── line height ───── */
  document.getElementById('segLine').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#segLine button').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    document.documentElement.style.setProperty('--reader-lh', b.dataset.lh);
  });

  /* ───── theme ───── */
  document.getElementById('segTheme').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#segTheme button').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    const theme = b.dataset.theme;
    if (theme === 'night') document.documentElement.setAttribute('data-theme','night');
    else if (theme === 'day') document.documentElement.setAttribute('data-theme','day');
    else document.documentElement.removeAttribute('data-theme');
  });

  /* ───── language toggle ───── */

  document.getElementById('segLang').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#segLang button').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    currentLang = b.dataset.lang;
    localStorage.setItem('ebook-lang', currentLang);
    // Reload current chapter in new language
    loadChapter(chapters[currentChapterIdx].id);
  });

  // Restore saved language on load
  if (currentLang === 'en') {
    document.querySelectorAll('#segLang button').forEach(x => x.classList.remove('is-on'));
    document.querySelector('#segLang button[data-lang="en"]').classList.add('is-on');
  }

  /* day theme is in style.css */

  /* ───── keyboard navigation ───── */
  document.addEventListener('keydown', (e) => {
    if (document.body.dataset.current !== 'reader') return;
    if (e.key === 'ArrowLeft' && currentChapterIdx > 0) {
      go('reader', chapters[currentChapterIdx - 1].id);
    } else if (e.key === 'ArrowRight' && currentChapterIdx < chapters.length - 1) {
      go('reader', chapters[currentChapterIdx + 1].id);
    }
  });

  /* ───── scripture scroll reveal (torn paper appear effect) ───── */
  const verseObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  function observeVerses() {
    document.querySelectorAll('blockquote.verse:not(.is-visible)').forEach(el => {
      verseObserver.observe(el);
    });
  }

  // Re-observe after any content change in the reader
  const readerMO = new MutationObserver(() => {
    setTimeout(observeVerses, 30);
  });
  if (readerArticle) {
    readerMO.observe(readerArticle, { childList: true, subtree: true });
  }
  observeVerses();

})();
