/**
 * Groundwork Capture — Popup Script
 * Controls the popup UI: settings, capture buttons, preview, save flow.
 */

document.addEventListener('DOMContentLoaded', init);

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let capturedDataUrl = null;
let currentMetadata = {};

/* ------------------------------------------------------------------ */
/*  DOM references                                                     */
/* ------------------------------------------------------------------ */

const $ = (sel) => document.querySelector(sel);

const els = {
  // Status
  statusBar: $('#status-bar'),
  statusText: $('#status-text'),
  // Settings
  btnSettings: $('#btn-settings'),
  settingsPanel: $('#settings-panel'),
  inputSupabaseUrl: $('#input-supabase-url'),
  inputSupabaseKey: $('#input-supabase-key'),
  inputProjectId: $('#input-project-id'),
  btnSaveSettings: $('#btn-save-settings'),
  btnCancelSettings: $('#btn-cancel-settings'),
  // Capture
  capturePanel: $('#capture-panel'),
  btnCaptureVisible: $('#btn-capture-visible'),
  btnCaptureFull: $('#btn-capture-full'),
  btnCaptureSelection: $('#btn-capture-selection'),
  platformInfo: $('#platform-info'),
  platformBadge: $('#platform-badge'),
  platformDetail: $('#platform-detail'),
  // Preview
  previewPanel: $('#preview-panel'),
  previewImage: $('#preview-image'),
  btnDiscard: $('#btn-discard'),
  inputCompetitor: $('#input-competitor'),
  btnAnalyzeSave: $('#btn-analyze-save'),
  btnSaveOnly: $('#btn-save-only'),
  // Progress & messages
  progressBar: $('#progress-bar'),
  progressFill: $('#progress-fill'),
  message: $('#message'),
};

/* ------------------------------------------------------------------ */
/*  Initialization                                                     */
/* ------------------------------------------------------------------ */

async function init() {
  // Check connection
  await checkConnection();

  // Check for pending full page capture result
  const stored = await chrome.storage.local.get(['capturedDataUrl']);
  if (stored.capturedDataUrl) {
    showCapturePreview(stored.capturedDataUrl);
    await chrome.storage.local.remove(['capturedDataUrl']);
  }

  // Load platform metadata
  await loadMetadata();

  // Wire up event listeners
  els.btnSettings.addEventListener('click', toggleSettings);
  els.btnSaveSettings.addEventListener('click', saveSettingsHandler);
  els.btnCancelSettings.addEventListener('click', toggleSettings);

  els.btnCaptureVisible.addEventListener('click', () => doCapture('captureVisible'));
  els.btnCaptureFull.addEventListener('click', () => doCapture('captureFullPage'));
  els.btnCaptureSelection.addEventListener('click', () => doCapture('captureSelection'));

  els.btnDiscard.addEventListener('click', discardCapture);
  els.btnAnalyzeSave.addEventListener('click', () => saveCapture(true));
  els.btnSaveOnly.addEventListener('click', () => saveCapture(false));
}

/* ------------------------------------------------------------------ */
/*  Connection check                                                   */
/* ------------------------------------------------------------------ */

async function checkConnection() {
  try {
    const res = await chrome.runtime.sendMessage({ action: 'checkConnection' });
    if (res.connected) {
      els.statusBar.className = 'status-bar status-connected';
      els.statusText.textContent = 'Connected to Groundwork';
    } else {
      els.statusBar.className = 'status-bar status-disconnected';
      els.statusText.textContent = 'Not connected — configure settings';
    }
  } catch {
    els.statusBar.className = 'status-bar status-disconnected';
    els.statusText.textContent = 'Not connected';
  }
}

/* ------------------------------------------------------------------ */
/*  Platform metadata                                                  */
/* ------------------------------------------------------------------ */

async function loadMetadata() {
  try {
    const res = await chrome.runtime.sendMessage({ action: 'getMetadata' });
    if (res?.metadata) {
      currentMetadata = res.metadata;
      const platform = res.metadata.platform;
      if (platform && platform !== 'unknown') {
        els.platformInfo.classList.remove('hidden');
        els.platformBadge.textContent = platformLabel(platform);
        els.platformDetail.textContent =
          res.metadata.brand || res.metadata.channel || res.metadata.username || '';

        // Pre-fill competitor if we detected a brand
        const brand =
          res.metadata.brand || res.metadata.channel || res.metadata.username;
        if (brand) {
          els.inputCompetitor.value = brand;
        }
      }
    }
  } catch {
    /* tab may not have content script */
  }
}

function platformLabel(platform) {
  const labels = {
    linkedin: 'LinkedIn',
    'meta-ads': 'Meta Ads',
    instagram: 'Instagram',
    youtube: 'YouTube',
  };
  return labels[platform] || platform;
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

async function toggleSettings() {
  const isHidden = els.settingsPanel.classList.contains('hidden');
  if (isHidden) {
    // Load current settings
    const settings = await getSettings();
    els.inputSupabaseUrl.value = settings.supabaseUrl;
    els.inputSupabaseKey.value = settings.supabaseKey;
    els.inputProjectId.value = settings.projectId;
    els.settingsPanel.classList.remove('hidden');
    els.capturePanel.classList.add('hidden');
    els.previewPanel.classList.add('hidden');
  } else {
    els.settingsPanel.classList.add('hidden');
    els.capturePanel.classList.remove('hidden');
  }
}

async function saveSettingsHandler() {
  const settings = {
    supabaseUrl: els.inputSupabaseUrl.value.trim().replace(/\/$/, ''),
    supabaseKey: els.inputSupabaseKey.value.trim(),
    projectId: els.inputProjectId.value.trim(),
  };

  if (!settings.projectId) {
    showMessage('Project ID is required. Find it on groundwork.kad.london/projects', 'error');
    return;
  }

  await saveSettings(settings);
  showMessage('Settings saved successfully.', 'success');
  await checkConnection();

  // Return to capture panel
  els.settingsPanel.classList.add('hidden');
  els.capturePanel.classList.remove('hidden');
}

/* ------------------------------------------------------------------ */
/*  Capture flow                                                       */
/* ------------------------------------------------------------------ */

async function doCapture(action) {
  setButtonsDisabled(true);
  showProgress(true);
  hideMessage();

  try {
    if (action === 'captureSelection') {
      await chrome.runtime.sendMessage({ action: 'captureSelection' });
      showMessage('Draw a rectangle on the page. Re-open popup after capture.', 'info');
      setButtonsDisabled(false);
      showProgress(false);
      setTimeout(() => window.close(), 600);
      return;
    }

    if (action === 'captureFullPage') {
      // Full page needs the popup closed so captureVisibleTab works
      // Store a flag, close popup, background does the work, result saved to storage
      await chrome.storage.local.set({ pendingCapture: 'fullPage' });
      showMessage('Capturing full page... Re-open popup when done.', 'info');
      // Trigger the capture via background — it will save result to storage
      chrome.runtime.sendMessage({ action: 'captureFullPageBg' });
      setTimeout(() => window.close(), 400);
      return;
    }

    const res = await chrome.runtime.sendMessage({ action });

    if (res?.error) {
      throw new Error(res.error);
    }

    if (res?.dataUrl) {
      showCapturePreview(res.dataUrl);
    } else {
      throw new Error('No image data received.');
    }
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    setButtonsDisabled(false);
    showProgress(false);
  }
}

function showCapturePreview(dataUrl) {
  capturedDataUrl = dataUrl;
  els.previewImage.src = dataUrl;
  els.capturePanel.classList.add('hidden');
  els.previewPanel.classList.remove('hidden');
}

function discardCapture() {
  capturedDataUrl = null;
  els.previewImage.src = '';
  els.previewPanel.classList.add('hidden');
  els.capturePanel.classList.remove('hidden');
  hideMessage();
}

/* ------------------------------------------------------------------ */
/*  Save flow                                                          */
/* ------------------------------------------------------------------ */

async function saveCapture(withAnalysis) {
  if (!capturedDataUrl) return;

  const competitor = els.inputCompetitor.value.trim();

  els.btnAnalyzeSave.disabled = true;
  els.btnSaveOnly.disabled = true;
  showProgress(true);

  try {
    // Get current tab URL
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const settings = await getSettings();

    showMessage(
      withAnalysis ? 'Uploading and analyzing...' : 'Uploading...',
      'info'
    );

    const res = await chrome.runtime.sendMessage({
      action: 'uploadAndSave',
      dataUrl: capturedDataUrl,
      analyze: withAnalysis,
      competitor: competitor || null,
      url: tab?.url || null,
      platform: currentMetadata.platform || null,
      metadata: currentMetadata,
      projectId: settings.projectId || null,
      context: {
        platform: currentMetadata.platform,
        competitor,
        url: tab?.url,
        ...currentMetadata,
      },
    });

    if (res?.error) {
      throw new Error(res.error);
    }

    showMessage('Saved to Groundwork successfully!', 'success');

    // Reset after short delay
    setTimeout(() => {
      discardCapture();
    }, 2000);
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    els.btnAnalyzeSave.disabled = false;
    els.btnSaveOnly.disabled = false;
    showProgress(false);
  }
}

/* ------------------------------------------------------------------ */
/*  UI helpers                                                         */
/* ------------------------------------------------------------------ */

function setButtonsDisabled(disabled) {
  els.btnCaptureVisible.disabled = disabled;
  els.btnCaptureFull.disabled = disabled;
  els.btnCaptureSelection.disabled = disabled;
}

function showProgress(visible) {
  if (visible) {
    els.progressBar.classList.remove('hidden');
    els.progressBar.classList.add('indeterminate');
    els.progressFill.style.width = '30%';
  } else {
    els.progressBar.classList.add('hidden');
    els.progressBar.classList.remove('indeterminate');
    els.progressFill.style.width = '0%';
  }
}

function showMessage(text, type = 'info') {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
  els.message.classList.remove('hidden');
}

function hideMessage() {
  els.message.classList.add('hidden');
}
