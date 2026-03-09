// ─── GUARD ───────────────────────────────────────────────────────────────────
if (!document.getElementById('relax-timer-card')) {
  initRelaxMode();
}

function initRelaxMode() {

  // ── STATE ──────────────────────────────────────────────────────────────────
  let countdownInterval = null;
  let particleAnimation = null;
  let particles         = [];

  // ── TIMER CARD ─────────────────────────────────────────────────────────────
  const card = document.createElement('div');
  card.id = 'relax-timer-card';
  card.innerHTML = `
    <div id="relax-timer-label">FOCUS</div>
    <div id="relax-timer-display">--:--</div>
  `;
  document.body.appendChild(card);

  // ── ON PAGE LOAD: resume if timer was already running ──────────────────────
  chrome.storage.sync.get(['timerRunning', 'timerEndTime'], (data) => {
    if (data.timerRunning && data.timerEndTime && data.timerEndTime > Date.now()) {
      startCountdown(data.timerEndTime);
    }
  });

  // ── MESSAGE LISTENER ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === 'timerStarted') {
      startCountdown(message.endTime);
      sendResponse({ status: 'ok' });
    }

    if (message.action === 'timerStopped') {
      clearInterval(countdownInterval);
      const d = document.getElementById('relax-timer-display');
      if (d) d.textContent = '--:--';
      sendResponse({ status: 'ok' });
    }

    if (message.action === 'timerDone') {
      clearInterval(countdownInterval);
      showBreakModal();
      sendResponse({ status: 'ok' });
    }

    return true;
  });


  // ════════════════════════════════════════════════════════════════════════════
  // COUNTDOWN
  // ════════════════════════════════════════════════════════════════════════════
  function startCountdown(endTime) {
    clearInterval(countdownInterval);

    // Show time immediately — don't wait 1 second
    updateDisplay(endTime);

    countdownInterval = setInterval(() => {
      const remaining = endTime - Date.now();

      if (remaining <= 0) {
        clearInterval(countdownInterval);
        const d = document.getElementById('relax-timer-display');
        if (d) d.textContent = '00:00';
        chrome.storage.sync.set({ timerRunning: false, timerEndTime: null });

        // Small delay so user sees 00:00 before modal appears
        setTimeout(() => showBreakModal(), 600);
        return;
      }

      updateDisplay(endTime);
    }, 1000);
  }

  function updateDisplay(endTime) {
    const remaining = Math.max(0, endTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const d = document.getElementById('relax-timer-display');
    if (d) {
      d.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      // Turn red in last 10 seconds
      if (remaining <= 10000) {
        d.style.color      = '#ff4d4d';
        d.style.textShadow = '0 0 12px #ff4d4daa';
      } else {
        d.style.color      = '#00e5ff';
        d.style.textShadow = '0 0 12px #00e5ff88';
      }
    }
  }


  // ════════════════════════════════════════════════════════════════════════════
  // BREAK MODAL
  // ════════════════════════════════════════════════════════════════════════════
  function showBreakModal() {
    removeOverlay();

    // Particle canvas behind modal
    const canvas = document.createElement('canvas');
    canvas.id     = 'relax-canvas';
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    spawnParticles(canvas);

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'relax-overlay';
    overlay.innerHTML = `
      <div id="relax-modal">
        <div id="relax-modal-tag">// SESSION COMPLETE</div>
        <h2 id="relax-modal-title">Your focus session has ended.</h2>
        <p id="relax-modal-sub">Do you wish to continue working?</p>
        <div id="relax-modal-buttons">
          <button class="relax-btn relax-btn-yes">Yes — Continue Work</button>
          <button class="relax-btn relax-btn-no">No — Take a Break</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('relax-visible'));
    });

    // Yes — restart timer
    overlay.querySelector('.relax-btn-yes').addEventListener('click', () => {
      removeOverlay();
      chrome.storage.sync.get(['timerMinutes'], (data) => {
        const mins    = data.timerMinutes || 25;
        const endTime = Date.now() + mins * 60 * 1000;
        chrome.storage.sync.set({ timerRunning: true, timerEndTime: endTime });
        startCountdown(endTime);
      });
    });

    // No — show break menu
    overlay.querySelector('.relax-btn-no').addEventListener('click', () => {
      showBreakMenu(overlay);
    });
  }


  // ════════════════════════════════════════════════════════════════════════════
  // BREAK MENU
  // ════════════════════════════════════════════════════════════════════════════
  function showBreakMenu(overlay) {
    document.getElementById('relax-modal').innerHTML = `
      <div id="relax-modal-tag">// TAKE A BREAK</div>
      <h2 id="relax-modal-title">What would you like to do?</h2>
      <div id="relax-modal-buttons">
        <button class="relax-btn relax-btn-sleep">😴  Sleep Mode</button>
        <button class="relax-btn relax-btn-music">🎵  Music</button>
        <button class="relax-btn relax-btn-yt">▶  YouTube</button>
        <button class="relax-btn relax-btn-games">🎮  Games</button>
      </div>
    `;

    overlay.querySelector('.relax-btn-sleep').addEventListener('click', () => {
      removeOverlay();
      showSleepMode();
    });

    overlay.querySelector('.relax-btn-music').addEventListener('click', () => {
      showMusicMenu(overlay);
    });

    overlay.querySelector('.relax-btn-yt').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openTab', url: 'https://youtube.com' });
      removeOverlay();
    });

    overlay.querySelector('.relax-btn-games').addEventListener('click', () => {
      showGamesMenu(overlay);
    });
  }


  // ════════════════════════════════════════════════════════════════════════════
  // SLEEP MODE
  // ════════════════════════════════════════════════════════════════════════════
  function showSleepMode() {
    const sleep = document.createElement('div');
    sleep.id = 'relax-sleep';
    sleep.innerHTML = `
      <div id="relax-sleep-text">I'm proud of you.</div>
      <button id="relax-sleep-exit">[ ESC ] Exit Sleep Mode</button>
    `;
    document.body.appendChild(sleep);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => sleep.classList.add('relax-visible'));
    });

    const exit = () => {
      sleep.style.opacity = '0';
      setTimeout(() => sleep.remove(), 700);
      document.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e) => { if (e.key === 'Escape') exit(); };
    document.addEventListener('keydown', escHandler);
    sleep.querySelector('#relax-sleep-exit').addEventListener('click', exit);
  }


  // ════════════════════════════════════════════════════════════════════════════
  // MUSIC MENU
  // ════════════════════════════════════════════════════════════════════════════
  function showMusicMenu(overlay) {
    document.getElementById('relax-modal').innerHTML = `
      <div id="relax-modal-tag">// MUSIC</div>
      <h2 id="relax-modal-title">Choose a platform</h2>
      <div id="relax-modal-buttons">
        <button class="relax-btn relax-btn-lofi">🎧  Lofi Hip Hop</button>
        <button class="relax-btn relax-btn-spotify">💚  Spotify</button>
        <button class="relax-btn relax-btn-sc">☁  SoundCloud</button>
        <button class="relax-btn relax-btn-back">← Back</button>
      </div>
    `;

    overlay.querySelector('.relax-btn-lofi').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openTab', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' });
      removeOverlay();
    });
    overlay.querySelector('.relax-btn-spotify').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openTab', url: 'https://open.spotify.com' });
      removeOverlay();
    });
    overlay.querySelector('.relax-btn-sc').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openTab', url: 'https://soundcloud.com' });
      removeOverlay();
    });
    overlay.querySelector('.relax-btn-back').addEventListener('click', () => {
      showBreakMenu(overlay);
    });
  }


  // ════════════════════════════════════════════════════════════════════════════
  // GAMES MENU
  // ════════════════════════════════════════════════════════════════════════════
  function showGamesMenu(overlay) {
    document.getElementById('relax-modal').innerHTML = `
      <div id="relax-modal-tag">// GAMES</div>
      <h2 id="relax-modal-title">Launch a game launcher</h2>
      <div id="relax-modal-buttons">
        <button class="relax-btn relax-btn-steam">🎮  Steam</button>
        <button class="relax-btn relax-btn-epic">⚡  Epic Games</button>
        <button class="relax-btn relax-btn-back">← Back</button>
      </div>
      <p id="relax-games-note">Opens your installed launcher via protocol handler.<br>If not installed, a fallback will appear.</p>
    `;

    overlay.querySelector('.relax-btn-steam').addEventListener('click', () => {
      window.location.href = 'steam://open/games';
      setTimeout(() => showFallback(overlay, 'Steam'), 2000);
    });
    overlay.querySelector('.relax-btn-epic').addEventListener('click', () => {
      window.location.href = 'epicgames://';
      setTimeout(() => showFallback(overlay, 'Epic Games'), 2000);
    });
    overlay.querySelector('.relax-btn-back').addEventListener('click', () => {
      showBreakMenu(overlay);
    });
  }

  function showFallback(overlay, launcher) {
    const modal = document.getElementById('relax-modal');
    if (!modal) return;
    modal.innerHTML = `
      <div id="relax-modal-tag">// GAMES</div>
      <h2 id="relax-modal-title">Launch your favorite game and relax.</h2>
      <p id="relax-modal-sub">${launcher} didn't open automatically.<br>Try launching it from your desktop.</p>
      <div id="relax-modal-buttons">
        <button class="relax-btn relax-btn-back">← Back</button>
        <button class="relax-btn relax-btn-close">Close</button>
      </div>
    `;
    modal.querySelector('.relax-btn-back').addEventListener('click', () => showGamesMenu(overlay));
    modal.querySelector('.relax-btn-close').addEventListener('click', () => removeOverlay());
  }


  // ════════════════════════════════════════════════════════════════════════════
  // PARTICLES
  // ════════════════════════════════════════════════════════════════════════════
  function spawnParticles(canvas) {
    const ctx = canvas.getContext('2d');

    particles = Array.from({ length: 80 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 2 + 0.3,
      sx:    (Math.random() - 0.5) * 0.35,
      sy:    (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.1,
      color: ['#00e5ff', '#00e5ff', '#00e5ff', '#ffffff', '#7dd3fc'][Math.floor(Math.random() * 5)],
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.sx;
        p.y += p.sy;
        if (p.x < 0)             p.x = canvas.width;
        if (p.x > canvas.width)  p.x = 0;
        if (p.y < 0)             p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle   = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });

      ctx.globalAlpha   = 1;
      particleAnimation = requestAnimationFrame(draw);
    }

    draw();

    window.addEventListener('resize', () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }


  // ════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ════════════════════════════════════════════════════════════════════════════
  function removeOverlay() {
    cancelAnimationFrame(particleAnimation);
    particleAnimation = null;
    particles         = [];
    document.getElementById('relax-overlay')?.remove();
    document.getElementById('relax-canvas')?.remove();
  }

} // end initRelaxMode