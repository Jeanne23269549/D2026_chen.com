const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function parseHSL(str) {
  const m = (str || '').match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!m) return { h: 40, s: 80, l: 80 };
  return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
}

const CSS = `
:host{
  --edge-proximity:0;
  --cursor-angle:45deg;
  --edge-sensitivity:30;
  --color-sensitivity:calc(var(--edge-sensitivity) + 20);
  --border-radius:28px;
  --glow-padding:40px;
  --cone-spread:25;
  --fill-opacity:.5;
  display:block;
}
.card{
  position:relative;
  border-radius:var(--border-radius);
  isolation:isolate;
  transform:translate3d(0,0,.01px);
  display:grid;
  border:1px solid rgb(255 255 255 / 15%);
  background:var(--card-bg,#120F17);
  overflow:visible;
  box-shadow:rgba(0,0,0,.1) 0 1px 2px,rgba(0,0,0,.1) 0 2px 4px,rgba(0,0,0,.1) 0 4px 8px,rgba(0,0,0,.1) 0 8px 16px,rgba(0,0,0,.1) 0 16px 32px,rgba(0,0,0,.1) 0 32px 64px;
}
.card::before,.card::after,.edge-light{
  content:"";position:absolute;inset:0;border-radius:inherit;
  transition:opacity .25s ease-out;z-index:-1;
}
.card:not(:hover):not(.sweep-active)::before,
.card:not(:hover):not(.sweep-active)::after,
.card:not(:hover):not(.sweep-active) .edge-light{
  opacity:0;transition:opacity .75s ease-in-out;
}
.card::before{
  border:1px solid transparent;
  background:
    linear-gradient(var(--card-bg,#120F17) 0 100%) padding-box,
    linear-gradient(rgb(255 255 255 / 0%) 0% 100%) border-box,
    var(--gradient-one) border-box,
    var(--gradient-two) border-box,
    var(--gradient-three) border-box,
    var(--gradient-four) border-box,
    var(--gradient-five) border-box,
    var(--gradient-six) border-box,
    var(--gradient-seven) border-box,
    var(--gradient-base) border-box;
  opacity:calc((var(--edge-proximity) - var(--color-sensitivity)) / (100 - var(--color-sensitivity)));
  mask-image:conic-gradient(from var(--cursor-angle) at center,
    black calc(var(--cone-spread) * 1%),
    transparent calc((var(--cone-spread) + 15) * 1%),
    transparent calc((100 - var(--cone-spread) - 15) * 1%),
    black calc((100 - var(--cone-spread)) * 1%));
}
.card::after{
  border:1px solid transparent;
  background:
    var(--gradient-one) padding-box,
    var(--gradient-two) padding-box,
    var(--gradient-three) padding-box,
    var(--gradient-four) padding-box,
    var(--gradient-five) padding-box,
    var(--gradient-six) padding-box,
    var(--gradient-seven) padding-box,
    var(--gradient-base) padding-box;
  mask-image:
    linear-gradient(to bottom,black,black),
    radial-gradient(ellipse at 50% 50%,black 40%,transparent 65%),
    radial-gradient(ellipse at 66% 66%,black 5%,transparent 40%),
    radial-gradient(ellipse at 33% 33%,black 5%,transparent 40%),
    radial-gradient(ellipse at 66% 33%,black 5%,transparent 40%),
    radial-gradient(ellipse at 33% 66%,black 5%,transparent 40%),
    conic-gradient(from var(--cursor-angle) at center,transparent 5%,black 15%,black 85%,transparent 95%);
  mask-composite:subtract,add,add,add,add,add;
  opacity:calc(var(--fill-opacity) * (var(--edge-proximity) - var(--color-sensitivity)) / (100 - var(--color-sensitivity)));
  mix-blend-mode:soft-light;
}
.edge-light{
  inset:calc(var(--glow-padding) * -1);
  pointer-events:none;z-index:1;
  mask-image:conic-gradient(from var(--cursor-angle) at center,black 2.5%,transparent 10%,transparent 90%,black 97.5%);
  opacity:calc((var(--edge-proximity) - var(--edge-sensitivity)) / (100 - var(--edge-sensitivity)));
  mix-blend-mode:plus-lighter;
}
.edge-light::before{
  content:"";position:absolute;inset:var(--glow-padding);border-radius:inherit;
  box-shadow:
    inset 0 0 0 1px var(--glow-color),
    inset 0 0 1px 0 var(--glow-color-60),
    inset 0 0 3px 0 var(--glow-color-50),
    inset 0 0 6px 0 var(--glow-color-40),
    inset 0 0 15px 0 var(--glow-color-30),
    inset 0 0 25px 2px var(--glow-color-20),
    inset 0 0 50px 2px var(--glow-color-10),
    0 0 1px 0 var(--glow-color-60),
    0 0 3px 0 var(--glow-color-50),
    0 0 6px 0 var(--glow-color-40),
    0 0 15px 0 var(--glow-color-30),
    0 0 25px 2px var(--glow-color-20),
    0 0 50px 2px var(--glow-color-10);
}
.inner{display:flex;flex-direction:column;position:relative;z-index:1}
`;

class BorderGlow extends HTMLElement {
  static get observedAttributes() {
    return ['edgesensitivity', 'glowcolor', 'backgroundcolor', 'borderradius', 'glowradius', 'glowintensity', 'conespread', 'colors', 'fillopacity'];
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = CSS;
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<span class="edge-light"></span><div class="inner"><slot></slot></div>';
      root.append(style, card);
      this._card = card;
      card.addEventListener('pointermove', (e) => {
        this._px = e.clientX; this._py = e.clientY;
        if (this._pending) return;
        this._pending = true;
        requestAnimationFrame(() => { this._pending = false; this._move(); });
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        this.style.setProperty('--edge-proximity', '0');
      }, { passive: true });
    }
    this._sync();
  }

  attributeChangedCallback() { this._sync(); }

  attr(name) {
    return this.getAttribute(name) ?? this.getAttribute(name.toLowerCase());
  }

  num(name, fb) {
    const v = parseFloat(this.attr(name));
    return Number.isFinite(v) ? v : fb;
  }

  _move() {
    const card = this._card;
    const r = card.getBoundingClientRect();
    const cx = r.width / 2, cy = r.height / 2;
    const dx = this._px - r.left - cx, dy = this._py - r.top - cy;
    let kx = Infinity, ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    let deg = 0;
    if (dx !== 0 || dy !== 0) {
      deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (deg < 0) deg += 360;
    }
    this.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
    this.style.setProperty('--cursor-angle', deg.toFixed(3) + 'deg');
  }

  _sync() {
    if (!this.shadowRoot) return;
    const s = this.style;
    s.setProperty('--card-bg', this.attr('backgroundColor') || '#120F17');
    s.setProperty('--edge-sensitivity', String(this.num('edgeSensitivity', 30)));
    s.setProperty('--border-radius', this.num('borderRadius', 28) + 'px');
    s.setProperty('--glow-padding', this.num('glowRadius', 40) + 'px');
    s.setProperty('--cone-spread', String(this.num('coneSpread', 25)));
    s.setProperty('--fill-opacity', String(this.num('fillOpacity', 0.5)));

    const { h, sat, l } = (() => { const p = parseHSL(this.attr('glowColor') || '40 80 80'); return { h: p.h, sat: p.s, l: p.l }; })();
    const base = `${h}deg ${sat}% ${l}%`;
    const intensity = this.num('glowIntensity', 1);
    [[100, ''], [60, '-60'], [50, '-50'], [40, '-40'], [30, '-30'], [20, '-20'], [10, '-10']]
      .forEach(([o, k]) => s.setProperty('--glow-color' + k, `hsl(${base} / ${Math.min(o * intensity, 100)}%)`));

    const colors = (this.attr('colors') || '#c084fc,#f472b6,#38bdf8').split(',').map(c => c.trim());
    const keys = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    for (let i = 0; i < 7; i++) {
      const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
      s.setProperty('--gradient-' + keys[i], `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`);
    }
    s.setProperty('--gradient-base', `linear-gradient(${colors[0]} 0 100%)`);
  }
}

if (!customElements.get('border-glow')) customElements.define('border-glow', BorderGlow);
