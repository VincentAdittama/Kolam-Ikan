import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { openUrl } from '@tauri-apps/plugin-opener'

if (import.meta.env.DEV) {
  import('@locator/runtime').then((locator) => {
    locator.setup({});
  });

  // --- AGGRESSIVE IDE LINK INTERCEPTOR ---
  // 1. Override window.open
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    console.log('[LocatorJS Interceptor] window.open called with:', url);
    if (typeof url === 'string') {
      if (url.startsWith('vscode:') || url.startsWith('cursor:') || url.startsWith('windsurf:') || url.startsWith('idea:') || url.startsWith('antigravity:')) {
        console.log('[LocatorJS Interceptor] Redirecting window.open to opener.openUrl:', url);
        openUrl(url).catch(err => console.error('[LocatorJS Interceptor] opener.openUrl failed:', err));
        return null;
      }
    }
    return originalOpen.apply(this, [url, target, features]);
  };

  // 2. Aggressive click interceptor (Capture Mode)
  window.addEventListener('click', (e) => {
    // Use composedPath to handle Shadow DOM (LocatorJS uses Shadow DOM)
    const path = e.composedPath();
    console.log('[LocatorJS Debug] Click detected. Path:', path.map(el => {
      if (el instanceof HTMLElement) return el.tagName;
      if (el instanceof Element) return el.tagName;
      return (el as { constructor: { name: string } }).constructor.name;
    }));

    // Find the anchor element in the path
    const target = path.find(el => {
      // Ensure we are checking an element that can have a tagName
      return el instanceof HTMLElement && el.tagName === 'A';
    }) as HTMLAnchorElement | undefined;
    
    if (target) {
      console.log('[LocatorJS Debug] Found anchor:', target, 'href:', target.href);
      if (target.href) {
        const url = target.href;
        // Check for custom protocols
        if (url.startsWith('vscode:') || url.startsWith('cursor:') || url.startsWith('windsurf:') || url.startsWith('idea:') || url.startsWith('antigravity:')) {
          e.preventDefault();
          e.stopImmediatePropagation();
          e.stopPropagation();
          
          console.log('[LocatorJS Interceptor] Intercepted LocatorJS link:', url);
          openUrl(url).catch(err => console.error('[LocatorJS Interceptor] Failed to open:', err));
        } else {
             console.log('[LocatorJS Debug] URL did not match known editors:', url);
        }
      }
    } else {
        console.log('[LocatorJS Debug] No anchor tag found in path.');
    }
  }, { capture: true });
  // ---------------------------------------
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
