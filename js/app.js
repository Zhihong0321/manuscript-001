(() => {

  /* ───── language state ───── */
  let currentLang = localStorage.getItem('ebook-lang') || 'zh';

  /* ───── i18n translations ───── */
  const i18n = {
    zh: {
      openBook: '翻 开 此 书',
      viewToc: '查 看 目 录',
      tocLabel: 'CONTENTS',
      tocTitle: '目　　录',
      prevChapter: '← 上 一 章',
      nextChapter: '下 一 章 →',
      signoff: '章 · 终',
      settingsTitle: '阅 读 设 置',
      fontSize: '字 号',
      lineHeight: '行 距',
      theme: '主 题',
      lang: '语 言',
      share: '分享此书',
      shareTitle: '分 享 守 则',
      shareBody1: '这份手稿的目的是帮助教会，欢迎你分享给身边有需要的肢体。',
      shareBody2: '唯一的请求——<strong>请勿公开发布</strong>。公开此手稿将影响未来出版的可能性。',
      shareRule1: '<strong>欢迎分享：</strong>请直接把链接转发给有需要的人。',
      shareRule2: '<strong>请勿公开：</strong>请勿发布在社交媒体、博客或任何公共论坛。',
      shareRule3: '<strong>引述限制：</strong>正式引用请先获得作者书面确认。',
      shareWa: '通过 WhatsApp 分享',
      shareContact: '反馈或联系作者：',
      coverVol: 'Volume One',
      coverAudience: ['写给教牧', '传道人', '教会领袖'],
      coverSubtitle: '一面镜子',
      coverYear: '初版　·　2026',
      backCover: '返回封面',
      backToc: '返回目录',
      tocCrumb: '目　录 · CONTENTS',
      editing: '编 辑 中',
      editingMsg: '本章内容正在编排中。完整内容将在后续版本更新。',
    },
    en: {
      openBook: 'OPEN BOOK',
      viewToc: 'TABLE OF CONTENTS',
      tocLabel: 'CONTENTS',
      tocTitle: 'Contents',
      prevChapter: '← PREV',
      nextChapter: 'NEXT →',
      signoff: '— END —',
      settingsTitle: 'READING SETTINGS',
      fontSize: 'Size',
      lineHeight: 'Spacing',
      theme: 'Theme',
      lang: 'Lang',
      share: 'Share',
      shareTitle: 'SHARING GUIDELINES',
      shareBody1: 'This manuscript is meant to help the church. You are welcome to share it with those who need it.',
      shareBody2: 'One request — <strong>please do not publish publicly</strong>. Public release will affect future publication.',
      shareRule1: '<strong>Share freely:</strong> Send this link directly to anyone who needs it.',
      shareRule2: '<strong>Do not publish:</strong> Do not post on social media, blogs, or public forums.',
      shareRule3: '<strong>Citation:</strong> Please get written confirmation before quoting formally.',
      shareWa: 'Share via WhatsApp',
      shareContact: 'Feedback or contact author:',
      coverVol: 'Volume One',
      coverAudience: ['For pastors', 'preachers', 'church leaders'],
      coverSubtitle: 'A Mirror',
      coverYear: 'First Edition · 2026',
      backCover: 'Back to cover',
      backToc: 'Back to contents',
      tocCrumb: 'CONTENTS',
      editing: 'IN PROGRESS',
      editingMsg: 'This chapter is being prepared. Full content will be available in a future update.',
    }
  };

  /* ───── bilingual chapter data ───── */
  const chaptersData = {
    zh: [
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
      { id: 'afterword', num: '·', part: '后记', title: '后记：给读者的一句话', subtitle: '当所有论证结束之后，我还敢诚实回答：我到底在侍奉谁吗？' },
      { id: 'appendixA', num: '·', part: '附录', title: '合书之前，有人替你问了这些问题', subtitle: '' },
      { id: 'appendixB', num: '·', part: '附录', title: '第一章案例完整版', subtitle: '' },
      { id: 'sources', num: '·', part: '附录', title: '资料与来源', subtitle: '' },
    ],
    en: [
      { id: 'preface', num: 'i', part: 'Preface', title: 'Preface', subtitle: 'The most terrifying thing about this book is not the title — it\'s if the title is right.' },
      { id: 'opening', num: 'ii', part: 'Opening', title: 'One Question. One Key.', subtitle: 'Who gave us the authority to decide what Jesus is allowed to do?' },
      { id: 'ch1', num: '01', part: 'Part I · What We See', title: 'What Is Happening to the Church', subtitle: 'If God has not failed, why is everything we\'ve built coming down?' },
      { id: 'ch2', num: '02', part: 'Part II · Diagnosis', title: 'Naming the Enemy: The Fake God', subtitle: 'What if the most dangerous idol is our own reason telling us we can put God on trial?' },
      { id: 'ch3', num: '03', part: 'Part II · Diagnosis', title: 'Where Did This Seed Come From: The Garden', subtitle: '"Did God really say…" — The Fake God and original sin.' },
      { id: 'ch4', num: '04', part: 'Part II · Diagnosis', title: 'The Mother of All Superstition', subtitle: 'The deepest superstition is not blind belief in religion — but blind belief in yourself.' },
      { id: 'ch5', num: '05', part: 'Part III · Even Apologetics Can Serve the Fake God', title: 'The Fake God Puts On Academic Robes', subtitle: 'When we think we are defending God, what exactly are we protecting?' },
      { id: 'ch6', num: '06', part: 'Part IV · The Truth About Faith', title: 'One Kind of Faith Worse Than No Faith', subtitle: 'A person can believe God exists and still refuse to let God be in charge.' },
      { id: 'ch7', num: '07', part: 'Part IV · The Truth About Faith', title: 'Suffering, Unanswered Prayer, the Long Wait', subtitle: 'If you\'re not running on a Jesus-model heart, how many times can you take no?' },
      { id: 'ch8', num: '08', part: 'Part IV · The Truth About Faith', title: 'The Vessel Knows Its Place', subtitle: 'If a pastor stops managing God\'s affairs, will the church actually fall?' },
      { id: 'ch9', num: '09', part: 'Part IV · The Pattern', title: 'Sinai: Humanity\'s First Megachurch', subtitle: 'Why do people choose a golden calf when truth is right in front of them?' },
      { id: 'extra', num: '·', part: 'Bonus', title: 'Tonight Your Soul Is Required', subtitle: 'Near-death experience research and an unavoidable conclusion.' },
      { id: 'ch10', num: '10', part: 'Part V · A Call to Leaders', title: 'Pastors, We Also Have a Fake God', subtitle: 'Our Fake God is called: "my congregation."' },
      { id: 'ch11', num: '11', part: 'Part V · A Call to Leaders', title: 'Do Not Fear Truth Offending People', subtitle: 'When truth offends, are we shepherding — or apologizing for truth?' },
      { id: 'ch12', num: '12', part: 'Final · Building', title: 'Building That Begins With Demolition', subtitle: 'If we don\'t first shatter the Fake God, what exactly are we building?' },
      { id: 'afterword', num: '·', part: 'Afterword', title: 'Afterword: One Word to the Reader', subtitle: 'When all arguments end, do I dare honestly answer: who am I really serving?' },
      { id: 'appendixA', num: '·', part: 'Appendix', title: 'Questions Before You Close This Book', subtitle: '' },
      { id: 'appendixB', num: '·', part: 'Appendix', title: 'Chapter 1 Case Studies (Full)', subtitle: '' },
      { id: 'sources', num: '·', part: 'Appendix', title: 'Sources & References', subtitle: '' },
    ]
  };

  function getChapters() { return chaptersData[currentLang] || chaptersData.zh; }
  function t(key) { return (i18n[currentLang] || i18n.zh)[key] || (i18n.zh)[key] || key; }

  let currentChapterIdx = 2; // default to ch1

  /* ───── UI update on language switch ───── */
  function updateUILanguage() {
    // Cover
    const coverOpen = document.querySelector('.cover-open span:first-child');
    const coverToc = document.querySelector('.cover-toc-link');
    if (coverOpen) coverOpen.textContent = t('openBook');
    if (coverToc) coverToc.textContent = t('viewToc');

    const coverSub = document.querySelector('.cover-subtitle');
    if (coverSub) coverSub.textContent = t('coverSubtitle');

    const eyebrowSpans = document.querySelectorAll('.cover-eyebrow > span:not(.dot)');
    const aud = t('coverAudience');
    if (eyebrowSpans.length >= 3) {
      eyebrowSpans[0].textContent = aud[0];
      eyebrowSpans[1].textContent = aud[1];
      eyebrowSpans[2].textContent = aud[2];
    }

    // TOC crumb
    const tocCrumb = document.querySelector('#view-toc .crumb');
    if (tocCrumb) tocCrumb.textContent = t('tocCrumb');

    // TOC head
    const tocTitle = document.querySelector('.toc-head .title');
    if (tocTitle) tocTitle.textContent = t('tocTitle');

    // Settings drawer labels
    const drawerTitle = document.querySelector('#drawer h6');
    if (drawerTitle) drawerTitle.textContent = t('settingsTitle');

    const labels = document.querySelectorAll('#drawer .row > .label');
    const labelKeys = ['fontSize', 'lineHeight', 'theme', 'lang'];
    labels.forEach((el, i) => { if (labelKeys[i]) el.textContent = t(labelKeys[i]); });

    // Share button
    const shareBtn = document.getElementById('btnShare');
    if (shareBtn) shareBtn.lastChild.textContent = ' ' + t('share');

    // Share modal
    const shareTitle = document.querySelector('#shareModal h6');
    if (shareTitle) shareTitle.textContent = t('shareTitle');
    const shareBodies = document.querySelectorAll('#shareModal .gate-body');
    if (shareBodies[0]) shareBodies[0].innerHTML = t('shareBody1');
    if (shareBodies[1]) shareBodies[1].innerHTML = t('shareBody2');
    const shareRules = document.querySelectorAll('#shareModal .share-rules li');
    if (shareRules[0]) shareRules[0].innerHTML = t('shareRule1');
    if (shareRules[1]) shareRules[1].innerHTML = t('shareRule2');
    if (shareRules[2]) shareRules[2].innerHTML = t('shareRule3');
    const shareWaBtn = document.getElementById('shareWaBtn');
    if (shareWaBtn) { const svg = shareWaBtn.querySelector('svg'); shareWaBtn.textContent = ''; if(svg) shareWaBtn.appendChild(svg); shareWaBtn.append(' ' + t('shareWa')); }

    // html lang attribute
    document.documentElement.lang = currentLang === 'en' ? 'en' : 'zh-Hans';
  }

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
      loadChapter(chapterId || getChapters()[currentChapterIdx].id);
    }
    Object.entries(views).forEach(([k, el]) => el.classList.toggle('is-active', k === name));
    document.body.dataset.current = name;
    progress.style.display = (name === 'reader') ? 'block' : 'none';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function loadChapter(chapterId) {
    const chapters = getChapters();
    const idx = chapters.findIndex(c => c.id === chapterId);
    if (idx === -1) return;
    currentChapterIdx = idx;
    const ch = chapters[idx];

    // Update crumb
    if (crumb) {
      const label = ch.num.match(/^\d+$/) ? (currentLang === 'en' ? 'Ch.' + ch.num.replace(/^0/,'') : '第' + ch.num.replace(/^0/,'') + '章') : ch.title;
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
        ${prevCh ? `<a class="prev" data-goto="reader" data-chapter="${prevCh.id}"><div class="nav-label">${t('prevChapter')}</div><div class="nav-title">${prevCh.title}</div></a>` : `<a class="prev disabled"><div class="nav-label">${t('prevChapter')}</div><div class="nav-title">—</div></a>`}
        ${nextCh ? `<a class="next" data-goto="reader" data-chapter="${nextCh.id}"><div class="nav-label">${t('nextChapter')}</div><div class="nav-title">${nextCh.title}</div></a>` : `<a class="next disabled"><div class="nav-label">${t('nextChapter')}</div><div class="nav-title">—</div></a>`}
      </nav>
    `;

    // If we have pre-rendered content for this chapter, use it
    if (chapterContent) {
      readerArticle.innerHTML = header + '<div class="prose">' + chapterContent.innerHTML + '<div class="signoff">' + t('signoff') + '</div>' + nav + '</div>';
    } else {
      // Placeholder for chapters not yet populated
      const placeholder = `
        <div class="prose">
          <div class="opener">
            <div class="label">${t('editing')}</div>
            <div class="q">${ch.subtitle || ''}</div>
          </div>
          <div class="callout">
            <span class="tag">${t('editing')}</span>
            ${t('editingMsg')}
          </div>
          <div class="signoff">${t('signoff')}</div>
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
  const segLang = document.getElementById('segLang');
  if (segLang) {
    segLang.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      segLang.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
      b.classList.add('is-on');
      currentLang = b.dataset.lang;
      localStorage.setItem('ebook-lang', currentLang);
      updateUILanguage();
      // Reload current chapter in new language
      if (document.body.dataset.current === 'reader') {
        loadChapter(getChapters()[currentChapterIdx].id);
      }
    });
  }

  // Restore saved language on load
  if (currentLang === 'en') {
    if (segLang) {
      segLang.querySelectorAll('button').forEach(x => x.classList.remove('is-on'));
      const enBtn = segLang.querySelector('button[data-lang="en"]');
      if (enBtn) enBtn.classList.add('is-on');
    }
    updateUILanguage();
  }

  /* day theme is in style.css */

  /* ───── keyboard navigation ───── */
  document.addEventListener('keydown', (e) => {
    if (document.body.dataset.current !== 'reader') return;
    const chapters = getChapters();
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
