import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

// Debug logging for mobile
console.log('[App] Starting up...');
console.log('[App] UserAgent:', navigator.userAgent);
console.log('[App] localStorage available:', typeof localStorage !== 'undefined');

// Catch any errors
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
  console.log('[App] Rendered successfully');
} catch (err) {
  console.error('[App] Failed to start:', err);
  document.body.innerHTML = `<div style="padding: 20px; color: red;">Error: ${err instanceof Error ? err.message : 'Unknown error'}</div>`;
}
