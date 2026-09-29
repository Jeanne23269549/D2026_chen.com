const vertex = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);
  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;
  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);
  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));
  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;
  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);
  o=vec4(col,1.0);
}
void main(){ vec4 o=vec4(0.0); mainImage(o,gl_FragCoord.xy); fragColor=o; }
`;

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return [1, 1, 1];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
};

const NUM = {
  timeSpeed: 0.25, colorBalance: 0, warpStrength: 1, warpFrequency: 5, warpSpeed: 2,
  warpAmplitude: 50, blendAngle: 0, blendSoftness: 0.05, rotationAmount: 500,
  noiseScale: 2, grainAmount: 0.1, grainScale: 2, contrast: 1.5, gamma: 1,
  saturation: 1, centerX: 0, centerY: 0, zoom: 0.9
};

class GrainientBg extends HTMLElement {
  static get observedAttributes() {
    return Object.keys(NUM).concat(["color1", "color2", "color3", "grainanimated", "opacity"]);
  }

  connectedCallback() {
    this.style.display = "block";
    this.style.position = "absolute";
    this.style.inset = "0";
    this.style.overflow = "hidden";
    this.style.opacity = this.getAttribute("opacity") || "1";
    this._init();
  }

  disconnectedCallback() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._io) this._io.disconnect();
    if (this._onVis) document.removeEventListener("visibilitychange", this._onVis);
  }

  num(name, fallback) {
    const v = parseFloat(this.getAttribute(name));
    return Number.isFinite(v) ? v : fallback;
  }

  async _init() {
    if (this._booted) return;
    this._booted = true;
    let ogl;
    try {
      ogl = await import("https://esm.sh/ogl@1.0.11");
    } catch (e) {
      return;
    }
    if (!this.isConnected) return;
    const { Renderer, Program, Mesh, Triangle } = ogl;

    const renderer = new Renderer({
      webgl: 2, alpha: true, antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.25)
    });
    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    this.appendChild(canvas);

    const program = new Program(gl, {
      vertex, fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uTimeSpeed: { value: 0.25 }, uColorBalance: { value: 0 },
        uWarpStrength: { value: 1 }, uWarpFrequency: { value: 5 },
        uWarpSpeed: { value: 2 }, uWarpAmplitude: { value: 50 },
        uBlendAngle: { value: 0 }, uBlendSoftness: { value: 0.05 },
        uRotationAmount: { value: 500 }, uNoiseScale: { value: 2 },
        uGrainAmount: { value: 0.1 }, uGrainScale: { value: 2 },
        uGrainAnimated: { value: 0 }, uContrast: { value: 1.5 },
        uGamma: { value: 1 }, uSaturation: { value: 1 },
        uCenterOffset: { value: new Float32Array([0, 0]) }, uZoom: { value: 0.9 },
        uColor1: { value: new Float32Array([1, 1, 1]) },
        uColor2: { value: new Float32Array([1, 1, 1]) },
        uColor3: { value: new Float32Array([1, 1, 1]) }
      }
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    this._program = program;
    this._sync();

    const SCALE = 0.6;
    const setSize = () => {
      const r = this.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(r.width * SCALE)), Math.max(1, Math.floor(r.height * SCALE)));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      const res = program.uniforms.iResolution.value;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };
    let rzT;
    this._ro = new ResizeObserver(() => { clearTimeout(rzT); rzT = setTimeout(setSize, 120); });
    this._ro.observe(this);
    setSize();

    const t0 = performance.now();
    let visible = true, pageVisible = !document.hidden;
    let last = 0;
    const FRAME = 1000 / 30;
    const loop = (t) => {
      this._raf = requestAnimationFrame(loop);
      if (t - last < FRAME) return;
      last = t;
      program.uniforms.iTime.value = (t - t0) * 0.001;
      renderer.render({ scene: mesh });
    };
    const start = () => { if (visible && pageVisible && !this._raf) this._raf = requestAnimationFrame(loop); };
    const stop = () => { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } };
    this._io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { threshold: 0 });
    this._io.observe(this);
    this._onVis = () => { pageVisible = !document.hidden; pageVisible ? start() : stop(); };
    document.addEventListener("visibilitychange", this._onVis);
    start();
  }

  attributeChangedCallback(name) {
    if (name === "opacity") { this.style.opacity = this.getAttribute("opacity") || "1"; return; }
    this._sync();
  }

  _sync() {
    const p = this._program;
    if (!p) return;
    const u = p.uniforms;
    u.uTimeSpeed.value = this.num("timeSpeed", NUM.timeSpeed);
    u.uColorBalance.value = this.num("colorBalance", NUM.colorBalance);
    u.uWarpStrength.value = this.num("warpStrength", NUM.warpStrength);
    u.uWarpFrequency.value = this.num("warpFrequency", NUM.warpFrequency);
    u.uWarpSpeed.value = this.num("warpSpeed", NUM.warpSpeed);
    u.uWarpAmplitude.value = this.num("warpAmplitude", NUM.warpAmplitude);
    u.uBlendAngle.value = this.num("blendAngle", NUM.blendAngle);
    u.uBlendSoftness.value = this.num("blendSoftness", NUM.blendSoftness);
    u.uRotationAmount.value = this.num("rotationAmount", NUM.rotationAmount);
    u.uNoiseScale.value = this.num("noiseScale", NUM.noiseScale);
    u.uGrainAmount.value = this.num("grainAmount", NUM.grainAmount);
    u.uGrainScale.value = this.num("grainScale", NUM.grainScale);
    u.uGrainAnimated.value = this.hasAttribute("grainAnimated") ? 1 : 0;
    u.uContrast.value = this.num("contrast", NUM.contrast);
    u.uGamma.value = this.num("gamma", NUM.gamma);
    u.uSaturation.value = this.num("saturation", NUM.saturation);
    u.uCenterOffset.value = new Float32Array([this.num("centerX", 0), this.num("centerY", 0)]);
    u.uZoom.value = this.num("zoom", NUM.zoom);
    u.uColor1.value = new Float32Array(hexToRgb(this.getAttribute("color1") || "#662b39"));
    u.uColor2.value = new Float32Array(hexToRgb(this.getAttribute("color2") || "#1b123c"));
    u.uColor3.value = new Float32Array(hexToRgb(this.getAttribute("color3") || "#6a8bc2"));
  }
}

if (!customElements.get("grainient-bg")) customElements.define("grainient-bg", GrainientBg);
