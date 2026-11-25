/*!
 * pjax-relink.js —— 让「后插入的站内链接」也走 pjax、让跳转存根页不再整页刷新
 *
 * 【2026-10-28 用户报的 bug】
 *   公告栏「每日一言」悬停播放器正放着歌，点首页磁贴「无锡元基 (2)」「查看更多...」
 *   或者页脚「文章分类」，歌就停了、左下角胶囊也消失。
 *
 * 【根因 1】pjax 0.2.8 是「逐元素绑 click」（lib/proto/attach-link.js），初始化时只绑
 *   当时 DOM 里已经存在的 <a>。首页磁贴那两条链接是 hexo-magnet-fomal 用内联脚本
 *   insertAdjacentHTML 插进去的（见 /index.html 里那段 data-pjax 脚本），插完 pjax 早绑完了，
 *   于是点击走浏览器默认跳转 = 整页刷新。整页刷新会销毁 daily-say.js 闭包里的那个
 *   `new Audio()`，歌自然就停在那一刻（胶囊因为是 JS 建的，也一起没了）。
 *   实测：点磁贴后 document 被重新创建，pjax:send / pjax:complete 一次都没触发。
 *   页脚「听点音乐」这类运行期补进去的链接同理，只是以前没人点到。
 *
 * 【根因 2】/categories/ 是 redirect 存根页（source/categories/index.md → redirect_to: /tags/，
 *   模板 themes/chengic/layout/includes/page/redirect.pug）。页脚「文章分类」虽然被 pjax 绑定了，
 *   但存根页被换进来后，它内联的 location.replace("/tags/") 立刻执行 → 强制整页跳到 /tags/，
 *   同样把播放器一起刷掉。
 *
 * 【本文件怎么修】两件互不干扰的事，都不碰主题源码：
 *   1) 捕获阶段（先于元素上的 pjax 监听）：命中 REDIRECTS 表的存根路径 → 直接 pjax.loadUrl(最终地址)，
 *      存根页根本不会被加载，它的 location.replace 也就没机会执行。
 *   2) 冒泡阶段（晚于元素上的 pjax 监听）：pjax 处理过的点击会在元素上留 data-pjax-state 属性，
 *      有这个属性就放行；没有的 = pjax 没绑上的运行期插入链接 → preventDefault 后交给 pjax.loadUrl。
 *   两条合起来：磁贴、页脚补的链接、以后任何新注入的站内链接都自动走 pjax，音乐不再被打断。
 *
 * 新增存根页时：在下面 REDIRECTS 里补一行 '/旧路径/': '/新路径/'。
 * 回滚：删掉本文件，并去掉 _config.chengic.yml 里引用它的那一行。
 */
!function(){"use strict";var t={"/categories/":"/tags/"};function e(){return!(!window.pjax||"function"!=typeof window.pjax.loadUrl)}function r(t){if(0!==t.button)return null;if(t.metaKey||t.ctrlKey||t.shiftKey||t.altKey)return null;var e=t.target&&t.target.closest?t.target.closest("a[href]"):null;if(!e)return null;if(e.target&&"_self"!==e.target)return null;if(e.hasAttribute("download"))return null;var r,n=e.getAttribute("href")||"";if(!n||"#"===n.charAt(0))return null;if(/^(javascript|mailto|tel|data):/i.test(n))return null;if(/\.(zip|rar|7z|pdf|png|jpe?g|gif|webp|svg|mp3|mp4|mov|webm|exe|apk|docx?|xlsx?|pptx?|txt|csv)(\?|#|$)/i.test(n))return null;try{r=new URL(e.href,location.href)}catch(t){return null}return r.origin!==location.origin?null:{a:e,u:r}}document.addEventListener("click",(function(n){var a=r(n);if(a){var i=function(e){if(t[e])return t[e];try{var r=decodeURI(e);if(t[r])return t[r]}catch(t){}return null}(a.u.pathname);i&&e()&&(n.preventDefault(),n.stopPropagation(),window.pjax.loadUrl(i))}}),!0),document.addEventListener("click",(function(t){if(!t.defaultPrevented){var n=r(t);n&&(n.a.hasAttribute("data-pjax-state")||e()&&(t.preventDefault(),window.pjax.loadUrl(n.u.href)))}}),!1)}();