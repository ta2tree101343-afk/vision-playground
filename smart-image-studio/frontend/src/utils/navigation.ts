export type AppPath = '/' | '/result';

export function getCurrentPath(): AppPath {
  return window.location.pathname === '/result' ? '/result' : '/';
}

export function navigateTo(path: AppPath, replace = false): void {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }

  window.dispatchEvent(new PopStateEvent('popstate'));
}

