/* ============================================================
 * warehouse.js —— 「仓库」库存速查页（只读）
 * ----------------------------------------------------------------------------
 * 页面本身不提供增删改（2026-11-16 作者定：数据只在 Excel 里改，员工只能看）。
 * 库存的增删改流程：
 *   改 tools.xlsx → npm run warehouse → npm run build
 *
 * 交互：
 *   ① 首屏只列品类卡（U钻 / 刀盘 / 方肩刀），带「N 种 · 合计 N 件」
 *   ② 点卡片才铺开明细：搜索 + 类型胶囊 + 表格（表头吸顶）
 *   ③「← 全部品类」退回卡片
 *
 * 数据来自 /js/data/warehouse-data.js 的 window.WH_DATA（tools/xlsx2warehouse.py 生成）。
 * 列靠表头文字识别，所以 Excel 里加列不用改这里。
 * 只认 .wh-* / #wh* 这套类名和 id，其它页面进来第一行就 return。
 * ============================================================ */
(function () {
  'use strict';

  var RE = {
    qty: /数量|库存|件数|余量/,
    memo: /备注|说明|状态|品牌/,
    type: /类型|种类|材质/,
    dia: /直径|外径/,
    ld: /倍径|长度|刃长/
  };

  var state = { group: '', type: 'all', kw: '' };
  var sheets = [];
  var secMap = {};       // 品类名 → section 元素
  var SEC_TEXT = {};     // 「品类|行号」→ 该行的检索文本
  var els = {};
  var META = {};
  var scrollReset = false;   // 每次页面加载只复位一次滚动位置

  /* ---------- 小工具 ---------- */
  function norm(s) {
    return String(s).toLowerCase().replace(/\s+/g, '');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : Infinity;
  }

  function fmtQty(n) {
    return String(Math.round(n * 100) / 100);
  }

  function pick(cols) {
    var idx = { qty: -1, memo: -1, type: -1, dia: -1, ld: -1 };
    cols.forEach(function (c, i) {
      var t = String(c);
      for (var k in RE) if (idx[k] < 0 && RE[k].test(t)) idx[k] = i;
    });
    return idx;
  }

  function idxOf(sheet) {
    if (!sheet.__idx) sheet.__idx = pick(sheet.cols);
    return sheet.__idx;
  }

  /* 数量统计：sum 合计、n 有填数的行数、has 有没有数量列。
     分开记 n 是因为「数量列存在但整列还没填」不等于「库存 0 件」，
     卡片上要写「数量待填」，不能写「合计 0 件」误导人。 */
  function qtyStat(sheet) {
    var i = idxOf(sheet).qty, sum = 0, n = 0;
    if (i < 0) return { sum: 0, n: 0, has: false };
    sheet.rows.forEach(function (r) {
      var v = parseFloat(r[i]);
      if (isFinite(v)) { sum += v; n++; }
    });
    return { sum: sum, n: n, has: true };
  }

  function sheetByName(name) {
    for (var i = 0; i < sheets.length; i++) if (sheets[i].name === name) return sheets[i];
    return null;
  }

  /* 排成「速查表」的顺：类型分组（按出现顺序）→ 直径升序 → 长度升序 */
  function sortRows(rows, idx) {
    var order = {}, n = 0;
    if (idx.type >= 0) {
      rows.forEach(function (r) {
        var k = String(r[idx.type] == null ? '' : r[idx.type]);
        if (!(k in order)) order[k] = n++;
      });
    }
    return rows.slice().sort(function (a, b) {
      if (idx.type >= 0) {
        var d = order[String(a[idx.type] == null ? '' : a[idx.type])] -
                order[String(b[idx.type] == null ? '' : b[idx.type])];
        if (d) return d;
      }
      if (idx.dia >= 0) { var x = num(a[idx.dia]) - num(b[idx.dia]); if (x) return x; }
      if (idx.ld >= 0) { var y = num(a[idx.ld]) - num(b[idx.ld]); if (y) return y; }
      return 0;
    });
  }

  /* ---------- 首屏 ---------- */
  function renderStats(box) {
    var totalRows = 0, totalQty = 0, totalMemo = 0;
    sheets.forEach(function (sh) {
      totalRows += sh.rows.length;
      totalQty += qtyStat(sh).sum;
      var m = idxOf(sh).memo;
      if (m >= 0) {
        sh.rows.forEach(function (r) {
          var v = r[m];
          if (v !== undefined && v !== null && String(v) !== '') totalMemo++;
        });
      }
    });
    box.innerHTML = [
      { value: totalRows, label: '在库型号' },
      { value: fmtQty(totalQty), label: '库存件数', accent: true },
      { value: sheets.length, label: '品类' },
      { value: totalMemo, label: '带备注' }
    ].map(function (s) {
      return '<div class="wh-stat' + (s.accent ? ' is-accent' : '') + '">' +
        '<b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('');
  }

  /* 品类卡第二行文案：数量列存在但整列没填时写「数量待填」，不写「合计 0 件」 */
  function catMeta(sh) {
    var q = qtyStat(sh);
    if (!sh.rows.length) return '未录入数据';
    if (!q.has) return sh.rows.length + ' 种 · 无数量列';
    if (!q.n) return sh.rows.length + ' 种 · 数量待填';
    return sh.rows.length + ' 种 · 合计 ' + fmtQty(q.sum) + ' 件';
  }

  function renderCats(box) {
    box.innerHTML = sheets.map(function (sh) {
      return '<button type="button" class="wh-cat" data-group="' + esc(sh.name) + '">' +
        '<span class="wh-cat-name">' + esc(sh.name) + '</span>' +
        '<span class="wh-cat-meta">' + esc(catMeta(sh)) + '</span>' +
        '<svg class="wh-cat-arrow" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M9 5l7 7-7 7"></path></svg>' +
        '</button>';
    }).join('');
  }

  /* ---------- 明细表 ---------- */
  function colToken(i, idx) {
    if (i === idx.type) return 'type';
    if (i === idx.dia) return 'dia';
    if (i === idx.ld) return 'ld';
    if (i === idx.qty) return 'qty';
    if (i === idx.memo) return 'memo';
    return '';
  }

  function cellHtml(idx, i, s) {
    if (i === idx.qty) {
      if (s === '') return '<span class="wh-dash">—</span>';
      var q = parseFloat(s);
      var lv = isFinite(q) && q <= 0 ? '0' : (q >= 2 ? '2' : '1');
      return '<span class="wh-qty" data-lv="' + lv + '">' + esc(s) + '</span>';
    }
    if (i === idx.memo) {
      return s ? '<span class="wh-tag">' + esc(s) + '</span>' : '<span class="wh-dash">—</span>';
    }
    if (i === idx.dia) {
      // 直径当「主键」：加粗 + 主题色；数值前补直径符号 Ø（站内文章也这么写）
      return s ? 'Ø' + esc(s) : '<span class="wh-dash">—</span>';
    }
    return s ? esc(s) : '<span class="wh-dash">—</span>';
  }

  function renderSection(sheet) {
    var sec = secMap[sheet.name];
    if (!sec) return;
    var idx = idxOf(sheet);
    sec.innerHTML = '';

    if (!sheet.rows.length) {
      sec.setAttribute('data-empty', '1');
      var none = document.createElement('p');
      none.className = 'wh-none';
      none.textContent = '请联系管理员导入数据！';
      sec.appendChild(none);
      return;
    }
    sec.removeAttribute('data-empty');

    var html = ['<div class="wh-table"><table><thead><tr>'];
    sheet.cols.forEach(function (c, i) {
      var tok = colToken(i, idx);
      html.push('<th scope="col"' + (tok ? ' class="wh-col-' + tok + '"' : '') + '>' + esc(c) + '</th>');
    });
    html.push('</tr></thead><tbody>');

    /* data-row 是搜索用的索引：apply() 靠 sheet|行号 取这一行的检索文本。
       之前漏了它，SEC_TEXT 查不到 → 一输关键词全部行都被判为不匹配（2026-11-16 修）。 */
    var ri = 0;
    sortRows(sheet.rows, idx).forEach(function (r) {
      var i, s, text = sheet.name;
      html.push('<tr data-row="' + ri + '" data-type="' +
        esc(idx.type >= 0 ? (r[idx.type] == null ? '' : r[idx.type]) : '') + '">');
      for (i = 0; i < sheet.cols.length; i++) {
        s = r[i] === undefined || r[i] === null ? '' : String(r[i]);
        text += ' ' + s + (i === idx.dia ? ' Ø' + s : '');
        html.push('<td' + (i === idx.dia ? ' class="wh-key"' : '') + '>' +
          cellHtml(idx, i, s) + '</td>');
      }
      html.push('</tr>');
      SEC_TEXT[sheet.name + '|' + ri] = norm(text);
      ri++;
    });
    html.push('</tbody></table></div>');
    sec.innerHTML = html.join('');
  }

  function renderSections() {
    sheets.forEach(function (sh) {
      if (!secMap[sh.name]) {
        var sec = document.createElement('section');
        sec.className = 'wh-sec';
        sec.setAttribute('data-group', sh.name);
        sec.hidden = true;
        if (els.list) els.list.appendChild(sec);
        secMap[sh.name] = sec;
      }
      renderSection(sh);
    });
  }

  /* ---------- 筛选 ---------- */
  function typesOf(sheet) {
    var seen = {}, out = [];
    if (!sheet) return out;
    var i = idxOf(sheet).type;
    if (i < 0) return out;
    sheet.rows.forEach(function (r) {
      var v = String(r[i] == null ? '' : r[i]);
      if (v && !(v in seen)) { seen[v] = 1; out.push(v); }
    });
    return out;
  }

  function renderTypeChips() {
    var box = els.typeChips;
    if (!box) return;
    var types = typesOf(sheetByName(state.group));
    if (!types.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    var html = '<button type="button" class="wh-chip-btn' + (state.type === 'all' ? ' is-on' : '') +
      '" data-type="all">全部类型</button>';
    types.forEach(function (t) {
      html += '<button type="button" class="wh-chip-btn' +
        (state.type === t ? ' is-on' : '') + '" data-type="' + esc(t) + '">' + esc(t) + '</button>';
    });
    box.innerHTML = html;
  }

  function apply() {
    var sec = secMap[state.group];
    if (!sec) return;

    var kw = norm(state.kw);
    var rows = sec.querySelectorAll('tbody tr');
    var shown = 0, qty = 0;

    Array.prototype.forEach.call(rows, function (tr) {
      var typeOk = state.type === 'all' || tr.getAttribute('data-type') === state.type;
      var k = SEC_TEXT[state.group + '|' + tr.getAttribute('data-row')] || '';
      var hit = !kw || k.indexOf(kw) !== -1;
      var show = typeOk && hit;
      tr.classList.toggle('is-hide', !show);
      tr.classList.toggle('is-hit', !!kw && show);
      if (show) {
        shown++;
        var cell = tr.querySelector('.wh-qty');
        if (cell) qty += parseFloat(cell.textContent) || 0;
      }
    });

    var all = rows.length;
    if (els.count) {
      els.count.textContent = (kw || state.type !== 'all')
        ? '显示 ' + shown + ' / ' + all + ' 条' + (qty ? ' · 合计 ' + fmtQty(qty) + ' 件' : '')
        : '共 ' + all + ' 条' + (qty ? ' · 合计 ' + fmtQty(qty) + ' 件' : '');
    }
    if (els.empty) els.empty.hidden = !all || shown > 0;
    if (els.clear) els.clear.classList.toggle('is-show', !!state.kw);
  }

  /* ---------- 表头吸顶 ---------- */
  /* pjax 换页后 .wh-bar 是新的节点，但 window 上的 resize 监听不能跟着重复加，
     所以这里只绑一次全局监听，目标元素放到 stickyTarget 里换。 */
  var stickyTarget = null;
  var stickyObserver = null;
  var stickyBound = false;
  var stickyRaf = 0;
  var stickyLast = -1;

  function syncSticky() {
    stickyRaf = 0;
    if (!stickyTarget) return;
    var bar = stickyTarget.bar;
    /* 表头吸顶位置 = 工具条自己的 top（60px，窄屏 52px）+ 工具条高度。
       用 offsetHeight + 计算样式的 top，**不用 getBoundingClientRect().bottom**：
       后者跟当前滚动位置绑定，工具条还没吸住时量到的是它在文档流里的位置，
       表头就会吸到表格中间去（2026-11-16 修）。 */
    var t = parseFloat(getComputedStyle(bar).top);
    if (!isFinite(t)) t = 60;
    var v = Math.round(bar.offsetHeight + t);
    if (v !== stickyLast) {
      stickyLast = v;
      stickyTarget.root.style.setProperty('--wh-top', v + 'px');
    }
  }

  function queueSticky() { if (!stickyRaf) stickyRaf = requestAnimationFrame(syncSticky); }

  /* 顶部导航栏的高度不固定，得实测：
     主题 main.js 会按滚动方向给 #page-header 挂 nav-fixed / nav-visible，
     站内 custom.css 又写了「顶栏常驻」——transform: translateY(58px) !important，
     所以只要导航变成固定条就是**露在外面**的（58px，不是 60），
     死写 60 会压住第一行，写成「nav-visible 才算可见」又会算成 0 把整块顶到导航底下。
     直接量 #nav 的底边最省事。class 一变就重量（比在 scroll 里读稳：主题那边 200ms 节流）。 */
  var navObserver = null;
  var navRaf = 0;

  function navTop() {
    var header = document.getElementById('page-header');
    var nav = document.getElementById('nav');
    if (!header || !nav) return 0;
    var fixed = header.classList.contains('nav-fixed');
    var shown = header.classList.contains('nav-visible');
    if (!fixed && !shown) return 0;            // 还在页面原位，不用避让
    var r = nav.getBoundingClientRect();
    return r.bottom > 0 ? Math.round(r.bottom) : 0;
  }

  function syncNav() {
    navRaf = 0;
    document.documentElement.style.setProperty('--wh-navtop', navTop() + 'px');
    syncSticky();   // 表头位置 = 吸顶块 top + 高度
  }

  function queueNav() { if (!navRaf) navRaf = requestAnimationFrame(syncNav); }

  function bindSticky(bar, root) {
    if (!bar) return;
    stickyTarget = { bar: bar, root: root };
    stickyLast = -1;
    els.sync = syncSticky;

    if (stickyObserver) stickyObserver.disconnect();
    if (window.ResizeObserver) {
      stickyObserver = new ResizeObserver(queueSticky);
      stickyObserver.observe(bar);
    }

    /* pjax 换页会把 #page-header 整个换掉，所以每次 init 都重挂一次 */
    if (navObserver) { navObserver.disconnect(); navObserver = null; }
    var header = document.getElementById('page-header');
    if (header && window.MutationObserver) {
      navObserver = new MutationObserver(queueNav);
      navObserver.observe(header, { attributes: true, attributeFilter: ['class'] });
    }
    queueNav();

    if (stickyBound) { syncSticky(); return; }
    stickyBound = true;

    window.addEventListener('resize', queueSticky);
    window.addEventListener('resize', queueNav);
    window.addEventListener('load', queueSticky);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueSticky);
    // 首屏字体/图片撑开工具条后高度会变，几个时间点各量一次兜住
    [0, 80, 240, 600, 1200].forEach(function (ms) { setTimeout(queueSticky, ms); });
  }

  /* ---------- 视图切换 ---------- */
  /* ---------- 地址栏路由：/warehouse/tap ----------
   * 每个品类在导出的数据里带一个英文 slug（在 tools/xlsx2warehouse.py 里配），
   * 点品类时用 pushState 把地址换成 /warehouse/tap，刷新和分享都能直达。
   * 静态站没法给每个 slug 单独渲染一页，所以构建时会在 public/warehouse/<slug>/
   * 放一个跳板页（scripts/warehouse-routes.js）：它跳到 ?g=<slug>，本文件再把
   * 地址 replaceState 回干净路径。 */
  function basePath() {
    var key = '/warehouse';
    var p = location.pathname;
    var i = p.indexOf(key);
    if (i < 0) return key + '/';
    return p.slice(0, i + key.length) + '/';
  }

  function routeSlug() {
    var m = /[?&]g=([a-z0-9-]+)/i.exec(location.search);
    if (m) return m[1].toLowerCase();
    var rest = location.pathname.slice(basePath().length).replace(/\/+$/, '');
    return rest ? rest.split('/')[0].toLowerCase() : '';
  }

  function sheetBySlug(slug) {
    for (var i = 0; i < sheets.length; i++) if (sheets[i].slug === slug) return sheets[i];
    return null;
  }

  function setUrl(slug) {
    var url = basePath() + (slug || '');
    try { history.pushState({ wh: slug || '' }, '', url); } catch (e) {}
  }

  /* 明细视图时把浏览器标题和页面大标题都换成品类名，返回时还原。
     主题的页面大标题是 header#page-header h1#site-title（.post-title 只有文章页有），
     之前只找 .post-title，所以大标题一直没变过（2026-11-17 修）。 */
  var ORIG_TITLE = '';
  var ORIG_PLACEHOLDER = '';
  function setTitle(name) {
    if (!ORIG_TITLE) ORIG_TITLE = document.title;
    var parts = ORIG_TITLE.split(/[|｜]/);
    var site = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
    document.title = name ? (name + (site ? ' | ' + site : '')) : ORIG_TITLE;

    var el = document.querySelector('#page-header #site-title') ||
             document.querySelector('#page-header .post-title');
    if (!el) return;
    if (!el.getAttribute('data-wh-base')) el.setAttribute('data-wh-base', el.textContent.trim());
    var base = el.getAttribute('data-wh-base') || '';
    /* 大标题写「刀具库 · U钻」：既说明在哪个页面，也说明在哪个品类 */
    el.textContent = name ? (base ? base + ' · ' + name : name) : base;
  }

  /* keepUrl: 地址栏已经对了就别再 push；noScroll: 别自动滚到明细（刷新/直链时用） */
  function openGroup(name, keepUrl, noScroll) {
    var sheet = sheetByName(name);
    if (!sheet) return;

    if (!keepUrl) setUrl(sheet.slug || '');
    setTitle(name);

    state.group = name;
    state.type = 'all';
    state.kw = '';
    if (els.search) {
      els.search.value = '';
      /* 输入框里直接写品类名，翻到表格深处也还看得见自己在搜哪个品类 */
      if (!ORIG_PLACEHOLDER) ORIG_PLACEHOLDER = els.search.placeholder;
      els.search.placeholder = '在「' + name + '」里搜：19.5、通孔、1604…';
    }

    els.stats.hidden = true;
    els.cats.hidden = true;
    if (els.stamp) els.stamp.hidden = true;
    els.detail.hidden = false;

    Object.keys(secMap).forEach(function (k) { secMap[k].hidden = k !== name; });

    if (els.dtitle) els.dtitle.textContent = name;
    if (els.dnote) {
      var q = qtyStat(sheet);
      els.dnote.textContent = sheet.rows.length
        ? sheet.rows.length + ' 种' + (q.has ? (q.n ? ' · 合计 ' + fmtQty(q.sum) + ' 件' : ' · 数量待填') : '')
        : '未录入数据';
    }
    if (els.tip) els.tip.textContent = META.updated ? '数据更新于 ' + META.updated : '';

    renderTypeChips();
    apply();
    if (els.sync) els.sync();

    /* 只有用户自己点品类才滚到明细。
       刷新 / 直链 / 前进后退时不滚：一滚就把页面顶部（那圈菜单栏）甩出视口，
       看着就像导航被删了（2026-11-17 修）。 */
    if (noScroll) return;
    var top = els.app.getBoundingClientRect().top + window.pageYOffset - 70;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(top, 0), behavior: reduce ? 'auto' : 'smooth' });
  }

  function closeGroup(keepUrl) {
    if (!keepUrl) setUrl('');
    setTitle('');

    state.group = '';
    state.type = 'all';
    state.kw = '';
    els.detail.hidden = true;
    els.stats.hidden = false;
    els.cats.hidden = false;
    if (els.search && ORIG_PLACEHOLDER) els.search.placeholder = ORIG_PLACEHOLDER;
    if (els.stamp) els.stamp.hidden = false;
    Object.keys(secMap).forEach(function (k) { secMap[k].hidden = true; });
  }

  /* ---------- 入口 ---------- */
  function init() {
    var app = document.getElementById('whApp');
    if (!app || app.getAttribute('data-ready') === 'done') return;   // 不是这页 / 已经初始化过

    /* 刷新时浏览器会恢复离开时的滚动位置，而主题的导航栏得等滚动事件才会变成固定条，
       于是停在表格中间一刷新，顶部只剩表格、菜单栏看着就“没了”（2026-11-17）。
       放在等数据之前：数据多等几秒也别让页面先跳到半截去。 */
    if (!scrollReset) {
      scrollReset = true;
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
    }

    /* 加密页的坑：主题 scrollFn 在「解密前页面还短」那次直接 return，滚动监听没绑上，
       导航栏就永远不会变成固定顶栏（一滚菜单栏就没了）。补绑一次，详情见 unlock-secret.js。 */
    if (typeof window.__fomalScrollResync === 'function' && !window.scrollCollect) {
      try { window.__fomalScrollResync(); } catch (e) {}
    }

    /* 页面加密时（front-matter 的 password），解密后 hbe.js 会把 <script> 重新创建一遍再插入，
       defer 对动态插入的脚本无效、执行顺序也不保证 —— 数据脚本可能比本文件晚到几毫秒。
       所以这里给 4 秒的重试窗口，等 window.WH_DATA 出现再初始化。 */
    if (!window.WH_DATA || !window.WH_DATA.sheets) {
      var waited = parseInt(app.getAttribute('data-wait') || '0', 10);
      if (waited < 40) {
        app.setAttribute('data-wait', String(waited + 1));
        setTimeout(init, 100);
        return;
      }
    }
    app.setAttribute('data-ready', 'done');

    els = {
      app: app,
      stats: document.getElementById('whStats'),
      cats: document.getElementById('whCats'),
      stamp: document.getElementById('whStamp'),
      detail: document.getElementById('whDetail'),
      dtitle: document.getElementById('whDtitle'),
      dnote: document.getElementById('whDnote'),
      list: document.getElementById('whList'),
      count: document.getElementById('whCount'),
      tip: document.getElementById('whTip'),
      empty: document.getElementById('whEmpty'),
      search: document.getElementById('whSearch'),
      clear: document.getElementById('whClear'),
      typeChips: document.getElementById('whTypeChips'),
      back: document.getElementById('whBack')
    };

    state = { group: '', type: 'all', kw: '' };
    secMap = {};
    SEC_TEXT = {};
    /* pjax 换页后 document.title / placeholder 都是新页面的，重新取一次基准 */
    ORIG_TITLE = '';
    ORIG_PLACEHOLDER = '';

    var data = window.WH_DATA;
    if (!data || !data.sheets) {
      if (els.cats) {
        els.cats.innerHTML = '<p class="wh-none">库存数据没加载成功' +
          '（/js/data/warehouse-data.js 还没生成？执行 npm run warehouse）</p>';
      }
      return;
    }

    META.updated = data.updated;
    sheets = data.sheets;

    if (els.stamp && data.updated) {
      els.stamp.textContent = '数据更新于 ' + data.updated;
    }

    if (els.stats) renderStats(els.stats);
    if (els.cats) renderCats(els.cats);
    renderSections();

    /* 事件：品类卡 */
    if (els.cats) {
      els.cats.addEventListener('click', function (e) {
        var btn = e.target.closest('.wh-cat');
        if (btn) openGroup(btn.getAttribute('data-group'));
      });
    }

    /* 事件：类型胶囊 */
    if (els.typeChips) {
      els.typeChips.addEventListener('click', function (e) {
        var btn = e.target.closest('.wh-chip-btn');
        if (!btn) return;
        state.type = btn.getAttribute('data-type') || 'all';
        Array.prototype.forEach.call(els.typeChips.children, function (b) {
          b.classList.toggle('is-on', b === btn);
        });
        apply();
      });
    }

    /* 事件：搜索 */
    if (els.search) {
      els.search.addEventListener('input', function () {
        state.kw = els.search.value;
        apply();
      });
    }
    if (els.clear) {
      els.clear.addEventListener('click', function () {
        if (els.search) els.search.value = '';
        state.kw = '';
        apply();
        if (els.search) els.search.focus();
      });
    }
    /* 注意：closeGroup(keepUrl) 的第一个参数是「别动地址栏」，
       直接当监听器会把 click 事件对象传进去（真值）→ 返回时不改地址。 */
    if (els.back) els.back.addEventListener('click', function () { closeGroup(); });

    /* 主题会给表格套 .table-wrap（overflow-x），会让 thead 的 sticky 失效 */
    Array.prototype.slice.call(app.querySelectorAll('.wh-table .table-wrap'))
      .forEach(function (w) {
        var p = w.parentNode;
        while (w.firstChild) p.insertBefore(w.firstChild, w);
        p.removeChild(w);
      });

    /* 吸顶的是「明细头 + 工具条」整块（.wh-sticky），表头要贴在它下面 */
    bindSticky(document.querySelector('.wh-sticky') || document.querySelector('.wh-bar'),
      document.documentElement);

    /* 地址栏里带了品类就直开明细（?g= 是跳板页转过来的，/warehouse/tap 是直接访问），
       然后统一换成干净路径，别让 ?g= 留在地址里。 */
    var slug = routeSlug();
    var want = slug && sheetBySlug(slug);
    if (want) {
      openGroup(want.name, true, true);   // 直链/刷新：只还原视图，别把页面滚下去
      try { history.replaceState({ wh: slug }, '', basePath() + slug); } catch (e) {}
    }
  }

  /* 浏览器前进/后退：按地址栏里的 slug 还原视图 */
  window.addEventListener('popstate', function () {
    var slug = routeSlug();
    var sh = slug && sheetBySlug(slug);
    if (sh) openGroup(sh.name, true, true);
    else if (state.group) closeGroup(true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
})();
