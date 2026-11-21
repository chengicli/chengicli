/*!
 * hours-search.js —— 「产品工时」页（/hours/）的图号搜索（站点独立脚本，不改主题源码）
 * ---------------------------------------------------------------------------
 * 作用页：只有 /hours/。页面上找不到 .ph-app 就直接返回，其它页面零开销。
 *
 * 为什么不是写死在 tools/xlsx2hours.py 里的内联脚本：
 *   · 那个页面是 Excel 生成的，内联脚本要用 Python 拼字符串，改一次逻辑动一次生成器；
 *   · 页面还开着文章加密（hexo-blog-encrypt），正文是解密后塞进 DOM 的，
 *     内联 <script> 经 innerHTML 插入不会执行 —— 只能由外部脚本盯着。
 *
 * 所以这里做三件事：
 *   1) 等 .ph-app 出现（首屏 / 解密后 / pjax 回来），用 MutationObserver 盯；
 *   2) 输入即过滤：两个面板的 <tbody> 行一起标记 .ph-hide，不动 DOM 顺序；
 *   3) 顶部「共计 N 个产品」跟着当前面板的可见行数变，搜索无结果时露出 .ph-empty。
 *
 * 匹配规则：把输入和单元格都归一化（只留 0~9 / A-Z / 中文），
 *   所以 F3.6061、f36061、F3 6061 都能命中；空格分隔的多个关键词是「与」关系。
 * 快捷键：/ 聚焦输入框，Esc 清空（输入框里按 Esc 时也一样）。
 *
 * 卸载：删掉 _config.chengic.yml inject.bottom 里那一行即可，
 *   页面上的搜索框会退化成普通输入框（不报错）。
 * 仓库路径：source/js/hours-search.js
 */

(function () {
  'use strict';

  var SEL_APP = '.ph-app';
  var CLS_HIDE = 'ph-hide';
  var NORM = /[^0-9a-z\u4e00-\u9fa5]+/g;

  /** 归一化：小写、去掉标点与空格 */
  function norm(s) {
    return String(s || '').toLowerCase().replace(NORM, '');
  }

  /** 当前选中的设备面板（radio 是纯 CSS 切换，状态只能读 checked） */
  function activePanel(app) {
    var radios = app.querySelectorAll('.ph-radio');
    var panels = app.querySelectorAll('.ph-panel');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked && panels[i]) return panels[i];
    }
    return panels[0] || null;
  }

  function visibleRows(panel) {
    if (!panel) return 0;
    var rows = panel.querySelectorAll('tbody tr');
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].classList.contains(CLS_HIDE)) n++;
    }
    return n;
  }

  /* ── 表头吸顶偏移 ────────────────────────────────────────────
   * 表头 sticky 到视口，top 必须避开顶部导航栏（导航固定时约 58px）。
   * 导航随滚动方向显隐、pjax 换页会换掉 #page-header，所以实测 #nav 底边，
   * 并盯着 header 的 class 变化重算，写进 --ph-top 供 hours.css 使用。
   * 与刀具库 warehouse.js 的 --wh-navtop 同一套做法。
   */
  var navBound = false;
  var navRaf = 0;
  var navObservedHeader = null;
  var navObserver = null;
  var headEl = null;   // 当前 .ph-head 工具块，用于量它高度给表头让位

  function navBottom() {
    var header = document.getElementById('page-header');
    var nav = document.getElementById('nav');
    if (!header || !nav) return 58;
    var fixed = header.classList.contains('nav-fixed');
    var shown = header.classList.contains('nav-visible');
    if (!fixed && !shown) return 0;           // 导航还在文档流里，不用避让
    var r = nav.getBoundingClientRect();
    return r.bottom > 0 ? Math.round(r.bottom) : 58;
  }

  function syncNavTop() {
    navRaf = 0;
    var root = document.documentElement;
    root.style.setProperty('--ph-top', navBottom() + 'px');
    /* 工具块高度：sticky 的 thead 紧贴它视觉底边。
       ⚠ 只取 offsetHeight，**不能加 marginBottom**：sticky 后工具块的视觉底边
       就在 content+padding 边界（margin 不产生视觉），表头 top 若按「高度+margin」
       下推，两者之间会空出一条约 16px 透明的缝，滚动的数据行就从缝里漏出来。 */
    if (headEl) {
      root.style.setProperty('--ph-headh', Math.round(headEl.offsetHeight) + 'px');
    }
  }
  function queueNavTop() {
    if (!navRaf) navRaf = requestAnimationFrame(syncNavTop);
  }

  function bindStickyTop() {
    syncNavTop();
    var header = document.getElementById('page-header');
    if (!navBound) {
      navBound = true;
      window.addEventListener('resize', queueNavTop);
      window.addEventListener('scroll', queueNavTop, { passive: true });
    }
    // pjax 换页会换掉 #page-header：节点变了就重挂观察
    if (header && header !== navObservedHeader && window.MutationObserver) {
      if (navObserver) navObserver.disconnect();
      navObservedHeader = header;
      navObserver = new MutationObserver(queueNavTop);
      navObserver.observe(header, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function init() {
    var app = document.querySelector(SEL_APP);
    if (!app || app.getAttribute('data-ph-search') === '1') return;
    var input = app.querySelector('.ph-search-input');
    if (!input) return;
    app.setAttribute('data-ph-search', '1');
    headEl = app.querySelector('.ph-head');
    bindStickyTop();
    syncNavTop();   // 工具块刚插入 DOM，立刻按实际高度算一次表头偏移

    var clearBtn = app.querySelector('.ph-search-clear');
    var emptyMsg = app.querySelector('.ph-empty');
    var countB = app.querySelector('.ph-count b');
    var panels = app.querySelectorAll('.ph-panel');

    // 原始篇数记在 data 里，搜索清空后要还原
    var totalAll = 0;
    for (var p = 0; p < panels.length; p++) {
      var rows0 = panels[p].querySelectorAll('tbody tr');
      panels[p].setAttribute('data-ph-total', String(rows0.length));
      totalAll += rows0.length;
    }
    if (!totalAll) totalAll = parseInt((countB && countB.textContent) || '0', 10) || 0;

    /** 当前应显示的数字：没有关键词时按面板原始条数 */
    function refreshCount() {
      var panel = activePanel(app);
      var q = norm(input.value);
      var n = q ? visibleRows(panel) : parseInt((panel && panel.getAttribute('data-ph-total')) || '0', 10);
      if (countB) countB.textContent = String(n);
      if (emptyMsg) emptyMsg.hidden = !(q && n === 0);
      if (clearBtn) clearBtn.hidden = !input.value;
    }

    function apply() {
      var q = norm(input.value);
      var words = String(input.value).trim().toLowerCase().split(/\s+/).filter(function (w) { return norm(w); });
      for (var i = 0; i < panels.length; i++) {
        var rows = panels[i].querySelectorAll('tbody tr');
        for (var j = 0; j < rows.length; j++) {
          var hit = true;
          if (q) {
            var text = rows[j].getAttribute('data-ph-key');
            if (!text) text = norm(rows[j].textContent);
            if (words.length > 1) {
              // 空格分隔的多个关键词是「与」关系：逐个都要命中
              hit = true;
              for (var k = 0; k < words.length && hit; k++) {
                if (text.indexOf(norm(words[k])) === -1) hit = false;
              }
            } else {
              // 单个关键词按整串匹配（F3.6061 去掉符号后是 f36061）
              hit = text.indexOf(q) !== -1;
            }
          }
          rows[j].classList.toggle(CLS_HIDE, !hit);
        }
      }
      refreshCount();
    }

    // 行里存一份归一化后的图号，匹配时不必每次重算整行文本
    for (var i = 0; i < panels.length; i++) {
      var rows = panels[i].querySelectorAll('tbody tr');
      for (var j = 0; j < rows.length; j++) {
        var keyCell = rows[j].querySelector('.ph-key');
        rows[j].setAttribute('data-ph-key', norm(keyCell ? keyCell.textContent : rows[j].textContent));
      }
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        input.value = '';
        apply();
        input.blur();
      }
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        apply();
        input.focus();
      });
    }
    // 切设备时数字跟着换（radio 的选中变化不会冒泡成普通事件，用 change 监听）
    var radios = app.querySelectorAll('.ph-radio');
    for (var r = 0; r < radios.length; r++) {
      radios[r].addEventListener('change', refreshCount);
    }

    apply();
  }

  /** 加密文章是解密后才把正文插进 DOM 的，这里盯着直到 .ph-app 出现 */
  function watch() {
    init();
    if (document.querySelector(SEL_APP)) return;
    if (typeof MutationObserver === 'undefined') return;
    var timer = window.setTimeout(function () { obs.disconnect(); }, 60000); // 一分钟还没解锁就别盯了
    var obs = new MutationObserver(function () {
      if (document.querySelector(SEL_APP)) {
        obs.disconnect();
        window.clearTimeout(timer);
        init();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }

  // pjax 往返：页面元素被换掉后重新绑一次
  ['pjax:complete', 'pjax:success'].forEach(function (ev) {
    document.addEventListener(ev, function () { setTimeout(watch, 0); });
  });

  // 全局快捷键：/ 聚焦搜索框（正在输入或已聚焦别处时不抢）
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var input = document.querySelector('.ph-app .ph-search-input');
    if (!input) return;
    ev.preventDefault();
    input.focus();
  });
})();
