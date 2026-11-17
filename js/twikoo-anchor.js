/* ============================================================
 * twikoo-anchor.js —— 给每条留言一个能直接引用的链接
 * ----------------------------------------------------------------------------
 * 起因：留言板有人提建议 —— 发完留言后希望能拿到「这一条」的地址，
 *       讨论问题时直接贴链接，不用让对方翻整页。
 *
 * 做法（不碰 Twikoo 内部逻辑，只在其渲染结果上做加法）：
 *   1. Twikoo 给每条留言的 <div class="tk-comment"> 写了 id=<32位留言id>，
 *      这里在昵称/时间那一行补一个「#」：点击 = 复制完整链接 + 地址栏换成 #<id>；
 *   2. 打开带 #<id> 的链接时，等评论渲染完自动滚到那条并高亮两秒；
 *   3. 评论是懒加载的（滚到评论区才请求），所以带 hash 进来时先把评论区滚进视口，
 *      触发加载后再定位；
 *   4. 自己发布成功后，列表里会多出一条新留言 —— 这时自动把地址栏换成它的 id，
 *      顺手就是一条可复制的链接。
 *
 * 只在有 #twikoo-wrap 的页面生效，其它页面直接退出。
 * ============================================================ */
(function () {
  'use strict';

  var ID_RE = /^[0-9a-f]{32}$/i;   // Twikoo 留言 id（md5 长度）
  var HIT = 'tk-anchor-hit';       // 高亮类，样式在 source/css/twikoo.css
  var MARK = 'data-tk-anchor';     // 已挂过按钮的标记，避免重复插入
  var FLASH_MS = 2400;
  var PUBLISH_WINDOW = 20000;      // 点「发送」后多久内出现的新留言算自己发的

  var observer = null;
  var raf = 0;
  var publishAt = 0;               // 最近一次点「发送」的时间
  var beforeIds = [];              // 点「发送」前已有的留言 id，用来认出「新增」的那条
  var revealed = '';               // 已经跳过的 id，避免重复滚动
  var boundBox = null;             // 已经绑过事件代理的容器

  function isId(s) { return ID_RE.test(String(s || '')); }

  function hashId() {
    var h = String(location.hash || '').replace(/^#/, '');
    return isId(h) ? h.toLowerCase() : '';
  }

  function wrap() { return document.getElementById('twikoo-wrap'); }

  function commentEl(id) {
    var el = document.getElementById(id);
    return el && el.classList && el.classList.contains('tk-comment') ? el : null;
  }

  function fullLink(id) {
    return location.origin + location.pathname + location.search + '#' + id;
  }

  function setHash(id) {
    /* replaceState 不产生历史记录，也不会触发 hashchange，正是这里想要的 */
    try { history.replaceState(null, '', '#' + id); } catch (e) { }
  }

  function scrollToEl(el, smooth) {
    var top = el.getBoundingClientRect().top + window.pageYOffset - 76;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(top, 0), behavior: (smooth && !reduce) ? 'smooth' : 'auto' });
  }

  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.top >= 60 && r.bottom <= window.innerHeight + 1;
  }

  /* 高亮：加类 → 定时去掉（同一元素重复触发时重置计时，不叠加） */
  function flash(el) {
    el.classList.add(HIT);
    if (el.__tkFlash) clearTimeout(el.__tkFlash);
    el.__tkFlash = setTimeout(function () {
      el.classList.remove(HIT);
      el.__tkFlash = 0;
    }, FLASH_MS);
  }

  function reveal(id, smooth) {
    var el = commentEl(id);
    if (!el) return false;
    scrollToEl(el, smooth);
    flash(el);
    return true;
  }

  /* 评论是异步渲染的，等它出现再跳（最多 6 秒） */
  function revealWhenReady(id, smooth) {
    var n = 0;
    (function next() {
      if (reveal(id, smooth)) return;
      if (++n > 60) return;
      setTimeout(next, 100);
    })();
  }

  function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return;
      }
    } catch (e) { /* 继续走兜底 */ }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e2) { /* 复制不了就算了，地址栏已经换好 */ }
  }

  function copied(link) {
    link.textContent = '已复制';
    link.classList.add('is-copied');
    if (link.__tkReset) clearTimeout(link.__tkReset);
    link.__tkReset = setTimeout(function () {
      link.textContent = '#';
      link.classList.remove('is-copied');
      link.__tkReset = 0;
    }, 1500);
  }

  /* 注意：这里必须是 <button>，不能是 <a href="#id">。
     source/js/inject/scroll-gap-fix.js 在 document 捕获阶段接管了所有
     「href 以 # 开头且目标存在」的链接点击（preventDefault + stopPropagation），
     点击事件根本到不了链接自身 —— 挂在 <a> 上的监听器永远不执行。
     按钮语义也更准确：这是一次动作（复制），不是导航。 */
  function buildLink(id) {
    var a = document.createElement('button');
    a.type = 'button';
    a.className = 'tk-anchor-link';
    a.textContent = '#';
    a.title = '复制这条留言的链接';
    a.setAttribute('aria-label', '复制这条留言的链接');
    a.addEventListener('click', function (e) {
      e.preventDefault();
      copy(fullLink(id));
      setHash(id);
      copied(a);
      revealed = id;
      var el = commentEl(id);
      if (el) {
        if (!inView(el)) scrollToEl(el, true);
        flash(el);
      }
    });
    return a;
  }

  /* 顶端这一层留言（不含楼中楼）的 id，按 DOM 顺序 */
  function topLevelIds() {
    var box = wrap();
    if (!box) return [];
    var out = [];
    var list = box.querySelectorAll('.tk-comment');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!isId(el.id)) continue;
      if (el.closest && el.closest('.tk-replies')) continue;
      out.push(el.id.toLowerCase());
    }
    return out;
  }

  /* 给还没挂过按钮的留言补「#」：挂在昵称/时间那一行（常驻可见，
     不像 .tk-actions 那样只在悬停时出现） */
  function markLinks() {
    var box = wrap();
    if (!box) return;
    var list = box.querySelectorAll('.tk-comment');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      /* 以「DOM 里有没有按钮」为准：Vue 局部重渲染可能只换子节点、留着老节点，
         属性标记会失效，靠这次检查自愈 */
      if (!isId(el.id)) continue;
      if (el.querySelector('.tk-anchor-link')) {
        el.setAttribute(MARK, '1');
        continue;
      }
      var host = el.querySelector('.tk-meta') ||
                 el.querySelector('.tk-actions') ||
                 el.querySelector('.tk-main') || el;
      host.appendChild(buildLink(el.id.toLowerCase()));
      el.setAttribute(MARK, '1');
    }
  }

  /* 打开就带 #id：先把评论区滚进视口（触发懒加载），再等它渲染出来 */
  function primeLazy() {
    var id = hashId();
    if (!id || commentEl(id)) return;
    var box = wrap();
    if (!box) return;
    scrollToEl(box, false);
    revealWhenReady(id, false);
  }

  function tick() {
    raf = 0;
    var box = wrap();
    if (!box) return;
    markLinks();

    /* 地址栏带 hash（含用户点「#」后按刷新）→ 定位；用 revealed 防止反复滚 */
    var id = hashId();
    if (id && id !== revealed && commentEl(id)) {
      revealed = id;
      reveal(id, true);
    }
  }

  function queue() { if (!raf) raf = requestAnimationFrame(tick); }

  /* 事件代理：记下「刚点过发送」以及「点发送时列表里已有哪些留言」 */
  function bind(box) {
    if (boundBox === box) return;
    boundBox = box;
    box.addEventListener('click', function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest('.tk-button--primary') : null;
      if (btn) {
        publishAt = Date.now();
        beforeIds = topLevelIds();
        return;
      }
      /* 翻页 / 换排序会整批换掉留言，不算「新发布」 */
      if (t && t.closest && t.closest('.tk-pagination-pager, .tk-sort-item, .tk-comments-actions')) {
        publishAt = 0;
      }
    }, true);
  }

  /* 新留言：点过发送之后，顶端多了一条之前没有的留言 = 自己刚发的 */
  function watch() {
    var box = wrap();
    if (!box || !window.MutationObserver) return;
    bind(box);

    if (observer) observer.disconnect();
    observer = new MutationObserver(function (muts) {
      if (!publishAt) { queue(); return; }

      var topAdded = null;
      for (var i = 0; i < muts.length && !topAdded; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (!n || n.nodeType !== 1) continue;
          var c = n.classList && n.classList.contains('tk-comment')
            ? n
            : (n.querySelector ? n.querySelector('.tk-comment') : null);
          if (!c || !isId(c.id)) continue;
          if (c.closest && c.closest('.tk-replies')) continue;   // 回复不算
          var parent = c.parentNode;
          if (parent && parent.querySelector('.tk-comment') === c) { topAdded = c; break; }
        }
      }

      if (topAdded) {
        var id = topAdded.id.toLowerCase();
        var isNew = Date.now() - publishAt < PUBLISH_WINDOW && beforeIds.indexOf(id) < 0;
        if (isNew) {
          publishAt = 0;
          setHash(id);
          revealed = id;
          reveal(id, true);
        }
      }
      queue();
    });
    observer.observe(box, { childList: true, subtree: true });
  }

  function start() {
    if (!wrap()) return;
    publishAt = 0;
    beforeIds = [];
    revealed = '';
    markLinks();
    watch();
    primeLazy();
    queue();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  document.addEventListener('pjax:complete', start);
  /* 手动改 hash（或从别处跳回来）也要能定位：replaceState 不触发 hashchange，这里兜一下 */
  window.addEventListener('hashchange', function () {
    var id = hashId();
    if (id && id !== revealed) { revealed = id; reveal(id, true); }
  });
})();
