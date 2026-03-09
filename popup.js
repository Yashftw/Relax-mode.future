let popupInterval = null;

document.addEventListener('DOMContentLoaded', () => {

  // Load status on open
  chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (res) => {
    if (!res) return;
    document.getElementById('minutes').value = res.minutes || 25;

    if (res.running && res.endTime) {
      document.getElementById('statusText').textContent = 'RUNNING';
      startPopupCountdown(res.endTime);
    } else {
      document.getElementById('statusText').textContent = 'IDLE';
    }
  });

  // ── START ──────────────────────────────────────────────────────────────
  document.getElementById('startBtn').addEventListener('click', () => {
    const mins = parseInt(document.getElementById('minutes').value) || 25;
    const endTime = Date.now() + mins * 60 * 1000;

    // 1. Save to storage
    chrome.storage.sync.set({
      timerRunning: true,
      timerEndTime: endTime,
      timerMinutes: mins
    });

    // 2. Update popup display
    document.getElementById('statusText').textContent = 'RUNNING';
    startPopupCountdown(endTime);

    // 3. Send directly to content script on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'timerStarted',
          endTime: endTime
        }, (response) => {
          // Suppress error
          if (chrome.runtime.lastError) {
            console.log('Content script not ready:', chrome.runtime.lastError.message);
          }
        });
      }
    });
  });

  // ── STOP ───────────────────────────────────────────────────────────────
  document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.storage.sync.set({ timerRunning: false, timerEndTime: null });
    clearInterval(popupInterval);
    document.getElementById('statusText').textContent = 'IDLE';
    document.getElementById('popupCountdown').textContent = '';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'timerStopped' }, () => {
          chrome.runtime.lastError; // suppress
        });
      }
    });
  });

});

function startPopupCountdown(endTime) {
  clearInterval(popupInterval);
  const display = document.getElementById('popupCountdown');

  popupInterval = setInterval(() => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      clearInterval(popupInterval);
      if (display) display.textContent = '00:00';
      document.getElementById('statusText').textContent = 'DONE';
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    if (display) {
      display.textContent =
        `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    }
  }, 1000);
}