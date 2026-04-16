(function () {
  const style = document.createElement('style');
  style.textContent = `
    #bs-loader {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #151515;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 32px;
      transition: opacity 0.5s ease, visibility 0.5s ease;
    }

    #bs-loader.hidden {
      opacity: 0;
      visibility: hidden;
    }

    .bs-loader-logo {
      width: 180px;
      animation: bs-pulse 2s ease-in-out infinite;
    }

    @keyframes bs-pulse {
      0%, 100% { opacity: 1; filter: drop-shadow(0 0 8px rgba(157,222,255,0.6)); }
      50%       { opacity: 0.6; filter: drop-shadow(0 0 2px rgba(157,222,255,0.2)); }
    }

    .bs-loader-bar-wrap {
      width: 240px;
      height: 3px;
      background: rgba(255,255,255,0.1);
      border-radius: 99px;
      overflow: hidden;
    }

    .bs-loader-bar {
      height: 100%;
      width: 0%;
      background: #9DDEFF;
      border-radius: 99px;
      transition: width 0.3s ease;
      box-shadow: 0 0 8px #9DDEFF;
    }

    .bs-loader-text {
      font-family: 'Inconsolata', monospace;
      font-size: 12px;
      letter-spacing: 0.15em;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
    }

    .bs-loader-snowflakes {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .bs-sf {
      position: absolute;
      top: -10%;
      color: rgba(255,255,255,0.15);
      font-size: 2rem;
      animation: bs-fall linear infinite, bs-shake ease-in-out infinite;
    }

    @keyframes bs-fall  { 0%{top:-10%;opacity:0} 10%{opacity:1} 100%{top:110%;opacity:0} }
    @keyframes bs-shake { 0%,100%{transform:translateX(0)} 50%{transform:translateX(30px)} }
  `;
  document.head.appendChild(style);

  const loader = document.createElement('div');
  loader.id = 'bs-loader';
  loader.innerHTML = `
    <div class="bs-loader-snowflakes">
      ${['10%','25%','40%','55%','70%','85%'].map((l, i) =>
        `<span class="bs-sf" style="left:${l};animation-duration:${8+i*1.5}s,${2.5+i*0.4}s;animation-delay:${i*0.8}s,${i*0.3}s">${i%2===0?'❅':'❆'}</span>`
      ).join('')}
    </div>
    <img src="logo.svg" class="bs-loader-logo" alt="BLACKSNOW" />
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
      <div class="bs-loader-bar-wrap"><div class="bs-loader-bar" id="bs-bar"></div></div>
      <span class="bs-loader-text" id="bs-label">Chargement...</span>
    </div>
  `;
  document.body.insertBefore(loader, document.body.firstChild);

  const bar   = document.getElementById('bs-bar');
  const label = document.getElementById('bs-label');

  const steps = [
    { pct: 20, txt: 'Initialisation...' },
    { pct: 45, txt: 'Chargement des ressources...' },
    { pct: 70, txt: 'Préparation de la page...' },
    { pct: 90, txt: 'Presque prêt...' },
  ];

  let i = 0;
  const tick = setInterval(() => {
    if (i < steps.length) {
      bar.style.width   = steps[i].pct + '%';
      label.textContent = steps[i].txt;
      i++;
    } else {
      clearInterval(tick);
    }
  }, 350);

  function dismiss() {
    clearInterval(tick);
    bar.style.width   = '100%';
    label.textContent = 'Bienvenue !';
    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 600);
    }, 300);
  }

  if (document.readyState === 'complete') {
    dismiss();
  } else {
    window.addEventListener('load', dismiss);
    setTimeout(dismiss, 4000);
  }
})();