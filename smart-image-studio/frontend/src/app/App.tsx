import { useEffect, useState } from 'react';
import type { AppPath } from '@shared/lib/navigation';
import { getCurrentPath } from '@shared/lib/navigation';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './routes';

function App() {
  const [currentPath, setCurrentPath] = useState<AppPath>(() => getCurrentPath());

  useEffect(() => {
    function handleNavigation() {
      setCurrentPath(getCurrentPath());
    }

    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  return (
    <AppProviders>
      <AppRoutes currentPath={currentPath} />
    </AppProviders>
  );
}

export default App;
