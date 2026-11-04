// Vidéo YouTube en fond de l'accueil (réglée depuis /admin → Vidéos)
(function () {
  const H = JSON.parse(document.getElementById('hero-data')?.textContent || 'null');
  if (!H || !H.videoId) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;

  const START = H.start || 0;
  const END = H.end || 0; // 0 = jusqu'à la fin
  let player;
  // YouTube force parfois les sous-titres (préférence du compte) : on décharge le module
  function hideCaptions() {
    try { player.unloadModule('captions'); player.unloadModule('cc'); player.setOption('captions', 'track', {}); } catch {}
  }

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('yt-player', {
      host: 'https://www.youtube-nocookie.com',
      videoId: H.videoId,
      playerVars: {
        autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
        modestbranding: 1, playsinline: 1, rel: 0, cc_load_policy: 0, cc_lang_pref: 'fr', hl: 'fr', start: START, ...(END ? { end: END } : {}),
      },
      events: {
        onReady(e) { e.target.mute(); hideCaptions(); e.target.seekTo(START, true); e.target.playVideo(); },
        onStateChange(e) {
          if (e.data === YT.PlayerState.PLAYING) hideCaptions();
          if (e.data === YT.PlayerState.ENDED) { player.seekTo(START, true); player.playVideo(); }
        },
      },
    });
    if (END) setInterval(() => {
      if (player && player.getCurrentTime && player.getCurrentTime() >= END - 0.3) player.seekTo(START, true);
    }, 500);
  };

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
})();
