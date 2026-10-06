// Procedural canvas textures so the project needs no binary assets.
import * as THREE from 'three';

function canvasTexture(w, h, draw, { repeat = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function speckle(g, w, h, amount) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

export function tileTexture(base, line, divisions = 2, noise = 14) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, noise);
    g.strokeStyle = line;
    g.lineWidth = 3;
    for (let i = 0; i <= divisions; i++) {
      const p = (i * w) / divisions;
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
    }
  });
}

// Cube skins (bought in the Workshop).
export function cubeTexture(skin = 'companion') {
  return canvasTexture(256, 256, (g, w, h) => {
    const frame = (fill, line) => {
      g.fillStyle = fill;
      g.fillRect(0, 0, w, 22); g.fillRect(0, h - 22, w, 22);
      g.fillRect(0, 0, 22, h); g.fillRect(w - 22, 0, 22, h);
      if (line) { g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(24, 24, w - 48, h - 48); }
    };
    switch (skin) {
      case 'crate':
        g.fillStyle = '#9a6b3d'; g.fillRect(0, 0, w, h); speckle(g, w, h, 18);
        g.strokeStyle = '#5c3d1f'; g.lineWidth = 10;
        for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        g.lineWidth = 22; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.stroke();
        frame('#5c3d1f');
        break;
      case 'neon':
        g.fillStyle = '#10101a'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#00f0ff'; g.lineWidth = 8; g.shadowColor = '#00f0ff'; g.shadowBlur = 16;
        g.strokeRect(20, 20, w - 40, h - 40); g.strokeRect(70, 70, w - 140, h - 140);
        g.shadowBlur = 0;
        break;
      case 'marble':
        g.fillStyle = '#eeeeee'; g.fillRect(0, 0, w, h); speckle(g, w, h, 8);
        g.strokeStyle = 'rgba(120,125,135,0.6)';
        for (let i = 0; i < 6; i++) {
          g.lineWidth = 1 + Math.random() * 3; let x = Math.random() * w, y = 0;
          g.beginPath(); g.moveTo(x, y);
          while (y < h) { y += 20; x += Math.random() * 40 - 20; g.lineTo(x, y); }
          g.stroke();
        }
        frame('#8a8f99');
        break;
      case 'glitch':
        g.fillStyle = '#1a0f1f'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          g.fillStyle = Math.random() < 0.5 ? '#ff2bd6' : '#00ff9c';
          g.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 80, 3 + Math.random() * 8);
        }
        frame('#ff2bd6');
        break;
      case 'gold':
        g.fillStyle = '#e8b83a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 14);
        frame('#a8741a', '#fff1a8');
        g.fillStyle = '#fff1a8'; g.font = 'bold 120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('★', w / 2, h / 2 + 6);
        break;
      default:
        g.fillStyle = '#c9ced3'; g.fillRect(0, 0, w, h); speckle(g, w, h, 10);
        frame('#5a6068');
        g.strokeStyle = '#ff8a1f'; g.lineWidth = 14;
        g.beginPath(); g.arc(w / 2, h / 2, 54, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#ff8a1f';
        g.beginPath(); g.arc(w / 2, h / 2, 18, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: false });
}

// Multi-line sign. `lines` is an array of strings or {text, size, color}.
export function signTexture(lines, opts = {}) {
  const { w = 512, h = 256, bg = '#15181c', fg = '#e8eef2', border = null, font = 'system-ui, sans-serif' } = opts;
  return canvasTexture(w, h, (g) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
    }
    const items = lines.map((l) => (typeof l === 'string' ? { text: l } : l));
    const sizes = items.map((l) => l.size ?? 48);
    const total = sizes.reduce((a, b) => a + b * 1.2, 0);
    let y = (h - total) / 2;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    items.forEach((l, i) => {
      g.fillStyle = l.color ?? fg;
      g.font = `bold ${sizes[i]}px ${font}`;
      g.fillText(l.text, w / 2, y + sizes[i] * 0.1);
      y += sizes[i] * 1.2;
    });
  }, { repeat: false });
}

// Transparent canvas with the exit code, sliced up later for the anamorphic puzzle.
export function codeCanvasTexture(code, color = '#9ff4ff', glow = '#3ae0ff') {
  return canvasTexture(1024, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = glow;
    g.shadowBlur = 24;
    g.fillStyle = color;
    g.font = 'bold 72px system-ui, sans-serif';
    g.fillText('EXIT CODE', w / 2, 80);
    g.font = 'bold 300px system-ui, sans-serif';
    g.fillText(code.split('').join(' '), w / 2, 310);
  }, { repeat: false });
}

export function floorMarkerTexture(color = '#3ae0ff') {
  return canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 10;
    g.beginPath(); g.arc(w / 2, h / 2, 110, 0, Math.PI * 2); g.stroke();
    // Eye glyph.
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(48, 128); g.quadraticCurveTo(128, 50, 208, 128); g.quadraticCurveTo(128, 206, 48, 128);
    g.stroke();
    g.fillStyle = color;
    g.beginPath(); g.arc(128, 128, 26, 0, Math.PI * 2); g.fill();
  }, { repeat: false });
}

// A canvas-backed texture you can redraw (keypad screen).
export function dynamicTexture(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, g: canvas.getContext('2d'), w, h };
}

export function dustTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });
}

// Seamless procedural surface patterns for generated worlds.
// style: tile | brick | hex | planks | marble | circuit | stripes | checker |
//        concrete | plates | dots | herringbone | grid | waves
export function patternTexture(style, base, line, seed = 1) {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = line;
    g.fillStyle = line;
    const strokeLine = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    switch (style) {
      case 'brick': {
        speckle(g, w, h, 18);
        g.lineWidth = 4;
        for (let r = 0; r < 8; r++) {
          const y = r * 32;
          strokeLine(0, y, w, y);
          const off = r % 2 ? 32 : 0;
          for (let x = off; x <= w; x += 64) strokeLine(x, y, x, y + 32);
        }
        break;
      }
      case 'hex': {
        speckle(g, w, h, 10);
        g.lineWidth = 3;
        const r = 32, dx = r * 1.5, dy = (Math.sqrt(3) * r) / 2;
        for (let col = -1; col <= 6; col++) {
          for (let row = -1; row <= 9; row++) {
            const cx = col * dx * (256 / (dx * 5.333));
            const cy = row * dy * 2 + (col % 2 ? dy : 0);
            g.beginPath();
            for (let k = 0; k <= 6; k++) {
              const a = (Math.PI / 3) * k;
              const px = cx + r * Math.cos(a) * 0.98, py = cy + r * Math.sin(a) * 0.98;
              k ? g.lineTo(px, py) : g.moveTo(px, py);
            }
            g.stroke();
          }
        }
        break;
      }
      case 'planks': {
        speckle(g, w, h, 12);
        g.lineWidth = 3;
        for (let x = 0; x <= w; x += 32) strokeLine(x, 0, x, h);
        g.globalAlpha = 0.35;
        g.lineWidth = 1;
        for (let i = 0; i < 40; i++) {
          const x = rnd() * w;
          g.beginPath(); g.moveTo(x, 0);
          g.bezierCurveTo(x + rnd() * 6 - 3, h / 3, x + rnd() * 6 - 3, (2 * h) / 3, x, h);
          g.stroke();
        }
        g.globalAlpha = 1;
        for (let x = 0; x < w; x += 32) strokeLine(x, Math.floor(rnd() * 8) * 32, x + 32, Math.floor(rnd() * 8) * 32 + 0.01);
        break;
      }
      case 'marble': {
        speckle(g, w, h, 8);
        g.globalAlpha = 0.5;
        for (let i = 0; i < 7; i++) {
          g.lineWidth = 0.6 + rnd() * 2.2;
          let x = rnd() * w, y = 0;
          g.beginPath(); g.moveTo(x, y);
          while (y < h) { y += 12 + rnd() * 20; x += rnd() * 40 - 20; g.lineTo(x, y); }
          g.stroke();
          // Wrap vertically by drawing the same vein shifted.
        }
        g.globalAlpha = 1;
        g.lineWidth = 2;
        strokeLine(0, 0, w, 0); strokeLine(0, 0, 0, h);
        break;
      }
      case 'circuit': {
        g.lineWidth = 2.5;
        for (let i = 0; i < 26; i++) {
          let x = Math.floor(rnd() * 16) * 16, y = Math.floor(rnd() * 16) * 16;
          g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * 32; else y += (rnd() < 0.5 ? -1 : 1) * 32;
            g.lineTo(x, y);
          }
          g.stroke();
          g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
        }
        break;
      }
      case 'stripes': {
        speckle(g, w, h, 8);
        g.lineWidth = 14;
        for (let k = -h; k < w + h; k += 32) strokeLine(k, 0, k + h, h);
        break;
      }
      case 'checker': {
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
        speckle(g, w, h, 8);
        break;
      }
      case 'concrete': {
        speckle(g, w, h, 26);
        g.globalAlpha = 0.18;
        for (let i = 0; i < 18; i++) {
          g.beginPath(); g.arc(rnd() * w, rnd() * h, 6 + rnd() * 30, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 0.6;
        g.lineWidth = 2;
        strokeLine(0, 0, w, 0); strokeLine(0, h / 2, w, h / 2);
        for (const x of [w * 0.25, w * 0.75]) for (const y of [h * 0.25, h * 0.75]) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 1;
        break;
      }
      case 'plates': {
        speckle(g, w, h, 10);
        g.lineWidth = 4;
        strokeLine(0, 0, w, 0); strokeLine(0, h / 2, w, h / 2); strokeLine(0, 0, 0, h); strokeLine(w / 2, 0, w / 2, h);
        for (let x = 10; x < w; x += w / 2 - 20) for (let y = 10; y < h; y += h / 2 - 20) {
          for (const [ox, oy] of [[0, 0], [w / 2 - 20, 0], [0, h / 2 - 20], [w / 2 - 20, h / 2 - 20]]) {
            g.beginPath(); g.arc((x + ox) % w, (y + oy) % h, 3.5, 0, Math.PI * 2); g.fill();
          }
        }
        break;
      }
      case 'dots': {
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          g.beginPath(); g.arc(x * 64 + (y % 2 ? 32 : 0) + 16, y * 64 + 32, 12, 0, Math.PI * 2); g.fill();
        }
        break;
      }
      case 'herringbone': {
        g.lineWidth = 3;
        for (let y = -32; y < h + 32; y += 32) {
          for (let x = 0; x < w; x += 64) {
            strokeLine(x, y, x + 32, y + 32); strokeLine(x + 32, y + 32, x + 64, y);
            strokeLine(x, y + 16, x + 32, y + 48); strokeLine(x + 32, y + 48, x + 64, y + 16);
          }
        }
        break;
      }
      case 'grid': {
        g.lineWidth = 2;
        for (let p = 0; p <= w; p += 32) { strokeLine(p, 0, p, h); strokeLine(0, p, w, p); }
        g.lineWidth = 4;
        strokeLine(0, 0, w, 0); strokeLine(0, 0, 0, h);
        break;
      }
      case 'waves': {
        g.lineWidth = 3;
        for (let y = 0; y < h; y += 32) {
          g.beginPath();
          for (let x = 0; x <= w; x += 4) g.lineTo(x, y + Math.sin((x / w) * Math.PI * 4) * 8);
          g.stroke();
        }
        speckle(g, w, h, 8);
        break;
      }
      default: { // tile
        speckle(g, w, h, 12);
        g.lineWidth = 3;
        for (let p = 0; p <= w; p += 128) { strokeLine(p, 0, p, h); strokeLine(0, p, w, p); }
      }
    }
  });
}
