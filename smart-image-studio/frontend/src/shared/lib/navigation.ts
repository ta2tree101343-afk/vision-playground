import { isBrowser } from './browser';

export type AppPath = '/' | '/result';

export function getCurrentPath(): AppPath {
  if (!isBrowser()) {
    return '/';
  }

  return window.location.pathname === '/result' ? '/result' : '/';
}

export function navigateTo(path: AppPath, replace = false): void {
  if (!isBrowser()) {
    return;
  }

  if (!replace && window.location.pathname === path) {
    return;
  }

  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }

  window.dispatchEvent(new Event('popstate'));
}
