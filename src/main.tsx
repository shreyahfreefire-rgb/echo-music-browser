import { createRoot } from 'react-dom/client';
import { applySettings } from './settings';
import './theme.css';
import { App } from './App';

applySettings();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
createRoot(document.getElementById('root')!).render(<App />);
