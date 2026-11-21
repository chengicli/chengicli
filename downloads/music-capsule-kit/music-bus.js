/* music-bus.js —— 全站唯一播放核心（教程版）
 * 安装：放到 source/js/music-bus.js
 * 注入：在 _config.chengic.yml 的 inject.bottom 里，必须排在 music-capsule.js 前面：
 *   - <script defer src="/js/music-bus.js?v=20261121a"></script>
 */
(function (global) {
  'use strict';

  var audio = null;
  var queue = [];
  var idx = -1;
  var subs = [];
  var playing = false;
  var lines = [];
  var lineIndex = -1;
  var errCount = 0;

  function emit(type, data) {
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](type, data || {}); } catch (e) { }
    }
  }

  function on(fn) {
    if (typeof fn === 'function' && subs.indexOf(fn) < 0) subs.push(fn);
    return fn;
  }

  function parseLrc(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var stamps = line.match(/\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g);
      if (!stamps) return;
      var body = line.replace(/\[[^\]]*\]/g, '').trim();
      if (!body) return;
      stamps.forEach(function (s) {
        var m = s.match(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/);
        if (!m) return;
        var frac = m[3] ? parseFloat('0.' + m[3]) : 0;
        out.push({
          t: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac,
          text: body
        });
      });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  function snapshot() {
    return {
      index: idx,
      track: idx >= 0 ? queue[idx] : null,
      playing: playing,
      cur: audio ? (audio.currentTime || 0) : 0,
      dur: audio && isFinite(audio.duration) ? audio.duration : 0,
      lines: lines,
      lineIndex: lineIndex
    };
  }

  function attach() {
    if (audio) return audio;

    audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.volume = 0.8;
    audio.style.display = 'none';
    document.body.appendChild(audio);

    audio.addEventListener('playing', function () {
      playing = true;
      errCount = 0;
      emit('state', snapshot());
    });

    audio.addEventListener('pause', function () {
      playing = false;
      emit('state', snapshot());
    });

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onTime);

    audio.addEventListener('ended', function () {
      playIndex(idx + 1);
    });

    audio.addEventListener('error', function () {
      emit('error', { track: queue[idx] || null });
      errCount++;
      if (errCount >= 3) {
        emit('blocked', { message: '连续 3 首都播不了，先检查音频地址' });
        return;
      }
      playIndex(idx + 1, true);
    });

    return audio;
  }

  function onTime() {
    if (!audio) return;

    var t = audio.currentTime || 0;
    var found = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].t <= t + 0.2) found = i; else break;
    }

    if (found !== lineIndex) {
      lineIndex = found;
      emit('line', {
        index: found,
        text: found >= 0 ? lines[found].text : ''
      });
    }

    emit('time', snapshot());
  }

  function setQueue(list) {
    queue = Array.isArray(list) ? list : [];
    idx = -1;
    lines = [];
    lineIndex = -1;
    emit('queue', { list: queue });
  }

  function playIndex(i, fromError) {
    if (!queue.length) return;
    if (!fromError) errCount = 0;

    idx = ((i % queue.length) + queue.length) % queue.length;
    var item = queue[idx];
    var a = attach();

    lines = parseLrc(item.lrc || '');
    lineIndex = -1;

    a.src = item.url;
    a.load();
    emit('track', snapshot());

    var p = a.play();
    if (p && p.catch) {
      p.catch(function () {
        emit('blocked', { message: '浏览器拦了自动播放，请点一下播放键' });
      });
    }
  }

  function toggle() {
    if (idx < 0) {
      playIndex(0);
      return;
    }

    var a = attach();
    if (a.paused) {
      var p = a.play();
      if (p && p.catch) {
        p.catch(function () {
          emit('blocked', { message: '浏览器拦了自动播放，请再点一次' });
        });
      }
    } else {
      a.pause();
    }
  }

  function next() {
    playIndex(idx + 1);
  }

  function prev() {
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    playIndex(idx - 1);
  }

  global.MiniPlayer = {
    on: on,
    setQueue: setQueue,
    playIndex: playIndex,
    toggle: toggle,
    next: next,
    prev: prev,
    state: snapshot,
    parseLrc: parseLrc
  };
})(window);
