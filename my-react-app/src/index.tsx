import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SupabaseProvider } from './components/SupabaseProvider';
import { WebSocketProvider } from './components/WebSocketProvider';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <SupabaseProvider>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </SupabaseProvider>
  </React.StrictMode>
);