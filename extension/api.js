/**
 * Groundwork Capture — Shared API utilities
 * Routes everything through Groundwork's API to avoid Supabase RLS issues
 */

const API_DEFAULTS = {
  groundworkUrl: 'https://groundwork.kad.london',
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['supabaseUrl', 'supabaseKey', 'projectId'],
      (result) => {
        resolve({
          supabaseUrl: result.supabaseUrl || '',
          supabaseKey: result.supabaseKey || '',
          projectId: result.projectId || '',
        });
      }
    );
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, resolve);
  });
}

async function isConfigured() {
  const s = await getSettings();
  return !!(s.projectId);
}

function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function generateFilename(ext = 'jpg') {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}_${rand}.${ext}`;
}

/**
 * Upload image via Groundwork API (bypasses RLS)
 */
async function uploadToSupabase(dataUrl, filename) {
  const imageBase64 = dataUrl.includes(',') ? dataUrl : `data:image/jpeg;base64,${dataUrl}`;

  const res = await fetch(`${API_DEFAULTS.groundworkUrl}/api/extension`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upload',
      imageBase64,
      filename: filename || generateFilename('jpg'),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.url;
}

/**
 * Call Groundwork's /api/analyze endpoint
 */
async function analyzeImage(imageBase64, context = {}) {
  const base64 = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const res = await fetch(`${API_DEFAULTS.groundworkUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, context }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analysis failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Create audit entry via Groundwork API (bypasses RLS)
 */
async function createAuditEntry(entry) {
  const { projectId } = await getSettings();

  const res = await fetch(`${API_DEFAULTS.groundworkUrl}/api/extension`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'save',
      entry: {
        ...entry,
        project_id: entry.projectId || projectId,
        created_by: 'chrome-extension',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Save failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
