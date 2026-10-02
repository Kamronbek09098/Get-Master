import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/styles/global.css';
import { applyUiSize, getUiSize } from '@/lib/ui-size';
import '@/styles/polish.css';
import '@/styles/compact.css';
import '@/styles/cards.css';

applyUiSize(getUiSize());

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
