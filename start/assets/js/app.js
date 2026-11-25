/* ============================================================================
 * nav-start · 起始页脚本
 * 数据都在本文件顶部的 ENGINES / GROUPS 里，改站点只需要动这里。
 * ========================================================================== */

/* ---------- 搜索引擎 ---------- */
const ENGINES = [
  { id: 'bing',   name: 'Bing',   url: 'https://www.bing.com/search?q=%s' },
  // { id: 'baidu',  name: '百度',   url: 'https://www.baidu.com/s?wd=%s' },
  // { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=%s' },
  // { id: 'zhihu',  name: '知乎',   url: 'https://www.zhihu.com/search?type=content&q=%s' },
  { id: 'site',   name: '站内',   url: 'https://www.bing.com/search?q=site%3Alichengic.com+%s' }
];

/* ---------- 默认站点分组 ----------
 * 这里只放「可以公开」的通用站点，作为首次访问的初值。
 * 之后在页面上改的站点都存进浏览器 localStorage（key: nav-sites-v1），
 * 不会再动这个文件，别人访问你的站点也看不到这些本地改动。
 * icon 规则（沿用 2026-11-24 的 toolb.cn 方案）：
 *   'https://...' → 完整地址，原样使用
 *   '/xxx'        → 站内路径
 *   '域名'         → 自动拼成 https://toolb.cn/favicon/域名
 *   留空 ''        → 自动按 url 的域名去取（加新站点只写 name + url 即可）
 * 取不到时卡片自动退回首字母，不会出现裂图。 */
const DEFAULT_GROUPS = [
  {
    title: '常用地址',
    desc: 'chengicli',
    items: [
      { name: 'GitHub', url: 'https://github.com/', icon: '', note: 'github.com' },
      { name: '百度', url: 'https://www.baidu.com/', icon: '', note: 'baidu.com' },
      { name: '知乎', url: 'https://www.zhihu.com/', icon: '', note: 'zhihu.com' },
      { name: '哔哩哔哩', url: 'https://www.bilibili.com/', icon: '', note: 'bilibili.com' },
      { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: '', note: 'chat.deepseek.com' },
      { name: '掘金', url: 'https://juejin.cn/', icon: '', note: 'juejin.cn' },
      { name: 'CSDN', url: 'https://www.csdn.net/', icon: '', note: 'csdn.net' },
      { name: '微博', url: 'https://weibo.com/', icon: '', note: 'weibo.com' },
      { name: '淘宝', url: 'https://www.taobao.com/', icon: '', note: 'taobao.com' },
      { name: '京东', url: 'https://www.jd.com/', icon: '', note: 'jd.com' },
      { name: '网易云音乐', url: 'https://music.163.com/', icon: '', note: 'music.163.com' },
      { name: '阿里云', url: 'https://www.aliyun.com/', icon: '', note: 'aliyun.com' }
    ]
  }
];

const THEME_KEY = 'nav-theme';
const ENGINE_KEY = 'nav-engine';
const SITES_KEY = 'nav-sites-v1';
const SITES_DEFAULT_KEY = 'nav-sites-default-v1';

/* 当前展示的数据：首次访问用 DEFAULT_GROUPS，之后一律以 localStorage 为准。
 * SITES_DEFAULT_KEY 记录「上次采用的默认数据指纹」：
 * 如果本地数据没被用户改过，改完代码里的 DEFAULT_GROUPS 刷新就会自动跟随。 */
let groups = loadGroups();
let editMode = false;

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

/* ---------- 图标地址解析 ----------
 * 2026-11-25：统一走 toolb.cn 的 favicon 接口，格式是「接口前缀 + 完整网址」：
 *   淘宝   https://toolb.cn/favicon/https://www.taobao.com/
 *   DeepSeek https://toolb.cn/favicon/https://chat.deepseek.com/
 * icon 字段规则：
 *   ''             → 用站点 url 自动拼（推荐，加站点只写 name + url）
 *   '/xxx'         → 站内图片，原样使用（接口取不到站内路径）
 *   'taobao.com'   → 补上 https:// 再拼接口
 *   'https://...'  → 带图片后缀的直接当图片用，否则当作站点地址拼接口
 * 取不到时卡片自动退回首字母，不会出现裂图。 */
const FAVICON_AUTO = 'https://toolb.cn/favicon/';

function withProtocol(url) {
  return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}

function iconSrcFor(item) {
  const raw = (item.icon || '').trim();
  if (raw) {
    if (raw.charAt(0) === '/') return raw;                    // 站内路径（本站 favicon）
    if (/^https?:\/\//i.test(raw)) {
      if (/\.(ico|png|svg|jpe?g|webp|gif)(\?.*)?$/i.test(raw)) return raw;  // 写死的图片地址
      return FAVICON_AUTO + raw;                              // 写的是站点地址 → 走接口
    }
    return FAVICON_AUTO + withProtocol(raw);                  // 只写域名 → 补协议再走接口
  }

  // 留空 → 用完整网址拼接口：https://toolb.cn/favicon/https://xxx/
  const url = (item.url || '').trim();
  if (!url || url.charAt(0) === '/') return '';
  return FAVICON_AUTO + withProtocol(url);
}

/* ---------- 本地保存（个人站点只留在当前浏览器） ---------- */
function cloneGroups(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeGroups(data) {
  if (!Array.isArray(data)) return null;
  const out = [];
  data.forEach((g) => {
    if (!g || typeof g !== 'object') return;
    const title = String(g.title || '').trim();
    if (!title) return;
    const items = Array.isArray(g.items) ? g.items : [];
    out.push({
      title,
      desc: String(g.desc || ''),
      items: items
        .filter((it) => it && String(it.name || '').trim() && String(it.url || '').trim())
        .map((it) => ({
          name: String(it.name).trim(),
          url: String(it.url).trim(),
          icon: String(it.icon || ''),
          note: String(it.note || '')
        }))
    });
  });
  return out.length ? out : null;
}

/* 简单字符串指纹，用来判断本地数据是不是「原封不动的默认数据」 */
function hashGroups(data) {
  const s = JSON.stringify(data);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

function loadGroups() {
  try {
    const raw = localStorage.getItem(SITES_KEY);
    if (!raw) {
      localStorage.setItem(SITES_DEFAULT_KEY, hashGroups(DEFAULT_GROUPS));
      return cloneGroups(DEFAULT_GROUPS);
    }

    const data = normalizeGroups(JSON.parse(raw));
    if (!data) return cloneGroups(DEFAULT_GROUPS);

    // 本地数据与上次记录的默认指纹一致 → 用户没改过，直接跟随代码里的新默认
    const lastDef = localStorage.getItem(SITES_DEFAULT_KEY);
    const defHash = hashGroups(DEFAULT_GROUPS);
    if (lastDef && lastDef === hashGroups(data) && lastDef !== defHash) {
      localStorage.setItem(SITES_DEFAULT_KEY, defHash);
      return cloneGroups(DEFAULT_GROUPS);
    }
    return data;
  } catch (e) {}
  return cloneGroups(DEFAULT_GROUPS);
}

function saveGroups() {
  try {
    localStorage.setItem(SITES_KEY, JSON.stringify(groups));
  } catch (e) {
    showToast('保存失败：浏览器禁用了本地存储');
  }
}

/* ---------- 渲染站点卡片 ---------- */
function renderGroups() {
  const wrap = $('groups');
  // 先清空：编辑模式每次保存/切换都会重绘，不清空就会一份份追加（分组重复）
  wrap.innerHTML = '';
  const frag = document.createDocumentFragment();

  groups.forEach((group, gi) => {
    // 非编辑模式下空分组直接不显示（删空站点后分类自动消失）
    if (!editMode && group.items.length === 0) return;

    const section = document.createElement('section');
    section.className = 'group';

    const head = document.createElement('div');
    head.className = 'group-head';
    head.innerHTML =
      '<h2 class="group-title"></h2>' +
      '<span class="group-desc"></span>' +
      '<span class="group-count"></span>' +
      (editMode
        ? '<span class="group-ops">' +
            '<button class="group-edit" type="button" data-editgroup="' + gi + '" title="修改分组名称和描述">编辑分组</button>' +
            '<button class="group-add" type="button" data-add="' + gi + '" title="在这一组添加站点">＋ 添加</button>' +
            '<button class="group-del" type="button" data-delgroup="' + gi + '" title="删除整组">×</button>' +
          '</span>'
        : '');
    head.querySelector('.group-title').textContent = group.title;
    head.querySelector('.group-desc').textContent = group.desc || '';
    head.querySelector('.group-count').textContent = group.items.length + ' 个站点';
    section.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'group-grid';

    group.items.forEach((item, i) => {
      const el = document.createElement(editMode ? 'div' : 'a');
      el.className = 'site';
      el.style.setProperty('--i', i);
      // data-site 供自定义右键菜单定位「哪一组第几个」
      el.dataset.site = gi + ':' + i;
      if (editMode) {
        el.dataset.edit = el.dataset.site;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', '编辑 ' + item.name);
      } else {
        el.href = item.url;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }

      const icon = document.createElement('span');
      icon.className = 'site-icon';

      const initial = document.createElement('span');
      initial.className = 'site-initial';
      initial.textContent = item.name.trim().charAt(0).toUpperCase();

      /* 图标三档来源（2026-11-25）：
         1. icon 写了本地路径（/ 开头）→ 用本地文件（自己下载好的，最快最稳）
         2. icon 写了 http(s) 图片地址 → 直接用
         3. icon 留空 → **自动**拼 toolb.cn 接口：https://toolb.cn/favicon/<完整网址>
            这样以后加站点只写 name + url 就行，不用再管图标
         取不到（或 IP 站点、对方没 favicon）→ 退回首字母圆标 */
      const src = iconSrcFor(item);
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', () => {
          icon.classList.add('is-broken');
        });
        icon.appendChild(img);
      } else {
        icon.classList.add('is-broken');
      }

      icon.appendChild(initial);

      const body = document.createElement('span');
      body.className = 'site-body';
      const name = document.createElement('span');
      name.className = 'site-name';
      name.textContent = item.name;
      const note = document.createElement('span');
      note.className = 'site-note';
      note.textContent = item.note;
      body.appendChild(name);
      body.appendChild(note);

      el.appendChild(icon);
      el.appendChild(body);

      if (editMode) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'site-del';
        del.dataset.del = gi + ':' + i;
        del.title = '删除 ' + item.name;
        del.setAttribute('aria-label', '删除 ' + item.name);
        del.textContent = '×';
        el.appendChild(del);
      }

      grid.appendChild(el);
    });

    if (editMode && group.items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'group-empty';
      empty.textContent = '这个分组是空的，点「＋ 添加」加站点，或点右上角 × 删掉分组';
      grid.appendChild(empty);
    }

    section.appendChild(grid);
    frag.appendChild(section);
  });

  wrap.appendChild(frag);
}

/* ---------- 时钟 / 问候 / 日期 ---------- */
const pad = (n) => String(n).padStart(2, '0');
const WEEK = '日一二三四五六';

function greetFor(h) {
  if (h < 5) return '夜深了';
  if (h < 8) return '早上好';
  if (h < 11) return '上午好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  if (h < 23) return '晚上好';
  return '夜深了';
}

function tickClock() {
  const d = new Date();
  $('clock-time').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
  $('clock-sec').textContent = pad(d.getSeconds());
  $('date').textContent =
    d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + WEEK[d.getDay()];
  $('greet').textContent = greetFor(d.getHours());
}

/* ---------- 主题 ---------- */
function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  // body.DarkMode 是过场遮罩「夜色层」的开关，和主题状态保持一致
  document.body.classList.toggle('DarkMode', theme === 'dark');
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  const meta = $('meta-theme-color');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1c1c1c' : '#fafafa');
  $('theme-toggle').setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
}

/* ---------- 昼夜切换过场（博客「轻」档同款） ----------
   暖色天空盖满整屏 → 500ms 太阳月亮互换 → 750ms 开始整层淡出（.75s）。
   与博客一致：连点第二次直接收尾不重播；系统「减少动态效果」瞬时切换。 */
let nightOverlay = null;

function clearNightOverlay() {
  const st = nightOverlay;
  nightOverlay = null;
  if (!st) return;
  st.timers.forEach((t) => clearTimeout(t));
  if (st.node.parentNode) st.node.remove();
}

function playThemeTransition(toDark) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || nightOverlay) {
    clearNightOverlay();
    applyTheme(toDark ? 'dark' : 'light');
    return;
  }

  const sky = document.createElement('div');
  sky.className = 'Cuteen_DarkSky';
  sky.innerHTML =
    '<div class="Cuteen_DarkPlanet">' +
      '<div class="Cuteen_Sun"></div>' +
      '<div class="Cuteen_Moon"></div>' +
    '</div>';
  document.body.appendChild(sky);

  const sun = sky.querySelector('.Cuteen_Sun');
  const moon = sky.querySelector('.Cuteen_Moon');
  sun.style.opacity = toDark ? '1' : '0';
  moon.style.opacity = toDark ? '0' : '1';

  const st = { node: sky, timers: [] };
  nightOverlay = st;

  // 先让浏览器按“旧主题”算一次样式，再切主题，夜色层才会真正渐变而不是硬跳
  void sky.offsetHeight;
  applyTheme(toDark ? 'dark' : 'light');

  st.timers.push(setTimeout(() => {
    if (nightOverlay !== st) return;
    sun.style.opacity = toDark ? '0' : '1';
    moon.style.opacity = toDark ? '1' : '0';
  }, 500));

  st.timers.push(setTimeout(() => {
    if (nightOverlay !== st) return;
    sky.style.transition = 'opacity 750ms ease';
    sky.style.opacity = '0';
    st.timers.push(setTimeout(() => {
      if (nightOverlay === st) nightOverlay = null;
      if (sky.parentNode) sky.remove();
    }, 750));
  }, 750));
}

function toggleTheme() {
  playThemeTransition(root.getAttribute('data-theme') !== 'dark');
}

function initTheme() {
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  $('theme-toggle').addEventListener('click', toggleTheme);
}

/* ---------- 搜索 ---------- */
let currentEngine = ENGINES[0].id;

function engineById(id) {
  return ENGINES.find((e) => e.id === id) || ENGINES[0];
}

function looksLikeUrl(text) {
  if (/\s/.test(text)) return false;
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(text);
}

function runSearch(raw) {
  const q = raw.trim();
  if (!q) {
    $('search-input').focus();
    return;
  }
  if (looksLikeUrl(q)) {
    window.location.href = /^https?:\/\//i.test(q) ? q : 'https://' + q;
    return;
  }
  const engine = engineById(currentEngine);
  window.location.href = engine.url.replace('%s', encodeURIComponent(q));
}

function buildEngineMenu() {
  const menu = $('engine-menu');
  menu.innerHTML = '';
  ENGINES.forEach((engine) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'option');
    btn.dataset.id = engine.id;
    btn.innerHTML = '<span></span><span class="tick" aria-hidden="true">✓</span>';
    btn.firstChild.textContent = engine.name;
    btn.addEventListener('click', () => {
      currentEngine = engine.id;
      try { localStorage.setItem(ENGINE_KEY, currentEngine); } catch (e) {}
      syncEngineMenu();
      closeEngineMenu();
      $('search-input').focus();
    });
    menu.appendChild(btn);
  });
}

function syncEngineMenu() {
  const engine = engineById(currentEngine);
  $('engine-name').textContent = engine.name;
  document.querySelectorAll('#engine-menu button').forEach((btn) => {
    btn.setAttribute('aria-selected', btn.dataset.id === currentEngine ? 'true' : 'false');
  });
}

function openEngineMenu() {
  $('engine-menu').hidden = false;
  $('engine-btn').setAttribute('aria-expanded', 'true');
}

function closeEngineMenu() {
  $('engine-menu').hidden = true;
  $('engine-btn').setAttribute('aria-expanded', 'false');
}

function initSearch() {
  try {
    const saved = localStorage.getItem(ENGINE_KEY);
    if (saved && ENGINES.some((e) => e.id === saved)) currentEngine = saved;
  } catch (e) {}

  buildEngineMenu();
  syncEngineMenu();

  $('engine-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if ($('engine-menu').hidden) openEngineMenu();
    else closeEngineMenu();
  });

  $('engine-menu').addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', () => {
    if (!$('engine-menu').hidden) closeEngineMenu();
  });

  $('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch($('search-input').value);
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

    if (e.key === 'Escape') {
      if (!$('engine-menu').hidden) closeEngineMenu();
      else if (typing) e.target.blur();
      return;
    }

    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      $('search-input').focus();
      $('search-input').select();
    }
  });
}

/* ---------- 打字副标题 ---------- */
function initTypewriter() {
  const el = $('typewriter');
  const phrases = [
    '把常用的站点，放在伸手就能碰到的地方',
    '折腾不止，记录不停',
    '搜索、逛逛、发会儿呆，然后再出发'
  ];

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = phrases[0];
    return;
  }

  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function step() {
    const phrase = phrases[phraseIndex];
    if (!deleting) {
      charIndex += 1;
      el.textContent = phrase.slice(0, charIndex);
      if (charIndex >= phrase.length) {
        deleting = true;
        setTimeout(step, 2400);
      } else {
        setTimeout(step, 85 + Math.random() * 60);
      }
      return;
    }
    charIndex -= 1;
    el.textContent = phrase.slice(0, charIndex);
    if (charIndex <= 0) {
      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      setTimeout(step, 420);
    } else {
      setTimeout(step, 32);
    }
  }

  setTimeout(step, 350);
}

/* ---------- 顶栏滚动状态 ---------- */
function initTopbar() {
  const bar = $('topbar');
  let ticking = false;
  function update() {
    bar.classList.toggle('is-stuck', window.scrollY > 8);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

/* ---------- 轻提示（可带一个「撤销」动作） ---------- */
let toastTimer = null;
function showToast(message, action) {
  let el = $('rm-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rm-toast';
    document.body.appendChild(el);
  }

  el.innerHTML = '';
  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  el.appendChild(text);

  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      el.classList.remove('is-show');
      clearTimeout(toastTimer);
      action.onClick();
    });
    el.appendChild(btn);
  }

  el.classList.toggle('has-action', !!action);
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), action ? 5000 : 1600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制');
    return;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('已复制');
    } catch (err) {
      showToast('复制失败');
    }
    ta.remove();
  }
}

/* ---------- 移除单个站点（右键菜单与编辑模式共用，带撤销） ---------- */
function removeSiteAt(gi, i) {
  const group = groups[gi];
  if (!group || !group.items[i]) return;

  const removed = group.items.splice(i, 1)[0];

  // 删空后连同分组一起去掉，但至少保留一个分组
  let removedGroup = null;
  if (group.items.length === 0 && groups.length > 1) {
    removedGroup = groups.splice(gi, 1)[0];
  }

  saveGroups();
  renderGroups();
  showToast('已移除「' + removed.name + '」', {
    label: '撤销',
    onClick: () => {
      if (removedGroup) {
        groups.splice(gi, 0, removedGroup);
        groups[gi].items.splice(i, 0, removed);
      } else {
        groups[gi].items.splice(i, 0, removed);
      }
      saveGroups();
      renderGroups();
      showToast('已恢复「' + removed.name + '」');
    }
  });
}

/* ---------- 自定义右键菜单（对应博客 cursor.js 的菜单，精简重组） ---------- */
function initContextMenu() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const ICON = {
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    forward: '<path d="m12 5 7 7-7 7"/><path d="M5 12h14"/>',
    reload: '<path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 6.36 2.64L21 8"/><path d="M21 3v5h-5"/>',
    top: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect width="12" height="8" x="6" y="14"/>'
  };

  const svg = (paths) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';

  const item = (act, label, icon) =>
    '<button class="rm-item" type="button" data-act="' + act + '" role="menuitem">' +
    svg(icon) + '<span class="rm-txt">' + label + '</span></button>';

  const iconItem = (act, label, icon) =>
    '<button class="rm-item" type="button" data-act="' + act + '" title="' + label +
    '" aria-label="' + label + '" role="menuitem">' + svg(icon) + '</button>';

  const menu = document.createElement('div');
  menu.id = 'rm-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.innerHTML =
    '<div class="rm-group rm-quick">' +
      iconItem('back', '后退', ICON.back) +
      iconItem('forward', '前进', ICON.forward) +
      iconItem('reload', '刷新', ICON.reload) +
      iconItem('top', '回到顶部', ICON.top) +
    '</div>' +
    '<div class="rm-group" data-group="text" hidden>' +
      item('copyText', '复制文字', ICON.copy) +
      item('baiduSearch', '百度搜索', ICON.search) +
    '</div>' +
    '<div class="rm-group" data-group="link" hidden>' +
      item('openLink', '新标签打开', ICON.external) +
      item('copyLink', '复制链接', ICON.link) +
    '</div>' +
    '<div class="rm-group" data-group="site" hidden>' +
      item('editSite', '修改站点', ICON.pencil) +
      item('removeSite', '移除站点', ICON.trash) +
    '</div>' +
    '<div class="rm-group" data-group="img" hidden>' +
      item('saveImg', '保存图片', ICON.download) +
      item('copyImg', '复制图片地址', ICON.image) +
    '</div>' +
    '<div class="rm-group">' +
      item('theme', '切换昼夜', ICON.moon) +
      item('blog', '回到博客', ICON.home) +
      item('fullscreen', '切换全屏', ICON.maximize) +
      item('print', '打印页面', ICON.print) +
    '</div>';
  document.body.appendChild(menu);

  const ctx = { text: '', link: null, img: null, site: null };
  let hideTimer = null;

  function hideMenu() {
    menu.classList.remove('is-open');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { menu.hidden = true; }, 160);
  }

  function showMenu(x, y) {
    clearTimeout(hideTimer);
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    const pad = 8;
    let left = x + 2;
    let top = y + 2;
    if (left + rect.width > window.innerWidth - pad) left = Math.max(pad, x - rect.width - 2);
    if (top + rect.height > window.innerHeight - pad) top = Math.max(pad, y - rect.height - 2);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    requestAnimationFrame(() => menu.classList.add('is-open'));
  }

  function runAction(act) {
    switch (act) {
      case 'back': window.history.back(); break;
      case 'forward': window.history.forward(); break;
      case 'reload': window.location.reload(); break;
      case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'copyText': copyText(ctx.text); break;
      case 'baiduSearch':
        if (ctx.text) window.open('https://www.baidu.com/s?wd=' + encodeURIComponent(ctx.text), '_blank', 'noopener');
        break;
      case 'openLink':
        if (ctx.link) window.open(ctx.link.href, '_blank', 'noopener');
        break;
      case 'copyLink':
        if (ctx.link) copyText(ctx.link.href);
        break;
      case 'editSite':
        if (ctx.site) {
          const [g, i] = ctx.site.dataset.site.split(':').map(Number);
          openSiteForm('edit', g, i);
        }
        break;
      case 'removeSite':
        if (ctx.site) {
          const [g, i] = ctx.site.dataset.site.split(':').map(Number);
          removeSiteAt(g, i);
        }
        break;
      case 'saveImg':
        if (ctx.img) {
          const a = document.createElement('a');
          a.href = ctx.img.src;
          a.download = (ctx.img.src.split('/').pop() || 'image').split('?')[0];
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        break;
      case 'copyImg':
        if (ctx.img) copyText(ctx.img.src);
        break;
      case 'theme': toggleTheme(); break;
      case 'blog': window.location.href = '/'; break;
      case 'fullscreen':
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        break;
      case 'print': window.print(); break;
    }
  }

  document.addEventListener('contextmenu', (e) => {
    const target = e.target;
    if (target.closest('input, textarea, [contenteditable="true"]')) return;

    e.preventDefault();

    ctx.text = String(window.getSelection() || '').trim();
    ctx.link = target.closest('a');
    ctx.img = target.closest('img');
    ctx.site = target.closest('[data-site]');

    menu.querySelector('[data-group="text"]').hidden = !ctx.text;
    menu.querySelector('[data-group="link"]').hidden = !ctx.link;
    menu.querySelector('[data-group="img"]').hidden = !ctx.img;
    menu.querySelector('[data-group="site"]').hidden = !ctx.site;

    showMenu(e.clientX, e.clientY);
  });

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const act = btn.dataset.act;
    hideMenu();
    runAction(act);
  });

  document.addEventListener('click', hideMenu);
  window.addEventListener('scroll', hideMenu, { passive: true });
  window.addEventListener('resize', hideMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideMenu();
  });
}

/* ---------- 夜间壁纸预加载 ----------
   夜间壁纸是原图，首屏不能下载；空闲时提前拉一次，切夜间时基本已是缓存状态。 */
function preloadNightWallpaper() {
  if (root.getAttribute('data-theme') === 'dark') return;
  const mobile = window.matchMedia('(max-width: 768px)').matches;
  const img = new Image();
  img.src = mobile
    ? '/Background-wallpaper/phone-Night-background.webp'
    : '/Background-wallpaper/computer-Night-background.webp';
}

/* ---------- 页脚：站点运行 / 恋爱计时 ----------
   算法同博客（footer-time.js / love-days.js）：按真实日历拆整年 / 整月 / 剩余天数，
   为 0 的单位整段省略，数字用 <b> 包住走主题色。 */
const SITE_START = new Date('2023-05-03T11:50:35');
const LOVE_START = new Date('2026-07-13T00:00:00');
const DAY_MS = 86400000;

function startOfDay(d) {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function addClamped(d, yDelta, mDelta) {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setDate(1);
  x.setFullYear(x.getFullYear() + yDelta, x.getMonth() + mDelta, 1);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

function diffYMD(start, end) {
  let y = 0;
  let m = 0;
  while (addClamped(start, y + 1, 0) <= end) y += 1;
  while (addClamped(start, y, m + 1) <= end) m += 1;
  const cursor = addClamped(start, y, m);
  return { years: y, months: m, days: Math.floor((end - cursor) / DAY_MS) };
}

function fmtYMD(p) {
  const parts = [];
  if (p.years) parts.push('<b>' + p.years + '</b>年');
  if (p.months) parts.push('<b>' + p.months + '</b>月');
  if (p.days || !parts.length) parts.push('<b>' + p.days + '</b>天');
  return parts.join('');
}

function updateFooterTime() {
  const now = new Date();
  const run = $('ftRun');
  if (run) {
    run.innerHTML = '站点运行 ' + fmtYMD(diffYMD(SITE_START, now));
    run.title = '建站至今 ' + Math.floor((now - SITE_START) / DAY_MS) + ' 天';
  }

  const love = $('ftLove');
  if (!love) return;
  const today = startOfDay(now);
  if (today < LOVE_START) {
    love.innerHTML = '还有 <b>' + Math.ceil((LOVE_START - today) / DAY_MS) + '</b> 天就到一起纪念日啦';
    return;
  }
  love.innerHTML = '已经和女朋友' + fmtYMD(diffYMD(LOVE_START, today)) + '啦';
  love.title = '在一起 ' + Math.round((today - LOVE_START) / DAY_MS) + ' 天';
}

/* ---------- 分组编辑（改名 / 改描述） ---------- */
let groupFormIndex = -1;

function openGroupForm(gi) {
  const group = groups[gi];
  if (!group) return;
  groupFormIndex = gi;
  $('g-name').value = group.title || '';
  $('g-desc').value = group.desc || '';
  $('group-sheet').querySelector('h3').textContent = '编辑分组 · ' + group.title;
  const sheet = $('group-sheet');
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  setTimeout(() => {
    $('g-name').focus();
    $('g-name').select();
  }, 60);
}

function closeGroupForm() {
  const sheet = $('group-sheet');
  sheet.classList.remove('is-open');
  setTimeout(() => { sheet.hidden = true; }, 180);
}

function submitGroupForm(e) {
  e.preventDefault();
  const gi = groupFormIndex;
  const group = groups[gi];
  if (!group) { closeGroupForm(); return; }

  const title = $('g-name').value.trim();
  if (!title) { showToast('分组名不能为空'); return; }
  if (groups.some((g, i) => i !== gi && g.title === title)) {
    showToast('已经有同名分组了');
    return;
  }

  group.title = title;
  group.desc = $('g-desc').value.trim();
  saveGroups();
  renderGroups();
  closeGroupForm();
  showToast('分组已更新');
}

/* ---------- 站点编辑（数据只存当前浏览器，不上传） ---------- */
let siteFormCtx = { mode: 'add', gi: 0, index: -1 };
let siteFormGroup = '0';

/* 自定义分组下拉：原生 select 的弹出层是系统样式改不动，这里自己画一个 */
function renderGroupOptions(value) {
  siteFormGroup = value;
  const menu = $('f-group-menu');
  menu.innerHTML = '';

  groups.forEach((g, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dropdown-item';
    btn.dataset.value = String(i);
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', String(i) === value ? 'true' : 'false');
    btn.textContent = g.title;
    menu.appendChild(btn);
  });

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'dropdown-item dropdown-new';
  newBtn.dataset.value = '__new';
  newBtn.setAttribute('role', 'option');
  newBtn.setAttribute('aria-selected', value === '__new' ? 'true' : 'false');
  newBtn.textContent = '＋ 新建分组…';
  menu.appendChild(newBtn);

  const cur = value === '__new' ? null : groups[Number(value)];
  $('f-group-btn').querySelector('.dropdown-value').textContent =
    value === '__new' ? '新建分组…' : (cur ? cur.title : '—');
  $('f-newgroup-wrap').hidden = value !== '__new';
}

/* 删除现在是「单击即删 + 5 秒撤销」，不再需要二次确认 */
function toggleEditMode() {
  editMode = !editMode;
  document.body.classList.toggle('is-editing', editMode);
  const btn = $('edit-toggle');
  btn.classList.toggle('is-active', editMode);
  btn.setAttribute('aria-pressed', String(editMode));
  btn.setAttribute('aria-label', editMode ? '退出编辑' : '编辑站点');
  $('edit-bar').hidden = !editMode;
  renderGroups();
  if (editMode) showToast('编辑模式：点卡片修改，× 删除；数据只存本机');
}

function openSiteForm(mode, gi, index) {
  siteFormCtx = { mode, gi, index };
  const isEdit = mode === 'edit';
  const item = isEdit ? groups[gi].items[index] : { name: '', url: '', note: '' };

  $('sheet-title').textContent = isEdit ? '编辑站点' : '添加站点';
  $('f-name').value = item.name || '';
  $('f-url').value = item.url || '';
  $('f-note').value = item.note || '';

  renderGroupOptions(String(gi));
  $('f-group-menu').hidden = true;
  $('f-group-btn').setAttribute('aria-expanded', 'false');
  $('f-newgroup').value = '';

  const sheet = $('site-sheet');
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  setTimeout(() => $('f-name').focus(), 60);
}

function closeSiteForm() {
  const sheet = $('site-sheet');
  sheet.classList.remove('is-open');
  setTimeout(() => { sheet.hidden = true; }, 180);
}

function submitSiteForm(e) {
  e.preventDefault();

  const name = $('f-name').value.trim();
  let url = $('f-url').value.trim();
  const note = $('f-note').value.trim();

  if (!name || !url) {
    showToast('名称和网址都要填');
    return;
  }
  if (!/^https?:\/\//i.test(url) && url.charAt(0) !== '/') {
    url = 'https://' + url;
  }
  if (/^https?:\/\//i.test(url)) {
    try {
      new URL(url);
    } catch (err) {
      showToast('网址格式不对');
      return;
    }
  }

  const selVal = siteFormGroup;
  let targetGi;
  if (selVal === '__new') {
    const newTitle = $('f-newgroup').value.trim();
    if (!newTitle) {
      showToast('给新分组起个名字');
      return;
    }
    groups.push({ title: newTitle, desc: '', items: [] });
    targetGi = groups.length - 1;
  } else {
    targetGi = Number(selVal);
  }

  const ctx = siteFormCtx;
  if (ctx.mode === 'edit') {
    const old = groups[ctx.gi].items[ctx.index];
    const updated = { name, url, note, icon: old.icon || '' };
    if (targetGi === ctx.gi) {
      groups[ctx.gi].items[ctx.index] = updated;
    } else {
      groups[ctx.gi].items.splice(ctx.index, 1);
      groups[targetGi].items.push(updated);
    }
  } else {
    groups[targetGi].items.push({ name, url, note, icon: '' });
  }

  saveGroups();
  renderGroups();
  closeSiteForm();
  showToast(ctx.mode === 'edit' ? '已更新' : '已添加');
}

function exportSites() {
  const blob = new Blob([JSON.stringify(groups, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = 'nav-sites-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast('已导出 JSON');
}

function resetSites() {
  const snapshot = cloneGroups(groups);
  groups = cloneGroups(DEFAULT_GROUPS);
  saveGroups();
  try {
    localStorage.setItem(SITES_DEFAULT_KEY, hashGroups(DEFAULT_GROUPS));
  } catch (e) {}
  renderGroups();
  showToast('已恢复默认站点', {
    label: '撤销',
    onClick: () => {
      groups = snapshot;
      saveGroups();
      renderGroups();
      showToast('已撤销');
    }
  });
}

function initSiteEditor() {
  $('edit-toggle').addEventListener('click', toggleEditMode);
  $('btn-add-site').addEventListener('click', () => openSiteForm('add', 0, -1));
  $('btn-export').addEventListener('click', exportSites);
  $('btn-reset').addEventListener('click', resetSites);
  $('btn-done').addEventListener('click', () => {
    if (editMode) toggleEditMode();
  });

  const file = $('import-file');
  $('btn-import').addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const picked = file.files && file.files[0];
    if (!picked) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = normalizeGroups(JSON.parse(String(reader.result)));
        if (!data) throw new Error('invalid');
        groups = data;
        saveGroups();
        renderGroups();
        showToast('已导入 ' + data.length + ' 个分组');
      } catch (err) {
        showToast('导入失败：不是有效的站点 JSON');
      }
      file.value = '';
    };
    reader.readAsText(picked);
  });

  $('site-form').addEventListener('submit', submitSiteForm);
  $('f-group-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('f-group-menu');
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    $('f-group-btn').setAttribute('aria-expanded', String(willOpen));
  });

  $('f-group-menu').addEventListener('click', (e) => {
    const item = e.target.closest('[data-value]');
    if (!item) return;
    e.stopPropagation();
    renderGroupOptions(item.dataset.value);
    $('f-group-menu').hidden = true;
    $('f-group-btn').setAttribute('aria-expanded', 'false');
    if (item.dataset.value === '__new') $('f-newgroup').focus();
  });

  document.addEventListener('click', () => {
    if (!$('f-group-menu').hidden) {
      $('f-group-menu').hidden = true;
      $('f-group-btn').setAttribute('aria-expanded', 'false');
    }
  });

  document.querySelectorAll('[data-close-sheet]').forEach((el) => {
    el.addEventListener('click', closeSiteForm);
  });

  $('group-form').addEventListener('submit', submitGroupForm);
  document.querySelectorAll('[data-close-group-sheet]').forEach((el) => {
    el.addEventListener('click', closeGroupForm);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('group-sheet').hidden) closeGroupForm();
      if (!$('site-sheet').hidden) closeSiteForm();
    }
    if (e.key === 'Enter') {
      const card = e.target.closest && e.target.closest('[data-edit]');
      if (card) {
        e.preventDefault();
        const [g, i] = card.dataset.edit.split(':').map(Number);
        openSiteForm('edit', g, i);
      }
    }
  });

  $('groups').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.preventDefault();
      e.stopPropagation();
      const [g, i] = del.dataset.del.split(':').map(Number);
      removeSiteAt(g, i);
      return;
    }

    const delGroup = e.target.closest('[data-delgroup]');
    if (delGroup) {
      e.preventDefault();
      e.stopPropagation();
      const gi = Number(delGroup.dataset.delgroup);
      if (groups.length <= 1) {
        showToast('至少保留一个分组');
        return;
      }
      const removedGroup = groups.splice(gi, 1)[0];
      saveGroups();
      renderGroups();
      showToast('已删除分组「' + removedGroup.title + '」', {
        label: '撤销',
        onClick: () => {
          groups.splice(gi, 0, removedGroup);
          saveGroups();
          renderGroups();
          showToast('已恢复分组');
        }
      });
      return;
    }

    const editGroup = e.target.closest('[data-editgroup]');
    if (editGroup) {
      e.preventDefault();
      e.stopPropagation();
      openGroupForm(Number(editGroup.dataset.editgroup));
      return;
    }

    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault();
      openSiteForm('add', Number(add.dataset.add), -1);
      return;
    }

    const card = e.target.closest('[data-edit]');
    if (card) {
      e.preventDefault();
      const [g, i] = card.dataset.edit.split(':').map(Number);
      openSiteForm('edit', g, i);
    }
  });
}

/* ---------- 启动 ---------- */
renderGroups();
tickClock();
setInterval(tickClock, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tickClock();
});
initTheme();
initSearch();
initTypewriter();
initTopbar();
initContextMenu();
initSiteEditor();
$('year').textContent = new Date().getFullYear();
updateFooterTime();
setInterval(updateFooterTime, 60 * 1000);

if ('requestIdleCallback' in window) {
  requestIdleCallback(preloadNightWallpaper, { timeout: 5000 });
} else {
  setTimeout(preloadNightWallpaper, 3000);
}
