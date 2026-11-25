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
!function(){"use strict";var e=".ph-app",t="ph-hide",n=/[^0-9a-z\u4e00-\u9fa5]+/g;function r(e){return String(e||"").toLowerCase().replace(n,"")}var o=!1,a=0,i=null,u=null,l=null;function c(){a=0;var e=document.documentElement;e.style.setProperty("--ph-top",function(){var e=document.getElementById("page-header"),t=document.getElementById("nav");if(!e||!t)return 58;var n=e.classList.contains("nav-fixed"),r=e.classList.contains("nav-visible");if(!n&&!r)return 0;var o=t.getBoundingClientRect();return o.bottom>0?Math.round(o.bottom):58}()+"px"),l&&e.style.setProperty("--ph-headh",Math.round(l.offsetHeight)+"px")}function d(){a||(a=requestAnimationFrame(c))}function s(){var n=document.querySelector(e);if(n&&"1"!==n.getAttribute("data-ph-search")){var a=n.querySelector(".ph-search-input");if(a){n.setAttribute("data-ph-search","1"),l=n.querySelector(".ph-head"),function(){c();var e=document.getElementById("page-header");o||(o=!0,window.addEventListener("resize",d),window.addEventListener("scroll",d,{passive:!0})),e&&e!==i&&window.MutationObserver&&(u&&u.disconnect(),i=e,(u=new MutationObserver(d)).observe(e,{attributes:!0,attributeFilter:["class"]}))}(),c();for(var s=n.querySelector(".ph-search-clear"),h=n.querySelector(".ph-empty"),f=n.querySelector(".ph-count b"),v=n.querySelectorAll(".ph-panel"),p=0,y=0;y<v.length;y++){var g=v[y].querySelectorAll("tbody tr");v[y].setAttribute("data-ph-total",String(g.length)),p+=g.length}p||(p=parseInt(f&&f.textContent||"0",10)||0);for(var m=0;m<v.length;m++)for(var b=v[m].querySelectorAll("tbody tr"),S=0;S<b.length;S++){var q=b[S].querySelector(".ph-key");b[S].setAttribute("data-ph-key",r(q?q.textContent:b[S].textContent))}a.addEventListener("input",w),a.addEventListener("keydown",(function(e){"Escape"===e.key&&(a.value="",w(),a.blur())})),s&&s.addEventListener("click",(function(){a.value="",w(),a.focus()}));for(var E=n.querySelectorAll(".ph-radio"),A=0;A<E.length;A++)E[A].addEventListener("change",L);w()}}function L(){var e=function(e){for(var t=e.querySelectorAll(".ph-radio"),n=e.querySelectorAll(".ph-panel"),r=0;r<t.length;r++)if(t[r].checked&&n[r])return n[r];return n[0]||null}(n),o=r(a.value),i=o?function(e){if(!e)return 0;for(var n=e.querySelectorAll("tbody tr"),r=0,o=0;o<n.length;o++)n[o].classList.contains(t)||r++;return r}(e):parseInt(e&&e.getAttribute("data-ph-total")||"0",10);f&&(f.textContent=String(i)),h&&(h.hidden=!(o&&0===i)),s&&(s.hidden=!a.value)}function w(){for(var e=r(a.value),n=String(a.value).trim().toLowerCase().split(/\s+/).filter((function(e){return r(e)})),o=0;o<v.length;o++)for(var i=v[o].querySelectorAll("tbody tr"),u=0;u<i.length;u++){var l=!0;if(e){var c=i[u].getAttribute("data-ph-key");if(c||(c=r(i[u].textContent)),n.length>1){l=!0;for(var d=0;d<n.length&&l;d++)-1===c.indexOf(r(n[d]))&&(l=!1)}else l=-1!==c.indexOf(e)}i[u].classList.toggle(t,!l)}L()}}function h(){if(s(),!document.querySelector(e)&&"undefined"!=typeof MutationObserver){var t=window.setTimeout((function(){n.disconnect()}),6e4),n=new MutationObserver((function(){document.querySelector(e)&&(n.disconnect(),window.clearTimeout(t),s())}));n.observe(document.body,{childList:!0,subtree:!0})}}"loading"===document.readyState?document.addEventListener("DOMContentLoaded",h):h(),["pjax:complete","pjax:success"].forEach((function(e){document.addEventListener(e,(function(){setTimeout(h,0)}))})),document.addEventListener("keydown",(function(e){if(!("/"!==e.key||e.ctrlKey||e.metaKey||e.altKey)){var t=e.target;if(!t||"INPUT"!==t.tagName&&"TEXTAREA"!==t.tagName&&!t.isContentEditable){var n=document.querySelector(".ph-app .ph-search-input");n&&(e.preventDefault(),n.focus())}}}))}();