/* music-capsule.js —— 左下角竖排音乐胶囊（教程版）
 * 安装：放到 source/js/music-capsule.js
 * 注入：在 _config.chengic.yml 的 inject.bottom 里，排在 music-bus.js 后面：
 *   - <script defer src="/js/music-capsule.js?v=20261121a"></script>
 * 改歌单：改下面的 PLAYLIST；url 指向你放进 source/music/ 的 mp3。
 */
(function () {
  'use strict';

  var PLAYLIST = [
    {
      name: '示例歌曲一',
      artist: '示例歌手',
      url: '/music/01.mp3',
      lrc: '[0:00] 正在播放\n[0:05] 这里是第一句歌词\n[0:10] 这里是第二句歌词'
    },
    {
      name: '示例歌曲二',
      artist: '示例歌手',
      url: '/music/02.mp3',
      lrc: '[0:00] 第二首歌\n[0:06] 歌词照样能显示'
    },
    {
      name: '示例歌曲三',
      artist: '示例歌手',
      url: '/music/03.mp3'
    }
  ];

  var ICON = {
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9.28a4.39 4.39 0 1 0 2 3.7V6h4V3h-6z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z"/></svg>'
  };

  var el = null;
  var cur = null;
  var playBtn = null;

  function ensure() {
    if (el && el.isConnected) return;

    el = document.createElement('div');
    el.id = 'mini-music';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', '音乐播放器');
    el.innerHTML =
      '<div class="mm-main">' +
        '<div class="mm-top">' + ICON.music + '</div>' +
        '<div class="mm-text"><span class="mm-cur">点播放键开始</span></div>' +
      '</div>' +
      '<div class="mm-keys">' +
        '<button type="button" class="mm-side" data-act="prev" title="上一首">' + ICON.prev + '</button>' +
        '<button type="button" class="mm-play" data-act="play" title="播放 / 暂停">' + ICON.play + '</button>' +
        '<button type="button" class="mm-side" data-act="next" title="下一首">' + ICON.next + '</button>' +
      '</div>';

    document.body.appendChild(el);

    cur = el.querySelector('.mm-cur');
    playBtn = el.querySelector('.mm-play');

    el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'play') window.MiniPlayer.toggle();
      else if (act === 'next') window.MiniPlayer.next();
      else if (act === 'prev') window.MiniPlayer.prev();
    });

    var s = window.MiniPlayer.state();
    if (s.track) applyTrack(s);
  }

  function setText(text) {
    if (cur) cur.textContent = text || '音乐播放中';
  }

  function applyTrack(s) {
    if (!el || !s.track) return;
    el.classList.add('is-on');
    setText(s.track.name + (s.track.artist ? ' - ' + s.track.artist : ''));
  }

  function applyState(s) {
    if (!el) return;
    el.classList.toggle('is-playing', !!s.playing);
    el.classList.toggle('is-paused', !s.playing);
    if (playBtn) playBtn.innerHTML = s.playing ? ICON.pause : ICON.play;
  }

  function init() {
    if (!window.MiniPlayer) return;

    window.MiniPlayer.setQueue(PLAYLIST);

    window.MiniPlayer.on(function (type, data) {
      if (type === 'track') applyTrack(data);
      else if (type === 'state') applyState(data);
      else if (type === 'line' && data.text) setText(data.text);
      else if (type === 'blocked') setText(data.message || '请点一下播放键');
      else if (type === 'error') setText('这首歌播不了，已跳下一首');
    });

    ensure();
    document.addEventListener('pjax:complete', ensure);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
