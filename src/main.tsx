import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './App';

// Simple error boundary to surface runtime mount/render errors
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [err, setErr] = React.useState<Error | null>(null);
  React.useEffect(() => {
    const onError = (e: ErrorEvent) => setErr(e.error ?? new Error(String(e.message)));
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, []);
  if (err) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#900' }}>
        <h2>Application error</h2>
        <pre>{String(err.stack ?? err.message ?? err)}</pre>
      </div>
    );
  }
  return <>{children}</>;
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

// Keep a global reference to the root so HMR remounts don't create multiple roots
declare global {
  interface Window { __REACT_ROOT__?: Root; }
}

let root = window.__REACT_ROOT__;
if (!root) {
  root = createRoot(container);
  window.__REACT_ROOT__ = root;
}

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Accept HMR updates (Vite)
if (import.meta.hot) {
  import.meta.hot.accept();
}