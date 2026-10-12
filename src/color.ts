/** Dominant vivid colour of a cover (stand-in for PlayerColorExtractor.kt). */
export const dominant = (url: string) => new Promise<string | null>((res) => {
  const i = new Image(); i.crossOrigin = 'anonymous'; i.onerror = () => res(null);
  i.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d')!; x.drawImage(i, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, w = 0;
      for (let k = 0; k < d.length; k += 4) {
        const mx = Math.max(d[k], d[k + 1], d[k + 2]), mn = Math.min(d[k], d[k + 1], d[k + 2]); const sat = mx ? (mx - mn) / mx : 0;
        const wt = 0.05 + sat * sat * (1 - Math.abs(mx / 255 - 0.5)); r += d[k] * wt; g += d[k + 1] * wt; b += d[k + 2] * wt; w += wt;
      }
      res(`rgb(${(r / w) | 0},${(g / w) | 0},${(b / w) | 0})`);
    } catch { res(null); }
  };
  i.src = url;
});
