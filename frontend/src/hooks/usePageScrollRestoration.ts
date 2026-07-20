import { useEffect } from 'react';

import { pathFromLocation, type NavigationLocation } from '../auth/moduleNavigation';

const PAGE_SCROLL_STORAGE_PREFIX = 'filtrovali:page-scroll:';
const SETUP_MAX_FRAMES = 30;
const RESTORE_MAX_FRAMES = 60;
const RESTORE_OBSERVER_MS = 30_000;
const RESTORE_SCROLL_STATE_KEY = 'restoreScrollTop';

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

function normalizeScrollTop(value: unknown) {
  const scrollTop = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(scrollTop) && scrollTop > 0 ? Math.round(scrollTop) : 0;
}

function currentPageScrollTop() {
  if (typeof document === 'undefined') return 0;
  const container = document.querySelector<HTMLElement>('.page-scroll');
  return container ? normalizeScrollTop(container.scrollTop) : 0;
}

function scrollTopFromState(state: unknown) {
  if (!state || typeof state !== 'object') return 0;
  return normalizeScrollTop((state as Record<string, unknown>)[RESTORE_SCROLL_STATE_KEY]);
}

export function pageScrollStorageKey(location: NavigationLocation, identity = 'anonymous') {
  return `${PAGE_SCROLL_STORAGE_PREFIX}${identity || 'anonymous'}:${pathFromLocation(location)}`;
}

export function currentPageScrollState() {
  const scrollTop = currentPageScrollTop();
  return scrollTop > 0 ? { [RESTORE_SCROLL_STATE_KEY]: scrollTop } : {};
}

export function saveCurrentPageScroll(location: NavigationLocation, identity = 'anonymous') {
  const scrollTop = currentPageScrollTop();
  if (scrollTop > 0) writeScrollTop(pageScrollStorageKey(location, identity), scrollTop);
  return scrollTop;
}

export function pageScrollRestoreStateFromNavigation(state: unknown) {
  const scrollTop = scrollTopFromState(state);
  return scrollTop > 0 ? { [RESTORE_SCROLL_STATE_KEY]: scrollTop } : undefined;
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
    if (Math.abs(container.scrollTop - top) <= 2) stopObserver();
  };

  const scheduleApply = () => {
    if (cancelled) return;
    if (frame) window.cancelAnimationFrame(frame);
    attempts = 0;
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
  const restoreScrollTop = scrollTopFromState(location.state);

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

      const stored = restoreScrollTop || readStoredScrollTop(storageKey);
      if (restoreScrollTop > 0) writeScrollTop(storageKey, restoreScrollTop);
      if (stored > 0) cleanupRestore = restorePageScrollTop(container, stored);
    };

    setupFrame = window.requestAnimationFrame(setup);

    return () => {
      cancelled = true;
      if (setupFrame) window.cancelAnimationFrame(setupFrame);
      cleanupRestore?.();
      cleanupScrollListener?.();
    };
  }, [enabled, restoreScrollTop, storageKey]);
}
