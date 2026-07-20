import { useEffect } from 'react';

import { pathFromLocation, type NavigationLocation } from '../auth/moduleNavigation';

const PAGE_SCROLL_STORAGE_PREFIX = 'filtrovali:page-scroll:';
const SETUP_MAX_FRAMES = 30;
const RESTORE_MAX_FRAMES = 60;
const RESTORE_OBSERVER_MS = 5_000;

type PageScrollRestorationOptions = {
  location: NavigationLocation;
  identity?: string | null;
  enabled?: boolean;
};

function safeSessionStorageGet(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage pode estar indisponível em modo privado/restrito.
  }
}

function readStoredScrollTop(storageKey: string) {
  const stored = Number(safeSessionStorageGet(storageKey) || '0');
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

function writeScrollTop(storageKey: string, scrollTop: number) {
  safeSessionStorageSet(storageKey, String(Math.max(0, Math.round(scrollTop))));
}

export function pageScrollStorageKey(location: NavigationLocation, identity = 'anonymous') {
  return `${PAGE_SCROLL_STORAGE_PREFIX}${identity || 'anonymous'}:${pathFromLocation(location)}`;
}

export function restorePageScrollTop(container: HTMLElement, top: number) {
  if (typeof window === 'undefined') return () => undefined;

  let attempts = 0;
  let frame = 0;
  let timeout = 0;
  let cancelled = false;
  let observer: MutationObserver | null = null;

  const stopObserver = () => {
    observer?.disconnect();
    observer = null;
  };

  const apply = () => {
    if (cancelled) return;
    container.scrollTop = top;
    attempts += 1;
    if (attempts < RESTORE_MAX_FRAMES && Math.abs(container.scrollTop - top) > 2) {
      frame = window.requestAnimationFrame(apply);
      return;
    }
    stopObserver();
  };

  const scheduleApply = () => {
    if (cancelled) return;
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(apply);
  };

  scheduleApply();

  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(scheduleApply);
    observer.observe(container, { childList: true, subtree: true });
    timeout = window.setTimeout(stopObserver, RESTORE_OBSERVER_MS);
  }

  return () => {
    cancelled = true;
    if (frame) window.cancelAnimationFrame(frame);
    if (timeout) window.clearTimeout(timeout);
    stopObserver();
  };
}

export function usePageScrollRestoration({
  location,
  identity,
  enabled = true
}: PageScrollRestorationOptions) {
  const storageKey = pageScrollStorageKey(location, identity || 'anonymous');

  useEffect(() => {
    if (!enabled || typeof document === 'undefined' || typeof window === 'undefined') return undefined;

    let cancelled = false;
    let setupAttempts = 0;
    let setupFrame = 0;
    let saveFrame = 0;
    let cleanupRestore: (() => void) | undefined;
    let cleanupScrollListener: (() => void) | undefined;

    const setup = () => {
      if (cancelled) return;
      const container = document.querySelector<HTMLElement>('.page-scroll');
      if (!container) {
        setupAttempts += 1;
        if (setupAttempts < SETUP_MAX_FRAMES) {
          setupFrame = window.requestAnimationFrame(setup);
        }
        return;
      }

      const saveScroll = () => writeScrollTop(storageKey, container.scrollTop);
      const scheduleSave = () => {
        if (saveFrame) return;
        saveFrame = window.requestAnimationFrame(() => {
          saveFrame = 0;
          saveScroll();
        });
      };

      container.addEventListener('scroll', scheduleSave, { passive: true });
      cleanupScrollListener = () => {
        if (saveFrame) window.cancelAnimationFrame(saveFrame);
        saveFrame = 0;
        saveScroll();
        container.removeEventListener('scroll', scheduleSave);
      };

      const stored = readStoredScrollTop(storageKey);
      if (stored > 0) cleanupRestore = restorePageScrollTop(container, stored);
    };

    setupFrame = window.requestAnimationFrame(setup);

    return () => {
      cancelled = true;
      if (setupFrame) window.cancelAnimationFrame(setupFrame);
      cleanupRestore?.();
      cleanupScrollListener?.();
    };
  }, [enabled, storageKey]);
}
