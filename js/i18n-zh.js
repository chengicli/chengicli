/*!
 * 简繁切换（简体 ⇄ 繁體）
 * ------------------------------------------------------------------
 * 右侧按钮点击循环，界面文案与文章正文一起转换。
 * - 只处理文本节点，不碰属性（URL / class / alt 安全）
 * - 跳过代码块、预格式化块、脚本、SVG、MathJax、iframe 等
 * - 切回简体时从缓存还原原文，不做反向转换，保证 100% 无损
 * - 兼容 pjax：换页后重新挂载按钮并重新转换
 *
 * 词典由 _gen-dict.js 生成（OpenCC 派生），运行时不依赖 OpenCC。
 * 关闭方式：删掉 _config.chengic.yml 的 inject.bottom 里那一行即可。
 */
;(function () {
  'use strict'

  var CFG = window.__I18N__ || {}
  var STORAGE_KEY = CFG.storageKey || 'chengic-lang'
  var DICT_URL = CFG.dictUrl || '/js/lib/zh-hant-dict.js?v=20261112b'
  var HANS = 'zh-Hans'
  var HANT = 'zh-Hant'

  var SKIP_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'KBD', 'SAMP', 'TEXTAREA', 'NOSCRIPT', 'IFRAME', 'CANVAS', 'SVG', 'MATH', 'MJX-CONTAINER']
  var CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/

  var dictChars = null
  var dictPhrases = null
  var dictRe = null
  var loading = null

  // ---------- 状态 ----------
  function readLang () {
    try {
      return localStorage.getItem(STORAGE_KEY) === HANT ? HANT : HANS
    } catch (e) {
      return HANS
    }
  }

  function writeLang (lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch (e) { /* 隐私模式下静默失败 */ }
  }

  // ---------- 词典 ----------
  // 把全局词典编译成「单字表 + 词组正则」。返回是否成功。
  function initDict () {
    var d = window.__ZH_HANT__
    if (!d || !d.chars) return false
    dictChars = d.chars
    dictPhrases = d.phrases
    // 长词优先，保证「转台干涉」整体命中而不是被拆成「转台」+「干」
    var keys = Object.keys(dictPhrases).sort(function (a, b) { return b.length - a.length })
    dictRe = keys.length
      ? new RegExp(keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }).join('|'), 'g')
      : null
    return true
  }

  function loadDict (done) {
    if (dictRe) return done(true)
    if (initDict()) return done(true)          // 词典已被其它脚本提前载入
    if (loading) return loading.push(done)

    loading = [done]
    var s = document.createElement('script')
    s.src = DICT_URL
    s.async = true
    s.onload = s.onerror = function () {
      var ok = initDict() === true
      if (!ok) {
        unlockPaint()   // 词典挂了也要让页面可见，宁可显示简体
        if (window.console) console.warn('[i18n] 词典加载失败，简繁切换不可用：' + DICT_URL)
      }
      var queue = loading
      loading = null
      queue.forEach(function (fn) { fn(ok) })
    }
    document.head.appendChild(s)
  }

  function byChars (str) {
    return str.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, function (c) {
      return dictChars[c] || c
    })
  }

  // 词组整体替换，未命中的片段才走单字表（词组结果不能再过一遍单字）
  function toTrad (str) {
    if (!dictRe) return byChars(str)
    var out = ''
    var last = 0
    str.replace(dictRe, function (m, offset) {
      out += byChars(str.slice(last, offset)) + dictPhrases[m]
      last = offset + m.length
      return m
    })
    return out + byChars(str.slice(last))
  }

  // ---------- 文本节点遍历 ----------
  function skipped (node) {
    var p = node.parentNode
    if (!p || p.nodeType !== 1) return true
    if (SKIP_TAGS.indexOf(p.nodeName) > -1) return true
    if (p.closest) {
      if (p.closest('.notranslate')) return true
      if (p.closest('#translateLink')) return true
    }
    return false
  }

  function textNodes (root) {
    if (!root) return []
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (skipped(node)) return NodeFilter.FILTER_REJECT
        if (!node.nodeValue || !CJK.test(node.nodeValue)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    var list = []
    var n
    while ((n = walker.nextNode())) list.push(n)
    return list
  }

  // ---------- 应用 / 还原 ----------
  function applyTrad () {
    if (!dictChars) return false
    var nodes = textNodes(document.body)
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]
      if (n.__hans === undefined) n.__hans = n.nodeValue     // 首次转换前留一份原文
      var next = toTrad(n.__hans)
      if (next !== n.nodeValue) n.nodeValue = next
    }
    document.documentElement.setAttribute('data-lang', HANT)
    unlockPaint()
    return true
  }

  // 解除首屏遮罩（head 里的守卫脚本加的），失败路径也要解，不能把人挡在外面
  function unlockPaint () {
    document.documentElement.classList.remove('i18n-pending')
  }

  function applyHans () {
    var nodes = textNodes(document.body)
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]
      if (n.__hans !== undefined && n.nodeValue !== n.__hans) n.nodeValue = n.__hans
    }
    document.documentElement.setAttribute('data-lang', HANS)
    unlockPaint()
  }

  // ---------- 按钮 ----------
  function updateButton (lang) {
    var btn = document.getElementById('translateLink')
    if (!btn) return
    if (lang === HANT) {
      btn.textContent = CFG.labelHans || '简'
      btn.title = CFG.titleHans || '切换为简体中文'
    } else {
      btn.textContent = CFG.labelHant || '繁'
      btn.title = CFG.titleHant || '切換為繁體中文'
    }
  }

  function toggle () {
    if (readLang() === HANT) {
      writeLang(HANS)
      applyHans()
      updateButton(HANS)
      return
    }
    // 切繁体：先给按钮反馈，词典没加载好就回滚，避免「点了像没点」
    updateButton(HANT)
    loadDict(function (ok) {
      if (!ok) {
        updateButton(HANS)
        return
      }
      writeLang(HANT)
      if (!applyTrad()) updateButton(HANS)
    })
  }

  function mount () {
    // 优先放在常驻区（和原来的 AI 按钮一样直接可见），退而求其次放折叠区
    var box = document.getElementById('rightside-config-show') ||
      document.getElementById('rightside-config-hide')
    if (!box) return
    var btn = document.getElementById('translateLink')
    if (!btn) {
      btn = document.createElement('button')
      btn.id = 'translateLink'
      btn.type = 'button'
      btn.addEventListener('click', toggle)
      box.insertBefore(btn, box.firstChild)
    }
    updateButton(readLang())
  }

  // ---------- 启动 ----------
  function boot () {
    mount()
    if (readLang() === HANT) {
      loadDict(function () {
        applyTrad()
        updateButton(HANT)
      })
    } else {
      document.documentElement.setAttribute('data-lang', HANS)
      unlockPaint()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  // pjax 换页：右侧按钮与页面内容都会被替换，重新挂载并保持当前语言
  document.addEventListener('pjax:complete', function () {
    mount()
    if (readLang() === HANT) {
      loadDict(function () {
        applyTrad()
        updateButton(HANT)
      })
    }
  })
})()
