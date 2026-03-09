// ─── INSTALL: set defaults ────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    timerMinutes: 25,
    timerRunning: false,
    timerEndTime: null,
  });
});


// ─── HELPER: broadcast to active tab ─────────────────────────────────────────
function notifyActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    tabs.forEach(tab => {
      try { chrome.tabs.sendMessage(tab.id, message); } catch(e) {}
    });
  });
}


// ─── MESSAGE HANDLER ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

 if (message.action === 'startTimer') {
  const mins = message.minutes;
  const endTime = Date.now() + mins * 60 * 1000;

  chrome.storage.sync.set({
    timerRunning: true,
    timerEndTime: endTime,
    timerMinutes: mins
  });

  // ← Use delayInMinutes: mins but ALSO send endTime to content.js
  // For timers under 1 min, alarms won't fire — content.js handles it anyway
  chrome.alarms.clear('focusTimer');
  if (mins >= 1) {
    chrome.alarms.create('focusTimer', { delayInMinutes: mins });
  }

  // Tell content.js to start the visual countdown immediately
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: 'timerStarted', endTime: endTime },
        () => { chrome.runtime.lastError; } // suppress error if tab not ready
      );
    });
  });

  sendResponse({ status: 'started', endTime: endTime });
}

  if (message.action === 'restartTimer') {
    chrome.storage.sync.get(['timerMinutes'], (data) => {
      const mins = data.timerMinutes || 25;
      const endTime = Date.now() + mins * 60 * 1000;
      chrome.storage.sync.set({ timerRunning: true, timerEndTime: endTime });
      chrome.alarms.clear('focusTimer');
      chrome.alarms.create('focusTimer', { delayInMinutes: mins });
      notifyActiveTab({ action: 'timerStarted', endTime });
    });
    sendResponse({ status: 'restarted' });
  }

  if (message.action === 'stopTimer') {
    chrome.alarms.clear('focusTimer');
    chrome.storage.sync.set({ timerRunning: false, timerEndTime: null });
    notifyActiveTab({ action: 'timerStopped' });
    sendResponse({ status: 'stopped' });
  }

  if (message.action === 'getTimerStatus') {
    chrome.storage.sync.get(['timerRunning', 'timerEndTime', 'timerMinutes'], (data) => {
      sendResponse({
        running: data.timerRunning  || false,
        endTime: data.timerEndTime  || null,
        minutes: data.timerMinutes  || 25,
      });
    });
    return true;
  }

  if (message.action === 'openTab') {
    chrome.tabs.create({ url: message.url });
    sendResponse({ status: 'opened' });
  }

  return true;
});


// ─── ALARM FIRES ──────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'focusTimer') return;
  chrome.storage.sync.set({ timerRunning: false, timerEndTime: null });
  chrome.tabs.query({ active: true }, (tabs) => {
    tabs.forEach(tab => {
      try { chrome.tabs.sendMessage(tab.id, { action: 'timerDone' }); } catch(e) {}
    });
  });
});