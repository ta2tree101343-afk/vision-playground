import { useEffect, useState } from 'react';
import { ResultPage } from './pages/ResultPage';
import { StudioPage } from './pages/StudioPage';
import type { AppPath } from './utils/navigation';
import { getCurrentPath } from './utils/navigation';

function App() {
  const [currentPath, setCurrentPath] = useState<AppPath>(() => getCurrentPath());

  useEffect(() => {
    function handleNavigation() {
      setCurrentPath(getCurrentPath());
    }

    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  if (currentPath === '/result') {
    return <ResultPage />;
  }

  return <StudioPage />;
}

export default App;
