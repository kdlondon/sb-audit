/**
 * Groundwork Capture — Content Script
 * Injected into LinkedIn, Meta Ad Library, Instagram, YouTube.
 * Handles full-page scroll-capture, selection capture, and metadata extraction.
 */

(() => {
  'use strict';

  /* ---------------------------------------------------------------- */
  /*  Message listener                                                 */
  /* ---------------------------------------------------------------- */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
      case 'captureFullPage':
        captureFullPage()
          .then((dataUrl) => sendResponse({ dataUrl }))
          .catch((err) => sendResponse({ error: err.message }));
        return true;

      case 'startSelection':
        startSelectionCapture()
          .then((dataUrl) => sendResponse({ dataUrl }))
          .catch((err) => sendResponse({ error: err.message }));
        return true;

      case 'ping':
        sendResponse({ pong: true });
        return false;

      case 'extractMetadata':
        sendResponse(extractMetadata());
        return false;

      default:
        return false;
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Full-page scroll capture                                         */
  /* ---------------------------------------------------------------- */

  async function captureFullPage() {
    const scrollEl =
      document.scrollingElement || document.documentElement;
    const totalHeight = scrollEl.scrollHeight;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dpr = window.devicePixelRatio || 1;

    // Save current scroll position
    const origScrollX = window.scrollX;
    const origScrollY = window.scrollY;

    const captures = [];
    let currentY = 0;

    // Scroll through the page in viewport-height increments
    while (currentY < totalHeight) {
      window.scrollTo(0, currentY);
      // Let the page settle after scroll
      await sleep(300);

      // Ask background to capture the visible tab
      const response = await chrome.runtime.sendMessage({
        action: 'captureViewport',
      });

      if (!response?.dataUrl) {
        throw new Error('Failed to capture viewport');
      }

      const img = await loadImage(response.dataUrl);
      const captureHeight = Math.min(
        viewportHeight,
        totalHeight - currentY
      );

      captures.push({ img, y: currentY, captureHeight });
      currentY += viewportHeight;
    }

    // Restore original scroll position
    window.scrollTo(origScrollX, origScrollY);

    // Stitch all captures into one tall image
    const canvas = new OffscreenCanvas(
      viewportWidth * dpr,
      totalHeight * dpr
    );
    const ctx = canvas.getContext('2d');

    for (const { img, y, captureHeight } of captures) {
      // For the last capture, we may need to offset if the remaining
      // height is less than the viewport
      const srcY =
        captureHeight < viewportHeight
          ? (viewportHeight - captureHeight) * dpr
          : 0;
      const srcH = captureHeight * dpr;

      ctx.drawImage(
        img,
        0, srcY, viewportWidth * dpr, srcH,     // source rect
        0, y * dpr, viewportWidth * dpr, srcH    // dest rect
      );
    }

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.92,
    });
    return blobToDataUrl(blob);
  }

  /* ---------------------------------------------------------------- */
  /*  Selection capture                                                */
  /* ---------------------------------------------------------------- */

  function startSelectionCapture() {
    return new Promise((resolve, reject) => {
      // Create overlay
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '2147483647',
        cursor: 'crosshair',
        background: 'rgba(10, 15, 60, 0.15)',
      });

      const selectionBox = document.createElement('div');
      Object.assign(selectionBox.style, {
        position: 'absolute',
        border: '2px solid #0019FF',
        background: 'rgba(0, 25, 255, 0.08)',
        pointerEvents: 'none',
      });
      overlay.appendChild(selectionBox);

      // Instruction tooltip
      const tooltip = document.createElement('div');
      Object.assign(tooltip.style, {
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#0a0f3c',
        color: '#fff',
        padding: '8px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        zIndex: '2147483647',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      });
      tooltip.textContent =
        'Click and drag to select area. Press Escape to cancel.';
      overlay.appendChild(tooltip);

      let startX, startY, dragging = false;

      function cleanup() {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
      }

      function onKey(e) {
        if (e.key === 'Escape') {
          cleanup();
          reject(new Error('Selection cancelled'));
        }
      }
      document.addEventListener('keydown', onKey);

      overlay.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startY = e.clientY;
        dragging = true;
        Object.assign(selectionBox.style, {
          left: startX + 'px',
          top: startY + 'px',
          width: '0px',
          height: '0px',
          display: 'block',
        });
      });

      overlay.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const x = Math.min(e.clientX, startX);
        const y = Math.min(e.clientY, startY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);
        Object.assign(selectionBox.style, {
          left: x + 'px',
          top: y + 'px',
          width: w + 'px',
          height: h + 'px',
        });
      });

      overlay.addEventListener('mouseup', async (e) => {
        if (!dragging) return;
        dragging = false;

        const rect = {
          x: Math.min(e.clientX, startX),
          y: Math.min(e.clientY, startY),
          w: Math.abs(e.clientX - startX),
          h: Math.abs(e.clientY - startY),
        };

        cleanup();

        if (rect.w < 10 || rect.h < 10) {
          reject(new Error('Selection too small'));
          return;
        }

        try {
          // Small delay for overlay removal
          await sleep(100);

          // Capture visible tab
          const response = await chrome.runtime.sendMessage({
            action: 'captureViewport',
          });
          if (!response?.dataUrl) {
            throw new Error('Failed to capture viewport');
          }

          const img = await loadImage(response.dataUrl);
          const dpr = window.devicePixelRatio || 1;

          const canvas = new OffscreenCanvas(
            rect.w * dpr,
            rect.h * dpr
          );
          const ctx = canvas.getContext('2d');
          ctx.drawImage(
            img,
            rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr,
            0, 0, rect.w * dpr, rect.h * dpr
          );

          const blob = await canvas.convertToBlob({
            type: 'image/jpeg',
            quality: 0.92,
          });
          const dataUrl = await blobToDataUrl(blob);
          // Save to storage so popup can pick it up when reopened
          chrome.storage.local.set({ capturedDataUrl: dataUrl });
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      });

      document.body.appendChild(overlay);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Metadata extraction per platform                                 */
  /* ---------------------------------------------------------------- */

  function extractMetadata() {
    const url = window.location.href;

    if (url.includes('linkedin.com')) return extractLinkedIn();
    if (url.includes('facebook.com/ads/library')) return extractMetaAds();
    if (url.includes('instagram.com')) return extractInstagram();
    if (url.includes('youtube.com')) return extractYouTube();

    return { platform: 'unknown', url };
  }

  function extractLinkedIn() {
    const data = { platform: 'linkedin', url: window.location.href };

    // Try to get focused post or first visible post
    const post = document.querySelector(
      '.feed-shared-update-v2, .occludable-update'
    );
    if (post) {
      const authorEl = post.querySelector(
        '.update-components-actor__name span[aria-hidden="true"], ' +
        '.feed-shared-actor__name span'
      );
      data.author = authorEl?.textContent?.trim() || null;

      const companyEl = post.querySelector(
        '.update-components-actor__description, ' +
        '.feed-shared-actor__description'
      );
      data.company = companyEl?.textContent?.trim() || null;

      const textEl = post.querySelector(
        '.feed-shared-update-v2__description, ' +
        '.update-components-text, ' +
        '.feed-shared-text'
      );
      data.postText =
        textEl?.textContent?.trim().substring(0, 500) || null;
    }

    // For profile pages
    const profileName = document.querySelector(
      'h1.text-heading-xlarge, .pv-text-details--left h1'
    );
    if (profileName) {
      data.brand = profileName.textContent.trim();
    }

    return data;
  }

  function extractMetaAds() {
    const data = {
      platform: 'meta-ads',
      url: window.location.href,
    };

    // Extract search/filter context
    const searchInput = document.querySelector(
      'input[placeholder*="Search"], input[type="search"]'
    );
    data.searchQuery = searchInput?.value || null;

    // Try to extract ad cards
    const adCards = document.querySelectorAll(
      '[class*="ad-card"], [data-testid*="ad_card"], ._7jvw'
    );
    if (adCards.length > 0) {
      data.adCount = adCards.length;
      const firstCard = adCards[0];

      const brandEl = firstCard.querySelector(
        '[class*="page-name"], strong, h4'
      );
      data.brand = brandEl?.textContent?.trim() || null;

      const textEl = firstCard.querySelector(
        '[class*="ad-text"], [class*="_4ik4"], p'
      );
      data.adText =
        textEl?.textContent?.trim().substring(0, 500) || null;

      // Ad Library ID from URL params
      const urlParams = new URLSearchParams(window.location.search);
      data.libraryId = urlParams.get('id') || null;
    }

    return data;
  }

  function extractInstagram() {
    const data = {
      platform: 'instagram',
      url: window.location.href,
    };

    // Profile page
    const usernameEl = document.querySelector(
      'header h2, header h1, [class*="x1lliihq"]'
    );
    data.username = usernameEl?.textContent?.trim() || null;

    // Post page
    const postText = document.querySelector(
      '[class*="C4VMK"] span, article [class*="_a9zs"] span, ' +
      'ul li:first-child span'
    );
    data.postText =
      postText?.textContent?.trim().substring(0, 500) || null;

    // Try to detect brand/username from URL
    const pathMatch = window.location.pathname.match(/^\/([^/]+)/);
    if (pathMatch && !['p', 'reel', 'stories', 'explore'].includes(pathMatch[1])) {
      data.brand = pathMatch[1];
    }

    return data;
  }

  function extractYouTube() {
    const data = {
      platform: 'youtube',
      url: window.location.href,
    };

    // Video page
    const titleEl = document.querySelector(
      'h1.ytd-watch-metadata yt-formatted-string, ' +
      '#title h1 yt-formatted-string, ' +
      'h1.title'
    );
    data.videoTitle = titleEl?.textContent?.trim() || null;

    const channelEl = document.querySelector(
      '#channel-name yt-formatted-string a, ' +
      'ytd-channel-name yt-formatted-string a, ' +
      '.ytd-video-owner-renderer yt-formatted-string a'
    );
    data.channel = channelEl?.textContent?.trim() || null;
    data.brand = data.channel;

    const descEl = document.querySelector(
      '#description-inline-expander yt-formatted-string, ' +
      '#description yt-formatted-string, ' +
      'ytd-text-inline-expander yt-formatted-string'
    );
    data.description =
      descEl?.textContent?.trim().substring(0, 500) || null;

    return data;
  }

  /* ---------------------------------------------------------------- */
  /*  Utility helpers                                                  */
  /* ---------------------------------------------------------------- */

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      // In a content script we can use the page's Image constructor
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
})();
