/**
 * Groundwork Capture — Background Service Worker
 * Routes all uploads through Groundwork API (no direct Supabase calls).
 */

importScripts('api.js');

/* ------------------------------------------------------------------ */
/*  Context menu                                                       */
/* ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-groundwork',
    title: 'Save to Groundwork',
    contexts: ['page', 'image', 'link'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-to-groundwork') return;

  try {
    if (info.srcUrl) {
      // Right-clicked an image — fetch it as dataUrl
      const res = await fetch(info.srcUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      const imageUrl = await uploadToSupabase(dataUrl);
      const { projectId } = await getSettings();

      let metadata = {};
      try {
        const metaRes = await chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' });
        if (metaRes) metadata = metaRes;
      } catch (_) {}

      await createAuditEntry({
        image_url: imageUrl,
        competitor: metadata.brand || '',
        url: tab.url,
        description: metadata.text || '',
      });

      notify('Saved to Groundwork', 'Image saved successfully.');
      return;
    }

    // Capture visible tab
    const dataUrl = await captureVisibleTab(tab);
    const imageUrl = await uploadToSupabase(dataUrl);

    let metadata = {};
    try {
      const metaRes = await chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' });
      if (metaRes) metadata = metaRes;
    } catch (_) {}

    await createAuditEntry({
      image_url: imageUrl,
      competitor: metadata.brand || '',
      url: tab.url,
      description: metadata.text || '',
    });

    notify('Saved to Groundwork', 'Screenshot saved successfully.');
  } catch (err) {
    console.error('[Groundwork]', err);
    notify('Groundwork Error', err.message);
  }
});

/* ------------------------------------------------------------------ */
/*  Message handler (popup & content script)                           */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch((err) => {
    console.error('[Groundwork]', err);
    sendResponse({ error: err.message });
  });
  return true;
});

async function handleMessage(msg, sender) {
  switch (msg.action) {
    case 'captureVisible': {
      const tab = await getActiveTab();
      const dataUrl = await captureVisibleTab(tab);
      return { dataUrl };
    }

    case 'captureFullPage': {
      const tab = await getActiveTab();
      await ensureContentScript(tab.id);
      const result = await chrome.tabs.sendMessage(tab.id, { action: 'captureFullPage' });
      if (result?.error) throw new Error(result.error);
      return { dataUrl: result.dataUrl };
    }

    case 'captureFullPageBg': {
      // Capture visible area and save to storage (popup is closed)
      try {
        const tab = await getActiveTab();
        const dataUrl = await captureVisibleTab(tab);
        await chrome.storage.local.set({ capturedDataUrl: dataUrl });
        notify('Capture complete', 'Open the extension to preview and save.');
      } catch (err) {
        notify('Capture failed', err.message);
      }
      return { status: 'done' };
    }

    case 'captureSelection': {
      const tab = await getActiveTab();
      await ensureContentScript(tab.id);
      await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
      return { status: 'selection-started' };
    }

    case 'captureViewport': {
      // Called by content script during scroll capture — use sender's tab window
      const windowId = sender?.tab?.windowId || null;
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 92 });
        return { dataUrl };
      } catch (err) {
        // Retry once after a short delay
        await new Promise(r => setTimeout(r, 200));
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 92 });
          return { dataUrl };
        } catch {
          return { dataUrl: null, error: err.message };
        }
      }
    }

    case 'selectionComplete': {
      return { dataUrl: msg.dataUrl };
    }

    /* ---- Upload & analyse (via Groundwork API) ---- */

    case 'upload': {
      const imageUrl = await uploadToSupabase(msg.dataUrl);
      return { imageUrl };
    }

    case 'analyze': {
      const result = await analyzeImage(msg.dataUrl, msg.context || {});
      return { analysis: result };
    }

    case 'saveEntry': {
      const entry = await createAuditEntry(msg.entry);
      return { entry };
    }

    case 'uploadAndSave': {
      // 1. Upload image
      if (!msg.dataUrl || !msg.dataUrl.startsWith('data:')) {
        throw new Error('No valid capture data. Please capture again.');
      }
      console.log('[Groundwork] Uploading capture...', msg.dataUrl.length, 'bytes');
      const imageUrl = await uploadToSupabase(msg.dataUrl);
      console.log('[Groundwork] Uploaded:', imageUrl);

      // 2. Optionally analyze with AI
      let analysisFields = {};
      if (msg.analyze) {
        try {
          const result = await analyzeImage(msg.dataUrl, msg.context || {});
          if (result.success && result.analysis) {
            analysisFields = result.analysis;
          }
        } catch (err) {
          console.warn('[Groundwork] Analysis failed, saving without:', err.message);
        }
      }

      // 3. Create audit entry — image_url is the capture, url is empty (not a video/website)
      if (!imageUrl) throw new Error('Upload failed — no image URL returned');
      const entry = await createAuditEntry({
        image_url: imageUrl,
        competitor: msg.competitor || analysisFields.competitor || '',
        url: '',  // Don't set url — it makes the entry show as website instead of image
        description: analysisFields.description || msg.competitor || '',
        type: analysisFields.type || '',
        synopsis: analysisFields.synopsis || '',
        insight: analysisFields.insight || '',
        idea: analysisFields.idea || '',
        primary_territory: analysisFields.primary_territory || '',
        tone_of_voice: analysisFields.tone_of_voice || '',
        brand_archetype: analysisFields.brand_archetype || '',
        communication_intent: analysisFields.communication_intent || '',
        main_slogan: analysisFields.main_slogan || '',
        main_vp: analysisFields.main_vp || '',
        transcript: analysisFields.transcript || '',
        analyst_comment: `Captured from ${msg.url || 'web'} via Chrome extension`,
      });

      return { entry, imageUrl };
    }

    case 'getMetadata': {
      const tab = await getActiveTab();
      try {
        const metadata = await chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' });
        return { metadata };
      } catch (_) {
        return { metadata: { platform: detectPlatform(tab.url), url: tab.url } };
      }
    }

    case 'checkConnection': {
      const configured = await isConfigured();
      return { connected: configured };
    }

    default:
      throw new Error(`Unknown action: ${msg.action}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab found.');
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  }
}

function captureVisibleTab(tab) {
  return chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 92 });
}

function detectPlatform(url) {
  if (!url) return null;
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('facebook.com/ads/library')) return 'meta-ads';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('youtube.com')) return 'youtube';
  return null;
}

function notify(title, message) {
  console.log(`[Groundwork] ${title}: ${message}`);
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#0019FF' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
}
