// Passage art pipeline: recolour a neutral render per palette using its region mask.
// Usage: node scripts/passage-art/tint_proof.cjs <dir with beauty.png + mask.png>/  → tint_proof.png
// This is the multiply the game will do in canvas (cached once per palette, not per frame).
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const A = process.argv[2];
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(A + f).toString('base64');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 6 * 140 + 20, height: 260 });
  await p.setContent('<body style="margin:0;background:#241c3d"><canvas id=c width=860 height=260></canvas></body>');
  await p.evaluate(async (beauty, mask) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [bi, mi] = await Promise.all([load(beauty), load(mask)]);
    const get = img => { const c = new OffscreenCanvas(128, 192); const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, 128, 192); };
    const B = get(bi), M = get(mi);
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const PALS = [
      ['avatar (as rendered)', null],
      ['avatar tints', { skin: '#F5CBA7', tunic: '#e9dfcc', legs: '#6f6390', hair: '#3b2a20' }],
      ['earth', { tunic: '#b98a55', legs: '#6b4a2e', skin: '#d2aa80', hair: '#4a3522' }],
      ['fire', { tunic: '#ff9446', legs: '#b8401e', skin: '#ffc49a', hair: '#ff5a1e' }],
      ['air', { tunic: '#eef9ff', legs: '#a4cdec', skin: '#e8f4fb', hair: '#c4e2f6' }],
      ['water', { tunic: '#6cc0ff', legs: '#2a6cb8', skin: '#aedcf8', hair: '#1f4f94' }],
    ];
    const ctx = document.getElementById('c').getContext('2d');
    PALS.forEach(([name, pal], k) => {
      const out = new ImageData(128, 192);
      for (let i = 0; i < B.data.length; i += 4){
        const r = M.data[i] / 255, g = M.data[i + 1] / 255, bl = M.data[i + 2] / 255;
        const hair = Math.min(r, g, bl), w = { skin: r - hair, tunic: g - hair, legs: bl - hair, hair };
        let c = [0, 0, 0];
        if (!pal) c = [1, 1, 1];
        else for (const key in w){ const h = hex(pal[key]); c = c.map((v, j) => v + w[key] * h[j]); }
        const sum = Math.max(1e-3, w.skin + w.tunic + w.legs + w.hair);
        if (pal) c = c.map(v => v / sum);
        // multiply: the render carries light and shade; the palette carries hue
        const g0 = B.data[i] / 255 * 1.18;
        out.data[i] = Math.min(255, g0 * c[0] * 255); out.data[i + 1] = Math.min(255, g0 * c[1] * 255); out.data[i + 2] = Math.min(255, g0 * c[2] * 255);
        out.data[i + 3] = B.data[i + 3];
      }
      const t = new OffscreenCanvas(128, 192); t.getContext('2d').putImageData(out, 0, 0);
      ctx.drawImage(t, 10 + k * 140, 10);
      ctx.fillStyle = '#cfc6e6'; ctx.font = '11px monospace'; ctx.fillText(name, 12 + k * 140, 222);
    });
    ctx.fillStyle = '#8a82a6'; ctx.fillText('one neutral Blender render + one region mask → any palette in canvas (multiply)', 12, 248);
  }, b64('beauty.png'), b64('mask.png'));
  await p.screenshot({ path: A + 'tint_proof.png' });
  await b.close();
})();
