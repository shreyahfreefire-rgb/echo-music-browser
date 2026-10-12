import { argbFromHex, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities';

/** Web stand-in for materialKolor TonalSpot / Android dynamic color. */
export function applyTheme(seed: string, dark: boolean) {
  const t = themeFromSourceColor(argbFromHex(seed)); const s = dark ? t.schemes.dark : t.schemes.light; const n = t.palettes.neutral;
  const v: Record<string, number> = {
    primary: s.primary, 'on-primary': s.onPrimary, 'primary-container': s.primaryContainer, 'on-primary-container': s.onPrimaryContainer,
    surface: n.tone(dark ? 8 : 98), 'on-surface': s.onSurface, 'surface-variant': s.surfaceVariant, 'on-surface-variant': s.onSurfaceVariant,
    outline: s.outline, 'surface-highest': n.tone(dark ? 22 : 90),
  };
  const root = document.documentElement.style;
  for (const [k, c] of Object.entries(v)) root.setProperty(`--${k}`, hexFromArgb(c));
  root.setProperty('--surface-tint', dark ? '#121212' : '#FAFAFA');
  document.documentElement.dataset.dark = String(dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', hexFromArgb(v.surface));
}
