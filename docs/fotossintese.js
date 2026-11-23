// fotossintese.js — simulador 3D da fotossíntese em níveis de zoom: planta → folha → célula (etapa 1).
// Os textos vêm de gerar_site.py (window.CFG). Cada nível é uma cena Three.js própria; as partículas
// (água, sais minerais, gás carbônico, luz, oxigênio e glicose) percorrem "rotas" dentro de cada cena.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const CFG = window.CFG;
const R = CFG.rotulos;
const $ = (id) => document.getElementById(id);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const limitar = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// números aleatórios com semente fixa: o modelo fica sempre igual ao recarregar
let semente = 20261123;
function rnd() {
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => a + (b - a) * rnd();
const escolher = (lista) => lista[Math.floor(rnd() * lista.length)];
function direcaoAleatoria() {
  const z = entre(-1, 1), a = entre(0, 2 * PI), r = Math.sqrt(1 - z * z);
  return V(r * Math.cos(a), z, r * Math.sin(a));
}

const CORES = { agua: 0x2f8cff, minerais: 0xb46cff, co2: 0x6f7682, luz: 0xffd92e, o2: 0x9ff0ff, glicose: 0xff9a1f };
const CSS_COR = (c) => "#" + c.toString(16).padStart(6, "0");

// ---------------------------------------------------------------- estado
const estado = { luz: 1, agua: 1, co2: 1, taxa: 1, caminhos: true, nomes: true, raiox: true, pausado: false, simbolos: false };
function calcularTaxa() {
  // fator limitante: a fotossíntese anda no ritmo do ingrediente que está em menor quantidade
  estado.taxa = Math.min(estado.luz, estado.agua, estado.co2);
}
const DENS = {
  agua: () => estado.agua * (0.35 + 0.65 * estado.luz),
  luz: () => estado.luz,
  co2: () => estado.taxa,
  o2: () => estado.taxa,
  glicose: () => estado.taxa,
};

// ---------------------------------------------------------------- renderizador
const cenaEl = $("cena");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
cenaEl.prepend(renderer.domElement);
const rotRenderer = new CSS2DRenderer();
rotRenderer.domElement.className = "camadaRotulos";
renderer.domElement.after(rotRenderer.domElement);

const camera = new THREE.PerspectiveCamera(45, 1, 0.03, 300);
const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.autoRotateSpeed = 0.8;

function rotulo(texto, pos, lado = "", extra = "") {
  const d = document.createElement("div");
  d.className = "rot3d";
  const s = document.createElement("span");
  s.textContent = texto;
  s.className = [lado, extra].join(" ").trim();
  d.appendChild(s);
  const o = new CSS2DObject(d);
  o.position.copy(pos);
  o.userData.rotulo = true;
  o.center.set(0.5, 0.5);
  return o;
}

const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85, flatShading: true, ...extra });
const matVidro = (cor, opacidade, extra = {}) => new THREE.MeshStandardMaterial({
  color: cor, transparent: true, opacity: opacidade, depthWrite: false, roughness: 0.4, side: THREE.DoubleSide, ...extra,
});

// cilindro ligando dois pontos (galhos)
function bastao(a, b, r1, r2, material, lados = 7) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, d.length(), lados), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return m;
}

// ---------------------------------------------------------------- rotas e partículas
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

function rotaCurva(pontos) {
  const c = new THREE.CatmullRomCurve3(pontos, false, "centripetal");
  return { comp: c.getLength(), ponto: (t, v) => c.getPointAt(t, v) };
}
// rota até um objeto que se move (cloroplastos): curva de Bézier recalculada a cada quadro
function rotaMovel(fA, fB, curva = 0.6) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Vector3();
  const desvio = direcaoAleatoria();
  fA(a); fB(b);
  return {
    comp: a.distanceTo(b) * 1.1,
    ponto(t, v) {
      fA(a); fB(b);
      m.lerpVectors(a, b, 0.5).addScaledVector(desvio, a.distanceTo(b) * 0.25 * curva);
      const u = 1 - t;
      return v.set(0, 0, 0).addScaledVector(a, u * u).addScaledVector(m, 2 * u * t).addScaledVector(b, t * t);
    },
  };
}

const geoEsfera = new THREE.SphereGeometry(1, 10, 8);
const geoHex = new THREE.CylinderGeometry(1, 1, 0.5, 6);
class Fluxo {
  constructor(tipo, rotas, { n = 60, vel = 1.5, tam = 0.06, minerais = 0 } = {}) {
    this.tipo = tipo; this.rotas = rotas; this.vel = vel; this.tam = tam;
    const geo = tipo === "glicose" ? geoHex : geoEsfera;
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, material, n);
    this.mesh.frustumCulled = false;
    this.p = [];
    const cor = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.p.push({ r: Math.floor(rnd() * rotas.length), t: rnd(), u: rnd(), giro: rnd() * 6, k: entre(0.8, 1.2) });
      const mineral = rnd() < minerais;
      this.mesh.setColorAt(i, cor.set(mineral ? CORES.minerais : CORES[tipo]));
    }
  }
  atualizar(dt) {
    const dens = DENS[this.tipo]();
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      let rota = this.rotas[p.r];
      p.t += (dt * this.vel * p.k) / rota.comp;
      if (p.t >= 1) {
        p.t -= 1; p.r = Math.floor(rnd() * this.rotas.length); p.u = rnd(); rota = this.rotas[p.r];
      }
      rota.ponto(p.t, _v);
      const s = this.tam * Math.min(1, Math.sin(PI * p.t) * 5) * limitar((dens - p.u) * 6);
      p.giro += dt * 2;
      _q.setFromEuler(_e.set(p.giro, p.giro * 0.7, 0));
      _m.compose(_v, _q, _s.set(s, s, s));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- níveis
function novoNivel(id, cam) {
  const cena = new THREE.Scene();
  const fluxos = new THREE.Group();
  cena.add(fluxos);
  return {
    id, cena, cam, fluxosGrupo: fluxos, fluxos: [], clicaveis: [], animar: () => {}, atualizarLuz: () => {},
    addFluxo(f) { this.fluxos.push(f); fluxos.add(f.mesh); },
  };
}
const CEU_DIA = new THREE.Color(0xbfe4ff), CEU_NOITE = new THREE.Color(0x0d1733);

// ================================================================ NÍVEL 1: A PLANTA
function criarPlanta() {
  const N = novoNivel("planta", { pos: V(10.5, 5.2, 14), alvo: V(0, 2.2, 0), min: 4, max: 34 });
  const cena = N.cena;
  cena.background = CEU_DIA.clone();

  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x6b4a2b, 1.1);
  cena.add(hemi);
  const posSol = V(-8.5, 8.5, 4.5);
  const sol = new THREE.DirectionalLight(0xfff1cc, 2.4);
  sol.position.copy(posSol);
  cena.add(sol);

  // Sol com brilho
  const matSol = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const esferaSol = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), matSol);
  esferaSol.position.copy(posSol);
  cena.add(esferaSol);
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,240,150,1)"); gr.addColorStop(0.35, "rgba(255,210,80,.55)"); gr.addColorStop(1, "rgba(255,200,60,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, transparent: true }));
  brilho.scale.set(5, 5, 1);
  brilho.position.copy(posSol);
  cena.add(brilho);
  cena.add(rotulo(R.sol, posSol.clone().add(V(0, -1.6, 0))));

  // ----- solo em corte (transparente para mostrar as raízes)
  const RS = 5.6, HS = 3.2;
  const solo = new THREE.Mesh(new THREE.CylinderGeometry(RS, RS, HS, 48, 1, true), matVidro(0x7a4a26, 0.5));
  solo.position.y = -HS / 2; solo.renderOrder = 2;
  cena.add(solo);
  const fundoSolo = new THREE.Mesh(new THREE.CircleGeometry(RS, 48), matVidro(0x5d3a1e, 0.55));
  fundoSolo.rotation.x = -PI / 2; fundoSolo.position.y = -HS;
  cena.add(fundoSolo);
  const grama = new THREE.Mesh(new THREE.CircleGeometry(RS, 48), matVidro(0x74c255, 0.5));
  grama.rotation.x = -PI / 2; grama.position.y = 0.002; grama.renderOrder = 3;
  cena.add(grama);
  const borda = new THREE.Mesh(new THREE.TorusGeometry(RS, 0.05, 6, 64), mat(0x4f8f35));
  borda.rotation.x = PI / 2;
  cena.add(borda);
  // pedrinhas e tufos de grama
  for (let i = 0; i < 16; i++) {
    const a = entre(0, 2 * PI), r = entre(1.2, RS - 0.4);
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(entre(0.1, 0.25)), mat(escolher([0x9e9e9e, 0x8d8073, 0xb0a597])));
    p.position.set(r * Math.cos(a), entre(-HS + 0.3, -0.3), r * Math.sin(a));
    cena.add(p);
  }
  const matTufo = mat(0x4caf50);
  for (let i = 0; i < 70; i++) {
    const a = entre(0, 2 * PI), r = Math.sqrt(rnd()) * (RS - 0.2);
    if (r < 0.7) continue;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, entre(0.2, 0.4), 4), matTufo);
    t.position.set(r * Math.cos(a), 0.12, r * Math.sin(a));
    t.rotation.z = entre(-0.3, 0.3);
    cena.add(t);
  }
  cena.add(rotulo(R.solo, V(RS * 0.72, -HS + 0.4, RS * 0.72), "dir"));

  // ----- materiais que ficam transparentes no modo "raio-X"
  const matCaule = mat(0x7a4a2a);
  const matRaiz = mat(0xc8a27a);
  N.raiox = (on) => {
    for (const m of [matCaule, matRaiz]) {
      m.transparent = on; m.opacity = on ? 0.42 : 1; m.depthWrite = !on; m.needsUpdate = true;
    }
    vasos.visible = on;
  };

  // ----- raízes (recursivas), guardando a ligação com a raiz "mãe" para montar as rotas da água
  const raizes = [];
  function raiz(inicio, dir, comp, raio, nivel, mae = null, tMae = 0) {
    const pts = [inicio.clone()];
    let p = inicio.clone();
    const d = dir.clone().normalize();
    const passos = 6;
    for (let i = 0; i < passos; i++) {
      d.add(V(entre(-0.35, 0.35), entre(-0.2, 0.05), entre(-0.35, 0.35))).normalize();
      if (d.y > -0.12) { d.y = -0.12; d.normalize(); }
      p = p.clone().addScaledVector(d, comp / passos);
      const rr = Math.hypot(p.x, p.z);
      if (rr > RS - 0.35) { p.x *= (RS - 0.35) / rr; p.z *= (RS - 0.35) / rr; }
      p.y = Math.max(p.y, -HS + 0.2);
      pts.push(p);
    }
    const curva = new THREE.CatmullRomCurve3(pts);
    const reg = { curva, mae, tMae, nivel };
    raizes.push(reg);
    cena.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 24, raio, 6), matRaiz));
    const ponta = new THREE.Mesh(new THREE.SphereGeometry(raio, 6, 5), matRaiz);
    ponta.position.copy(pts[pts.length - 1]);
    cena.add(ponta);
    if (nivel < 2) {
      const filhas = nivel === 0 ? 4 : 3;
      for (let k = 0; k < filhas; k++) {
        const t = entre(0.3, 0.9);
        const p0 = curva.getPointAt(t);
        const a = entre(0, 2 * PI);
        raiz(p0, V(Math.cos(a), -0.6, Math.sin(a)), comp * 0.5, raio * 0.48, nivel + 1, reg, t);
      }
    }
  }
  raiz(V(0, 0.1, 0), V(0, -1, 0), 2.6, 0.2, 0);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * 2 * PI + 0.4;
    raiz(V(0, -0.1, 0), V(Math.cos(a), -0.45, Math.sin(a)), 2.6, 0.15, 0);
  }
  cena.add(rotulo(R.raizes, V(-2.2, -1.6, 2.2), "esq"));

  // caminho de uma ponta de raiz até a base do caule (de dentro para fora da árvore de raízes)
  function caminhoRaiz(reg, deslocX = 0) {
    const pts = [];
    let r = reg, tIni = 1;
    while (r) {
      for (let i = 0; i <= 5; i++) {
        const t = tIni * (1 - i / 5);
        pts.push(r.curva.getPointAt(t).add(V(deslocX, 0, 0)));
      }
      tIni = r.tMae; r = r.mae;
    }
    return pts;
  }

  // ----- caule, vasos (xilema e floema) e galhos
  const ALT = 3.4;
  cena.add(bastao(V(0, -0.2, 0), V(0, ALT, 0), 0.42, 0.25, matCaule, 8));
  const vasos = new THREE.Group();
  const xil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ALT, 6), new THREE.MeshBasicMaterial({ color: 0x5aa8ff }));
  xil.position.set(0.11, ALT / 2, 0);
  const flo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ALT, 6), new THREE.MeshBasicMaterial({ color: 0xffb14a }));
  flo.position.set(-0.11, ALT / 2, 0);
  vasos.add(xil, flo);
  cena.add(vasos);
  cena.add(rotulo(R.caule, V(0.5, 1.6, 0.4), "dir"));
  cena.add(rotulo(R.xilema, V(0.35, 0.9, 0.35), "dir"));
  cena.add(rotulo(R.floema, V(-0.35, 2.3, 0.35), "esq"));

  const topo = V(0, ALT, 0);
  const ramos = [
    { fim: V(-1.6, 4.7, 0.5), copas: [V(-2.3, 5.2, 0.7), V(-1.4, 5.6, -0.4)] },
    { fim: V(1.5, 4.8, -0.2), copas: [V(2.3, 5.1, -0.3), V(1.4, 5.7, 0.6)] },
    { fim: V(0.2, 5.0, 1.4), copas: [V(0.4, 5.3, 2.0), V(-0.6, 6.0, 1.2)] },
    { fim: V(-0.2, 5.1, -1.4), copas: [V(0.3, 5.4, -2.1), V(-0.8, 6.1, -1.3)] },
    { fim: V(0.1, 5.8, 0), copas: [V(0.3, 6.6, 0.1)] },
  ];
  const copas = [];
  const grupoCopa = new THREE.Group();
  cena.add(grupoCopa);
  const coresCopa = [0x3f9e3a, 0x4caf50, 0x2e8b3a, 0x56b04a];
  for (const r of ramos) {
    cena.add(bastao(topo, r.fim, 0.2, 0.12, matCaule));
    for (const c of r.copas) {
      cena.add(bastao(r.fim, c, 0.1, 0.06, matCaule, 6));
      const raio = entre(1.0, 1.3);
      const geo = new THREE.IcosahedronGeometry(raio, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i);
        const f = 1 + 0.13 * Math.sin(_v.x * 3.1 + _v.y * 1.7) * Math.cos(_v.z * 2.3 - _v.y);
        pos.setXYZ(i, _v.x * f, _v.y * f * 0.85, _v.z * f);
      }
      geo.computeVertexNormals();
      const bolha = new THREE.Mesh(geo, mat(escolher(coresCopa)));
      bolha.position.copy(c);
      grupoCopa.add(bolha);
      copas.push({ c, raio, caminho: [topo, r.fim, c] });
    }
  }
  // folhinhas espalhadas pela copa
  const formaFolha = new THREE.Shape();
  formaFolha.moveTo(0, 0);
  formaFolha.quadraticCurveTo(0.16, 0.16, 0, 0.42);
  formaFolha.quadraticCurveTo(-0.16, 0.16, 0, 0);
  const geoFolha = new THREE.ShapeGeometry(formaFolha, 4);
  const folhas = new THREE.InstancedMesh(geoFolha, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 }), 320);
  const corF = new THREE.Color();
  for (let i = 0; i < 320; i++) {
    const cp = escolher(copas);
    const n = direcaoAleatoria();
    if (n.y < -0.5) n.y = -n.y * 0.3;
    n.normalize();
    _v.copy(cp.c).addScaledVector(n, cp.raio * entre(0.9, 1.05));
    const o = new THREE.Object3D();
    o.position.copy(_v);
    o.lookAt(_v.clone().add(n));
    o.rotateZ(entre(0, 2 * PI));
    o.rotateX(entre(-0.6, 0.6));
    o.scale.setScalar(entre(0.8, 1.2));
    o.updateMatrix();
    folhas.setMatrixAt(i, o.matrix);
    folhas.setColorAt(i, corF.set(escolher([0x5cbf4a, 0x6fd25a, 0x47a83c, 0x7bd66b])));
  }
  grupoCopa.add(folhas);
  cena.add(rotulo(R.folhas, V(-2.6, 6.6, 0.8), "esq"));

  // ----- a folha que pode ser clicada (entra no nível 2)
  const baseAlvo = V(2.0, 4.5, 2.0);
  const pontaAlvo = V(3.0, 4.2, 3.0);
  cena.add(bastao(V(1.2, 5.0, 1.3), baseAlvo, 0.05, 0.035, matCaule, 5));
  const formaGrande = new THREE.Shape();
  formaGrande.moveTo(0, 0);
  formaGrande.bezierCurveTo(0.55, 0.3, 0.5, 1.0, 0, 1.45);
  formaGrande.bezierCurveTo(-0.5, 1.0, -0.55, 0.3, 0, 0);
  const matAlvo = new THREE.MeshStandardMaterial({ color: 0x66dd44, emissive: 0x2f8f00, side: THREE.DoubleSide, roughness: 0.6 });
  const folhaAlvo = new THREE.Mesh(new THREE.ShapeGeometry(formaGrande, 10), matAlvo);
  folhaAlvo.position.copy(baseAlvo);
  folhaAlvo.lookAt(pontaAlvo);           // +z aponta para a ponta
  folhaAlvo.rotateX(PI / 2);             // a forma (desenhada em y) passa a crescer para a ponta
  folhaAlvo.rotateY(0.5);
  folhaAlvo.scale.setScalar(1.45);
  const nervuraAlvo = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 1.4, 4), new THREE.MeshBasicMaterial({ color: 0xcfffa8 }));
  nervuraAlvo.position.set(0, 0.7, 0.01);
  folhaAlvo.add(nervuraAlvo);
  cena.add(folhaAlvo);
  const centroAlvo = new THREE.Vector3();
  folhaAlvo.updateMatrixWorld(true);
  folhaAlvo.localToWorld(centroAlvo.set(0, 0.7, 0));
  cena.add(rotulo(R.folha_alvo, centroAlvo.clone().add(V(0.6, 0.6, 0.3)), "dir", "alvo"));
  N.clicaveis.push({ obj: folhaAlvo, acao: () => irPara("folha", centroAlvo) });

  // ----- frutos
  const matFruto = mat(0xe53935, { roughness: 0.5 });
  const frutos = [];
  for (const cp of copas.slice(0, 8)) {
    const a = entre(0, 2 * PI);
    const pf = cp.c.clone().add(V(Math.cos(a) * cp.raio * 0.55, -cp.raio * 0.95, Math.sin(a) * cp.raio * 0.55));
    const fr = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), matFruto);
    fr.position.copy(pf);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 4), matCaule);
    cab.position.copy(pf).add(V(0, 0.27, 0));
    cena.add(fr, cab);
    frutos.push({ pos: pf, copa: cp });
  }
  const maisBaixo = frutos.reduce((a, b) => (b.pos.y < a.pos.y ? b : a));
  cena.add(rotulo(R.frutos, maisBaixo.pos.clone().add(V(0.35, -0.35, 0)), "dir"));

  // ----- rotas das partículas
  const pontaCopa = (cp) => {
    const n = direcaoAleatoria();
    return cp.c.clone().addScaledVector(n, cp.raio * entre(0.3, 0.8));
  };
  const pontasRaiz = raizes.filter((r) => r.nivel >= 1);
  const rotasAgua = [], rotasGli = [], rotasCO2 = [], rotasO2 = [], rotasLuz = [];
  for (let i = 0; i < 36; i++) {
    const rr = escolher(pontasRaiz), cp = escolher(copas);
    const pts = caminhoRaiz(rr, 0.09);
    pts.push(V(0.11, 0.2, 0), V(0.11, ALT, 0), cp.caminho[1], pontaCopa(cp));
    rotasAgua.push(rotaCurva(pts));
  }
  for (let i = 0; i < 18; i++) {      // glicose: das folhas para as raízes, pelo floema
    const rr = escolher(pontasRaiz), cp = escolher(copas);
    const pts = [pontaCopa(cp), cp.caminho[1], V(-0.11, ALT, 0), V(-0.11, 0.2, 0)];
    pts.push(...caminhoRaiz(rr, -0.09).reverse());
    rotasGli.push(rotaCurva(pts));
  }
  for (const f of frutos) {           // glicose: das folhas para os frutos
    for (let k = 0; k < 2; k++) rotasGli.push(rotaCurva([pontaCopa(f.copa), f.copa.c.clone().lerp(f.pos, 0.6), f.pos]));
  }
  for (let i = 0; i < 30; i++) {
    const cp = escolher(copas);
    const fora = cp.c.clone().addScaledVector(direcaoAleatoria().setY(entre(-0.2, 0.6)).normalize(), entre(3.5, 5));
    const dentro = pontaCopa(cp);
    rotasCO2.push(rotaCurva([fora, fora.clone().lerp(dentro, 0.5).add(direcaoAleatoria().multiplyScalar(0.6)), dentro]));
    const cp2 = escolher(copas);
    const de = pontaCopa(cp2);
    const ate = cp2.c.clone().addScaledVector(direcaoAleatoria().setY(entre(0, 0.8)).normalize(), entre(3.5, 5));
    rotasO2.push(rotaCurva([de, de.clone().lerp(ate, 0.5).add(direcaoAleatoria().multiplyScalar(0.6)), ate]));
    const alvoLuz = cp.c.clone().addScaledVector(posSol.clone().sub(cp.c).normalize(), cp.raio * 0.9);
    rotasLuz.push(rotaCurva([posSol.clone().add(direcaoAleatoria().multiplyScalar(0.5)), alvoLuz]));
  }
  N.addFluxo(new Fluxo("agua", rotasAgua, { n: 130, vel: 1.4, tam: 0.075, minerais: 0.25 }));
  N.addFluxo(new Fluxo("glicose", rotasGli, { n: 70, vel: 1.1, tam: 0.085 }));
  N.addFluxo(new Fluxo("co2", rotasCO2, { n: 70, vel: 1.2, tam: 0.08 }));
  N.addFluxo(new Fluxo("o2", rotasO2, { n: 70, vel: 1.2, tam: 0.08 }));
  N.addFluxo(new Fluxo("luz", rotasLuz, { n: 60, vel: 7, tam: 0.07 }));

  // ----- animação e luz do dia
  N.atualizarLuz = (L) => {
    cena.background.copy(CEU_NOITE).lerp(CEU_DIA, L);
    sol.intensity = 0.25 + 2.3 * L;
    hemi.intensity = 0.35 + 0.8 * L;
    matSol.color.setHSL(0.13, 1, 0.25 + 0.45 * L);
    brilho.material.opacity = L;
  };
  N.animar = (dt, t) => {
    const pulso = 0.5 + 0.5 * Math.sin(t * 3.5);
    matAlvo.emissive.setRGB(0.12 + 0.25 * pulso, 0.45 + 0.35 * pulso, 0.05);
    grupoCopa.rotation.z = Math.sin(t * 0.7) * 0.008;
    brilho.scale.setScalar(5 + 0.4 * Math.sin(t * 2));
    // folhas murcham um pouco quando falta água
    const murcha = 1 - estado.agua;
    grupoCopa.position.y = -0.15 * murcha;
    folhas.material.color.setRGB(1, 1 - 0.25 * murcha, 1 - 0.5 * murcha);
  };
  return N;
}

// ================================================================ NÍVEL 2: POR DENTRO DA FOLHA
function criarFolha() {
  const N = novoNivel("folha", { pos: V(7.6, 4.4, 10.3), alvo: V(-1.0, -0.2, 0.4), min: 3, max: 24 });
  const cena = N.cena;
  cena.background = CEU_DIA.clone();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5c7a4a, 1.2);
  const sol = new THREE.DirectionalLight(0xfff1cc, 2.2);
  sol.position.set(-2, 10, 3);
  cena.add(hemi, sol);

  const LX = 4, LZ = 2.5;
  const objeto = new THREE.Object3D();
  const corI = new THREE.Color();

  // cutícula e epiderme superior
  const cut = new THREE.Mesh(new THREE.BoxGeometry(2 * LX + 0.1, 0.07, 2 * LZ + 0.1), matVidro(0xf3ffd6, 0.4, { roughness: 0.1 }));
  cut.position.y = 1.62;
  cena.add(cut);
  const NXE = 10, NZE = 6;
  const geoEpi = new RoundedBoxGeometry((2 * LX) / NXE - 0.04, 0.34, (2 * LZ) / NZE - 0.04, 2, 0.08);
  const epiSup = new THREE.InstancedMesh(geoEpi, new THREE.MeshStandardMaterial({ color: 0xe2f7cf, transparent: true, opacity: 0.7, roughness: 0.3 }), NXE * NZE);
  let k = 0;
  for (let i = 0; i < NXE; i++) for (let j = 0; j < NZE; j++) {
    objeto.position.set(-LX + (i + 0.5) * (2 * LX / NXE), 1.39, -LZ + (j + 0.5) * (2 * LZ / NZE));
    objeto.updateMatrix(); epiSup.setMatrixAt(k++, objeto.matrix);
  }
  cena.add(epiSup);

  // parênquima paliçádico (células altas, cheias de cloroplastos)
  const NXP = 14, NZP = 9;
  const geoPal = new THREE.CapsuleGeometry(0.22, 0.6, 4, 10);
  const pal = new THREE.InstancedMesh(geoPal, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), NXP * NZP);
  const celulasPal = [];
  let alvoPal = null;
  k = 0;
  for (let i = 0; i < NXP; i++) for (let j = 0; j < NZP; j++) {
    const p = V(-LX + (i + 0.5) * (2 * LX / NXP), 0.66, -LZ + (j + 0.5) * (2 * LZ / NZP));
    if (i === 3 && j === NZP - 1) { alvoPal = p; objeto.scale.setScalar(0.0001); }
    else objeto.scale.setScalar(1);
    objeto.position.copy(p); objeto.updateMatrix();
    pal.setMatrixAt(k, objeto.matrix);
    pal.setColorAt(k++, corI.set(escolher([0x58b947, 0x4fae40, 0x63c252])));
    celulasPal.push(p);
  }
  cena.add(pal);
  // cloroplastos na superfície das células
  const geoClo = new THREE.SphereGeometry(1, 8, 6);
  const POR = 12;
  const clos = new THREE.InstancedMesh(geoClo, mat(0x1b7a2a, { flatShading: false }), celulasPal.length * POR + 120);
  k = 0;
  const pontoNaCelula = (c, r, h) => {
    const a = entre(0, 2 * PI);
    return V(c.x + r * Math.cos(a), c.y + entre(-h, h), c.z + r * Math.sin(a));
  };
  for (const c of celulasPal) {
    for (let q = 0; q < POR; q++) {
      objeto.position.copy(pontoNaCelula(c, 0.2, 0.42));
      objeto.scale.set(0.06, 0.04, 0.06); objeto.rotation.set(entre(0, 3), entre(0, 3), 0);
      objeto.updateMatrix(); clos.setMatrixAt(k++, objeto.matrix);
    }
  }
  cena.add(clos);
  cena.add(rotulo(R.palicadico, V(-LX - 0.2, 0.66, LZ), "esq"));

  // célula destacada (clique para entrar)
  const matAlvo = new THREE.MeshStandardMaterial({ color: 0x7ee05a, emissive: 0x2a7a00, roughness: 0.5 });
  const celAlvo = new THREE.Mesh(geoPal, matAlvo);
  celAlvo.position.copy(alvoPal);
  cena.add(celAlvo);
  cena.add(rotulo(R.celula_alvo, alvoPal.clone().add(V(0, 1.4, 0.4)), "", "alvo"));
  N.clicaveis.push({ obj: celAlvo, acao: () => irPara("celula", alvoPal) });

  // nervura (corre de trás para a frente, aparece em corte na face da frente)
  const VX = 1.0, VY = -0.5, VR = 0.5;
  const bainha = new THREE.Mesh(new THREE.CylinderGeometry(VR, VR, 2 * LZ, 20, 1, true), matVidro(0xcfe8a0, 0.55));
  bainha.rotation.x = PI / 2; bainha.position.set(VX, VY, 0);
  cena.add(bainha);
  const tampa = new THREE.Mesh(new THREE.CircleGeometry(VR, 20), matVidro(0xe6f5c8, 0.5));
  tampa.position.set(VX, VY, LZ + 0.001);
  cena.add(tampa);
  const xilemas = [], floemas = [];
  for (const dx of [-0.2, 0, 0.2]) {
    const x = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 2 * LZ, 8), mat(0x2f7fe0, { flatShading: false }));
    x.rotation.x = PI / 2; x.position.set(VX + dx, VY + 0.2, 0); cena.add(x); xilemas.push(x.position);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2 * LZ, 8), mat(0xf08c1a, { flatShading: false }));
    f.rotation.x = PI / 2; f.position.set(VX + dx, VY - 0.2, 0); cena.add(f); floemas.push(f.position);
  }
  cena.add(rotulo(R.nervura, V(VX, VY + 0.75, LZ + 0.1)));
  cena.add(rotulo(R.xilema, V(VX + 0.45, VY + 0.2, LZ + 0.05), "dir"));
  cena.add(rotulo(R.floema, V(VX + 0.45, VY - 0.25, LZ + 0.05), "dir"));

  // parênquima lacunoso (células redondas soltas, com espaços de ar)
  const lac = [];
  for (let x = -LX + 0.3; x < LX; x += 0.62) for (let z = -LZ + 0.3; z < LZ; z += 0.62) for (const y of [-0.25, -0.8]) {
    const p = V(x + entre(-0.12, 0.12), y + entre(-0.08, 0.08), z + entre(-0.12, 0.12));
    if (rnd() < 0.28) continue;
    if (Math.hypot(p.x - VX, p.y - VY) < VR + 0.3) continue;
    lac.push(p);
  }
  const lacMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat(0xffffff), lac.length);
  lac.forEach((p, i) => {
    objeto.position.copy(p); objeto.rotation.set(entre(0, 3), entre(0, 3), 0);
    objeto.scale.set(entre(0.22, 0.3), entre(0.2, 0.26), entre(0.22, 0.3)); objeto.updateMatrix();
    lacMesh.setMatrixAt(i, objeto.matrix);
    lacMesh.setColorAt(i, corI.set(escolher([0x9ad77c, 0x8ccf6e, 0xa6de8a])));
    if (rnd() < 0.5 && k < clos.count) {
      objeto.position.copy(p).add(direcaoAleatoria().multiplyScalar(0.24));
      objeto.scale.set(0.05, 0.035, 0.05); objeto.updateMatrix(); clos.setMatrixAt(k++, objeto.matrix);
    }
  });
  clos.count = k;
  cena.add(lacMesh);
  cena.add(rotulo(R.lacunoso, V(-LX - 0.2, -0.55, LZ), "esq"));

  // epiderme inferior com estômatos
  const estomatos = [[1, 2], [3, 5], [6, 1], [7, 4], [8, 2], [4, 3]];
  const ehEstomato = (i, j) => estomatos.some(([a, b]) => a === i && b === j);
  const epiInf = new THREE.InstancedMesh(new RoundedBoxGeometry((2 * LX) / NXE - 0.04, 0.3, (2 * LZ) / NZE - 0.04, 2, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xdcf2c8, transparent: true, opacity: 0.8, roughness: 0.3 }), NXE * NZE);
  k = 0;
  for (let i = 0; i < NXE; i++) for (let j = 0; j < NZE; j++) {
    if (ehEstomato(i, j)) continue;
    objeto.position.set(-LX + (i + 0.5) * (2 * LX / NXE), -1.3, -LZ + (j + 0.5) * (2 * LZ / NZE));
    objeto.scale.setScalar(1); objeto.rotation.set(0, 0, 0); objeto.updateMatrix(); epiInf.setMatrixAt(k++, objeto.matrix);
  }
  epiInf.count = k;
  cena.add(epiInf);
  const geoGuarda = new THREE.TorusGeometry(0.24, 0.1, 8, 14, PI);
  const matGuarda = mat(0x6cc24a, { flatShading: false });
  const guardas = [];
  const posEst = estomatos.map(([i, j]) => V(-LX + (i + 0.5) * (2 * LX / NXE), -1.3, -LZ + (j + 0.5) * (2 * LZ / NZE)));
  for (const c of posEst) {
    const e = new THREE.Mesh(geoGuarda, matGuarda), d = new THREE.Mesh(geoGuarda, matGuarda);
    e.rotation.set(PI / 2, 0, PI / 2); d.rotation.set(PI / 2, 0, -PI / 2);
    cena.add(e, d);
    guardas.push({ c, e, d });
  }
  const frente = posEst.reduce((a, b) => (b.z > a.z ? b : a));
  cena.add(rotulo(R.estomato, frente.clone().add(V(0, -0.55, 0.2))));
  cena.add(rotulo(R.cuticula, V(-LX - 0.2, 1.68, LZ), "esq"));
  cena.add(rotulo(R.epiderme_sup, V(-LX - 0.2, 1.36, LZ), "esq"));
  cena.add(rotulo(R.epiderme_inf, V(-LX - 0.2, -1.3, LZ), "esq"));

  // ----- rotas
  const celulaQualquer = () => escolher(celulasPal);
  const alvoDentro = (c) => c.clone().add(V(entre(-0.1, 0.1), entre(-0.3, 0.3), entre(-0.1, 0.1)));
  const espacoAr = (c) => V(c.x + entre(-0.3, 0.3), entre(-0.95, -0.1), c.z + entre(-0.3, 0.3));
  const rotasLuz = [], rotasCO2 = [], rotasO2 = [], rotasAgua = [], rotasGli = [];
  for (let i = 0; i < 40; i++) {
    const c = celulaQualquer();
    rotasLuz.push(rotaCurva([V(c.x - 1.2, 5, c.z + 0.6), c.clone().add(V(0, 0.45, 0))]));
    const e = escolher(posEst);
    const perto = celulasPal.filter((p) => Math.hypot(p.x - e.x, p.z - e.z) < 1.4);
    const c2 = escolher(perto.length ? perto : celulasPal);
    rotasCO2.push(rotaCurva([V(e.x + entre(-1, 1), -3.6, e.z + entre(-1, 1)), V(e.x, -1.75, e.z), V(e.x, -1.3, e.z), espacoAr(e), alvoDentro(c2)]));
    const e2 = escolher(posEst);
    const perto2 = celulasPal.filter((p) => Math.hypot(p.x - e2.x, p.z - e2.z) < 1.4);
    const c3 = escolher(perto2.length ? perto2 : celulasPal);
    rotasO2.push(rotaCurva([alvoDentro(c3), espacoAr(e2), V(e2.x, -1.3, e2.z), V(e2.x, -1.75, e2.z), V(e2.x + entre(-1, 1), -3.6, e2.z + entre(-1, 1))]));
    const xi = escolher(xilemas), fl = escolher(floemas);
    const z = entre(-LZ + 0.3, LZ - 0.3);
    const c4 = celulasPal.filter((p) => Math.abs(p.z - z) < 0.5 && Math.abs(p.x - VX) < 2.2);
    const cel = escolher(c4.length ? c4 : celulasPal);
    rotasAgua.push(rotaCurva([V(xi.x, xi.y, -LZ - 0.6), V(xi.x, xi.y, z - 0.3), V(xi.x, xi.y + 0.1, z), V((xi.x + cel.x) / 2, 0.1, (z + cel.z) / 2), alvoDentro(cel)]));
    rotasGli.push(rotaCurva([alvoDentro(cel), V((fl.x + cel.x) / 2, -0.1, (z + cel.z) / 2), V(fl.x, fl.y - 0.05, z), V(fl.x, fl.y, z - 0.4), V(fl.x, fl.y, -LZ - 0.6)]));
  }
  N.addFluxo(new Fluxo("luz", rotasLuz, { n: 70, vel: 6, tam: 0.06 }));
  N.addFluxo(new Fluxo("co2", rotasCO2, { n: 80, vel: 1.0, tam: 0.07 }));
  N.addFluxo(new Fluxo("o2", rotasO2, { n: 80, vel: 1.0, tam: 0.07 }));
  N.addFluxo(new Fluxo("agua", rotasAgua, { n: 90, vel: 1.1, tam: 0.065, minerais: 0.2 }));
  N.addFluxo(new Fluxo("glicose", rotasGli, { n: 60, vel: 0.9, tam: 0.075 }));

  let abertura = 1;
  N.atualizarLuz = (L) => {
    cena.background.copy(CEU_NOITE).lerp(CEU_DIA, L);
    sol.intensity = 0.2 + 2.2 * L;
    hemi.intensity = 0.45 + 0.75 * L;
  };
  N.animar = (dt, t) => {
    const pulso = 0.5 + 0.5 * Math.sin(t * 3.5);
    matAlvo.emissive.setRGB(0.1 + 0.25 * pulso, 0.4 + 0.35 * pulso, 0.05);
    // estômatos: abertos com água; fecham quando falta
    const alvo = limitar((estado.agua - 0.2) / 0.4);
    abertura += (alvo - abertura) * Math.min(1, dt * 2.5);
    const gap = 0.07 + 0.1 * abertura;
    for (const g of guardas) {
      g.e.position.set(g.c.x - gap, g.c.y, g.c.z);
      g.d.position.set(g.c.x + gap, g.c.y, g.c.z);
    }
  };
  return N;
}

// ================================================================ NÍVEL 3: A CÉLULA VEGETAL
function criarCelula() {
  const N = novoNivel("celula", { pos: V(2.2, 4.0, 12.5), alvo: V(0, 0, 0), min: 3, max: 26 });
  const cena = N.cena;
  cena.background = new THREE.Color(0xdff3d6);
  const fundoDia = new THREE.Color(0xdff3d6), fundoNoite = new THREE.Color(0x14241a);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b8f5a, 1.3);
  const sol = new THREE.DirectionalLight(0xfff4d6, 1.8);
  sol.position.set(-3, 8, 5);
  cena.add(hemi, sol);

  // células vizinhas, só o contorno, para dar a ideia de tecido
  const matViz = matVidro(0xa5d38a, 0.07);
  for (const [x, y] of [[-7.4, 0], [7.4, 0], [0, 4.8], [0, -4.8], [-7.4, 4.8], [7.4, -4.8]]) {
    const viz = new THREE.Mesh(new RoundedBoxGeometry(7, 4.4, 4.4, 3, 0.6), matViz);
    viz.position.set(x, y, 0);
    cena.add(viz);
  }

  const parede = new THREE.Mesh(new RoundedBoxGeometry(7, 4.4, 4.4, 4, 0.6), matVidro(0x8bc34a, 0.24));
  parede.renderOrder = 5;
  const membrana = new THREE.Mesh(new RoundedBoxGeometry(6.55, 3.95, 3.95, 4, 0.5), matVidro(0xfff176, 0.16));
  membrana.renderOrder = 4;
  cena.add(parede, membrana);
  cena.add(rotulo(R.parede, V(-3.55, 2.25, 2.25), "esq"));
  cena.add(rotulo(R.membrana, V(3.3, -2.0, 2.0), "dir"));
  cena.add(rotulo(R.citoplasma, V(2.85, 1.55, 1.75), "dir"));

  // vacúolo (deformado para parecer orgânico)
  const geoVac = new THREE.SphereGeometry(1, 40, 28);
  const pv = geoVac.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    _v.fromBufferAttribute(pv, i);
    const f = 1 + 0.06 * Math.sin(_v.x * 5 + _v.y * 3) + 0.05 * Math.cos(_v.z * 4 - _v.x * 2);
    pv.setXYZ(i, _v.x * f * 2.05, _v.y * f * 1.2, _v.z * f * 1.2);
  }
  geoVac.computeVertexNormals();
  const vacuolo = new THREE.Mesh(geoVac, matVidro(0x6ec6ff, 0.42, { side: THREE.FrontSide }));
  vacuolo.position.set(0.35, -0.05, 0);
  vacuolo.renderOrder = 3;
  cena.add(vacuolo);
  cena.add(rotulo(R.vacuolo, V(0.6, -0.1, 1.3)));

  // núcleo
  const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 20), matVidro(0x9575cd, 0.65, { side: THREE.FrontSide }));
  nucleo.position.set(-2.55, 0.75, 1.3);
  const nucleolo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat(0x4527a0, { flatShading: false }));
  nucleolo.position.copy(nucleo.position).add(V(0.08, 0.05, 0));
  cena.add(nucleolo, nucleo);
  cena.add(rotulo(R.nucleo, nucleo.position.clone().add(V(-0.3, 0.75, 0)), "esq"));

  // mitocôndrias
  const matMito = mat(0xff7043, { flatShading: false });
  const mitos = [V(2.95, 1.55, -1.3), V(-1.2, -1.75, 1.45), V(2.7, -1.65, 1.2), V(-0.4, 1.75, -1.4), V(-2.9, -1.4, -1.2)];
  mitos.forEach((p, i) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 10), matMito);
    m.position.copy(p); m.rotation.set(entre(0, 3), entre(0, 3), entre(0, 3));
    cena.add(m);
    if (i === 2) cena.add(rotulo(R.mitocondria, p.clone().add(V(0.4, -0.35, 0)), "dir"));
  });

  // cloroplastos em três "faixas" que circulam em volta do vacúolo (ciclose)
  const geoCloro = new THREE.SphereGeometry(1, 20, 14);
  const geoTil = new THREE.CylinderGeometry(0.075, 0.075, 0.022, 12);
  const matCloro = new THREE.MeshStandardMaterial({ color: 0x43a047, transparent: true, opacity: 0.82, roughness: 0.45 });
  const matCloroAlvo = new THREE.MeshStandardMaterial({ color: 0x66d34a, emissive: 0x1f6a00, transparent: true, opacity: 0.9, roughness: 0.4 });
  const matTil = mat(0x1b5e20, { flatShading: false });
  const cloros = [];
  const faixas = [-1.5, 0, 1.5];
  const caminho = (fx, th, v) => v.set(2.78 * Math.cos(th), faixas[fx] + 0.12 * Math.sin(th * 3), 1.68 * Math.sin(th));
  faixas.forEach((_, fx) => {
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const alvo = fx === 1 && i === 1;
      const corpo = new THREE.Mesh(geoCloro, alvo ? matCloroAlvo : matCloro);
      corpo.scale.set(0.27, 0.19, 0.42);
      g.add(corpo);
      for (const dz of [-0.2, 0, 0.2]) for (let s = 0; s < 4; s++) {
        const t = new THREE.Mesh(geoTil, matTil);
        t.position.set(0, -0.05 + s * 0.032, dz);
        g.add(t);
      }
      cena.add(g);
      const c = { g, corpo, fx, th: (i / 6) * 2 * PI + fx * 0.5, sentido: fx === 1 ? -1 : 1, alvo };
      cloros.push(c);
      N.clicaveis.push({ obj: corpo, acao: () => avisar("A viagem para dentro do cloroplasto chega na etapa 2!") });
    }
  });
  const cloroAlvo = cloros.find((c) => c.alvo);
  const rotCloro = rotulo(R.cloroplastos, V(0, 0.45, 0), "", "alvo");
  cloroAlvo.g.add(rotCloro);
  const proximo = new THREE.Vector3();
  function moverCloros(dt) {
    for (const c of cloros) {
      c.th += dt * 0.12 * c.sentido;
      caminho(c.fx, c.th, c.g.position);
      caminho(c.fx, c.th + 0.05 * c.sentido, proximo);
      c.g.lookAt(proximo);
    }
  }
  moverCloros(0);

  // ----- rotas até cloroplastos que se movem
  const posCloro = (c) => (v) => v.copy(c.g.position);
  const fixo = (p) => (v) => v.copy(p);
  const rotasLuz = [], rotasCO2 = [], rotasO2 = [], rotasAgua = [], rotasGli = [];
  for (let i = 0; i < 40; i++) {
    const c = escolher(cloros);
    rotasLuz.push(rotaMovel(fixo(V(c.g.position.x * 0.6 - 1.5, 6.5, c.g.position.z * 0.6 + 1)), posCloro(c), 0.05));
    const fora = direcaoAleatoria().multiplyScalar(entre(5.5, 7)).setY(entre(-1, 1));
    rotasCO2.push(rotaMovel(fixo(fora), posCloro(c)));
    const fora2 = direcaoAleatoria().multiplyScalar(entre(5.5, 7)).setY(entre(-1, 1));
    rotasO2.push(rotaMovel(posCloro(escolher(cloros)), fixo(fora2)));
    const deVac = rnd() < 0.5;
    const origem = deVac ? V(entre(-1, 1.6), entre(-0.5, 0.5), entre(-0.5, 0.5)) : V(-6, entre(-1.5, 1.5), entre(-1.5, 1.5));
    rotasAgua.push(rotaMovel(fixo(origem), posCloro(c)));
    rotasGli.push(rotaMovel(posCloro(escolher(cloros)), fixo(V(entre(5.5, 7), entre(-2, 2), entre(-1.5, 1.5)))));
  }
  N.addFluxo(new Fluxo("luz", rotasLuz, { n: 40, vel: 6, tam: 0.07 }));
  N.addFluxo(new Fluxo("co2", rotasCO2, { n: 38, vel: 1.3, tam: 0.08 }));
  N.addFluxo(new Fluxo("o2", rotasO2, { n: 38, vel: 1.3, tam: 0.08 }));
  N.addFluxo(new Fluxo("agua", rotasAgua, { n: 45, vel: 1.2, tam: 0.075 }));
  N.addFluxo(new Fluxo("glicose", rotasGli, { n: 32, vel: 1.0, tam: 0.09 }));

  N.atualizarLuz = (L) => {
    cena.background.copy(fundoNoite).lerp(fundoDia, L);
    sol.intensity = 0.3 + 1.6 * L;
    hemi.intensity = 0.6 + 0.7 * L;
  };
  N.animar = (dt, t) => {
    moverCloros(dt);
    const pulso = 0.5 + 0.5 * Math.sin(t * 3.5);
    matCloroAlvo.emissive.setRGB(0.08 + 0.2 * pulso, 0.35 + 0.3 * pulso, 0.02);
    vacuolo.scale.setScalar(0.85 + 0.15 * estado.agua);   // célula com pouca água: vacúolo murcha
  };
  return N;
}

// ---------------------------------------------------------------- montagem
const NIVEIS = {};
for (const N of [criarPlanta(), criarFolha(), criarCelula()]) NIVEIS[N.id] = N;
const ORDEM = CFG.niveis.map((n) => n.id);
let atual = null;

// ---------------------------------------------------------------- interface
function avisar(texto) {
  const a = $("aviso");
  a.textContent = texto;
  a.classList.add("on");
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => a.classList.remove("on"), 2800);
}

const LEG = CFG.legenda;
const bolinha = (tipo) => `<span class="bola${tipo === "glicose" ? " hex" : ""}" style="background:${CSS_COR(CORES[tipo])}"></span>`;
$("legenda").innerHTML = ["agua", "minerais", "co2", "luz", "o2", "glicose"].map((t) => `<span>${bolinha(t)}${LEG[t]}</span>`).join("");

function mostrarEquacao() {
  $("equacao").innerHTML = (estado.simbolos ? CFG.equacao_simbolos : CFG.equacao_palavras) +
    `<small>${estado.simbolos ? "ver em palavras" : "ver em símbolos"}</small>`;
}
$("equacao").addEventListener("click", () => { estado.simbolos = !estado.simbolos; mostrarEquacao(); });
mostrarEquacao();

function montarTrilha() {
  const t = $("trilha");
  t.innerHTML = "";
  CFG.niveis.forEach((n, i) => {
    if (i) { const s = document.createElement("i"); s.textContent = "›"; t.appendChild(s); }
    const b = document.createElement("button");
    b.textContent = (n.pronto ? "" : "🔒 ") + n.nome;
    if (!n.pronto) b.classList.add("bloq");
    if (atual && n.id === atual.id) b.classList.add("atual");
    b.addEventListener("click", () => {
      if (!n.pronto) return avisar(`${n.titulo}: chega na etapa 2!`);
      if (n.id !== atual.id) irPara(n.id, null);
    });
    t.appendChild(b);
  });
}

let painelFechado = false;
function montarPainel() {
  const i = ORDEM.indexOf(atual.id);
  const n = CFG.niveis[i];
  const p = $("painel");
  p.classList.toggle("fechado", painelFechado);
  p.innerHTML = `<button class="recolher" id="recolher">${painelFechado ? "Mostrar explicação ▾" : "Recolher ▴"}</button>
    <div class="nivelNum">Nível ${i + 1} de ${ORDEM.length}</div>
    <h2>${n.titulo}</h2>
    <p>${n.texto}</p>
    <ul>${n.caminhos.map(([tipo, txt]) => `<li>${bolinha(tipo)}<span>${txt}</span></li>`).join("")}</ul>
    <div class="caixa curio"><b>Você sabia?</b>${n.curiosidade}</div>
    <div class="caixa perg"><b>Pergunta para a turma</b>${n.pergunta}</div>
    <div class="caixa dica">👆 ${n.dica}</div>`;
  $("recolher").addEventListener("click", () => { painelFechado = !painelFechado; montarPainel(); });
  redimensionar();
}

function atualizarInterface() {
  montarTrilha();
  montarPainel();
  $("voltar").hidden = ORDEM.indexOf(atual.id) === 0;
  document.querySelectorAll("[data-so]").forEach((el) => (el.hidden = el.dataset.so !== atual.id));
  aplicarVisibilidade();
  escreverEndereco();
}

function aplicarVisibilidade() {
  for (const N of Object.values(NIVEIS)) {
    N.fluxosGrupo.visible = estado.caminhos;
    N.cena.traverse((o) => { if (o.userData.rotulo) o.visible = estado.nomes; });
  }
  NIVEIS.planta.raiox(estado.raiox);
}

let ultimaTaxa = -1, ultimaMsg = "";
function atualizarMedidor() {
  calcularTaxa();
  const pct = Math.round(estado.taxa * 100);
  if (pct !== ultimaTaxa) {
    ultimaTaxa = pct;
    $("taxaV").textContent = pct + "%";
    $("taxaBarra").style.width = pct + "%";
  }
  const M = CFG.medidor;
  let msg;
  if (estado.luz < 0.02) msg = M.escuro;
  else if (estado.taxa >= 0.75) msg = M.otimo;
  else if (estado.luz === estado.taxa) msg = M.luz;
  else if (estado.agua === estado.taxa) msg = M.agua;
  else msg = M.co2;
  if (msg !== ultimaMsg) { ultimaMsg = msg; $("taxaMsg").textContent = msg; }
}

// controles
for (const id of ["luz", "agua", "co2"]) {
  const el = $(id);
  const ler = () => {
    estado[id] = el.value / 100;
    $(id + "V").textContent = el.value + "%";
    if (id === "luz") for (const N of Object.values(NIVEIS)) N.atualizarLuz(estado.luz);
    atualizarMedidor();
  };
  el.addEventListener("input", ler);
  el.addEventListener("change", escreverEndereco);
  ler();
}
$("vCaminhos").addEventListener("change", (e) => { estado.caminhos = e.target.checked; aplicarVisibilidade(); });
$("vNomes").addEventListener("change", (e) => { estado.nomes = e.target.checked; aplicarVisibilidade(); });
$("vRaiox").addEventListener("change", (e) => { estado.raiox = e.target.checked; aplicarVisibilidade(); });
$("vGirar").addEventListener("change", (e) => { controles.autoRotate = e.target.checked; });
$("play").addEventListener("click", () => {
  estado.pausado = !estado.pausado;
  $("play").textContent = estado.pausado ? "▶ Continuar" : "⏸ Pausar";
});
$("voltar").addEventListener("click", () => {
  const i = ORDEM.indexOf(atual.id);
  if (i > 0) irPara(ORDEM[i - 1], null);
});

// ---------------------------------------------------------------- endereço (atalhos para preparar aula)
function lerEndereco() {
  const h = new URLSearchParams(location.hash.slice(1));
  for (const id of ["luz", "agua", "co2"]) {
    if (h.has(id)) { $(id).value = limitar(+h.get(id), 0, 100); $(id).dispatchEvent(new Event("input")); }
  }
  if (h.get("nomes") === "0") { $("vNomes").checked = false; estado.nomes = false; }
  if (h.get("caminhos") === "0") { $("vCaminhos").checked = false; estado.caminhos = false; }
  const n = h.get("nivel");
  return NIVEIS[n] ? n : "planta";
}
function escreverEndereco() {
  if (!atual) return;
  const partes = [`nivel=${atual.id}`];
  for (const id of ["luz", "agua", "co2"]) if ($(id).value !== "100") partes.push(`${id}=${$(id).value}`);
  history.replaceState(null, "", "#" + partes.join("&"));
}

// ---------------------------------------------------------------- transições de zoom
const anims = [];
const suave = (x) => x * x * (3 - 2 * x);
function animarCamera(dePos, paraPos, deAlvo, paraAlvo, dur) {
  return new Promise((ok) => anims.push({ dePos, paraPos, deAlvo, paraAlvo, dur, t: 0, ok }));
}
function ativar(id) {
  if (atual) { // esconde os rótulos HTML do nível que sai
    atual.cena.visible = false;
    rotRenderer.render(atual.cena, camera);
    atual.cena.visible = true;
  }
  atual = NIVEIS[id];
  const c = atual.cam;
  controles.minDistance = c.min;
  controles.maxDistance = c.max;
  atualizarInterface();
}
// em telas em pé (celular), a câmera começa mais longe para caber a cena inteira
function posNormal(c) {
  const asp = cenaEl.clientWidth / Math.max(1, cenaEl.clientHeight);
  const fator = asp < 0.8 ? 1.5 : asp < 1.1 ? 1.2 : 1;
  return c.alvo.clone().add(c.pos.clone().sub(c.alvo).multiplyScalar(fator));
}
let ocupado = false;
async function irPara(id, foco) {
  if (ocupado || !NIVEIS[id] || (atual && atual.id === id)) return;
  ocupado = true;
  controles.enabled = false;
  const entrando = ORDEM.indexOf(id) > ORDEM.indexOf(atual.id);
  const pos0 = camera.position.clone(), alvo0 = controles.target.clone();
  // 1) aproxima (ou afasta) a câmera no nível atual
  let pos1, alvo1;
  if (entrando) {
    alvo1 = (foco || alvo0).clone();
    pos1 = alvo1.clone().add(pos0.clone().sub(alvo1).normalize().multiplyScalar(0.25));
  } else {
    alvo1 = alvo0.clone();
    pos1 = alvo0.clone().add(pos0.clone().sub(alvo0).multiplyScalar(2.6));
  }
  setTimeout(() => $("veu").classList.add("on"), entrando ? 450 : 350);
  await animarCamera(pos0, pos1, alvo0, alvo1, entrando ? 0.95 : 0.8);
  // 2) troca de nível por trás do véu
  ativar(id);
  const c = atual.cam;
  const dir = c.pos.clone().sub(c.alvo);
  const inicio = c.alvo.clone().add(dir.clone().multiplyScalar(entrando ? 2.4 : 0.15));
  const destino = posNormal(c);
  camera.position.copy(inicio);
  controles.target.copy(c.alvo);
  $("veu").classList.remove("on");
  // 3) chega à posição normal do novo nível
  await animarCamera(inicio, destino, c.alvo.clone(), c.alvo.clone(), 1.1);
  controles.enabled = true;
  ocupado = false;
}

// ---------------------------------------------------------------- clique nas partes destacadas
const raio = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
let apertou = null;
function acertar(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raio.setFromCamera(ponteiro, camera);
  const hits = raio.intersectObjects(atual.clicaveis.map((c) => c.obj), false);
  return hits.length ? atual.clicaveis.find((c) => c.obj === hits[0].object) : null;
}
renderer.domElement.addEventListener("pointerdown", (ev) => { apertou = { x: ev.clientX, y: ev.clientY }; });
renderer.domElement.addEventListener("pointerup", (ev) => {
  if (!apertou || ocupado) return;
  const mov = Math.hypot(ev.clientX - apertou.x, ev.clientY - apertou.y);
  apertou = null;
  if (mov > 8) return;
  const c = acertar(ev);
  if (c) c.acao();
});
let ultimoHover = 0;
renderer.domElement.addEventListener("pointermove", (ev) => {
  const agora = performance.now();
  if (agora - ultimoHover < 60 || ev.buttons) return;
  ultimoHover = agora;
  renderer.domElement.style.cursor = acertar(ev) ? "pointer" : "";
});

// ---------------------------------------------------------------- tamanho e laço principal
function redimensionar() {
  // no computador, a cena ocupa o resto da tela abaixo dos controles
  if (innerWidth > 760) {
    const topo = cenaEl.getBoundingClientRect().top + scrollY;
    cenaEl.style.height = Math.max(480, innerHeight - topo) + "px";
  } else cenaEl.style.height = "";
  const w = cenaEl.clientWidth, h = cenaEl.clientHeight;
  renderer.setSize(w, h);
  rotRenderer.setSize(w, h);
  camera.aspect = w / h;
  // o painel de explicação cobre a direita: desloca o centro da imagem para a parte livre
  const painel = $("painel");
  const cobre = getComputedStyle(painel).position === "absolute" && !painel.classList.contains("fechado");
  const desl = cobre ? (painel.offsetWidth + 20) / 2 : 0;
  if (desl) camera.setViewOffset(w, h, desl, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener("resize", redimensionar);

const relogio = new THREE.Clock();
let tempo = 0;
function quadro() {
  requestAnimationFrame(quadro);
  const dt = Math.min(relogio.getDelta(), 0.05);
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.t = Math.min(1, a.t + dt / a.dur);
    const s = suave(a.t);
    camera.position.lerpVectors(a.dePos, a.paraPos, s);
    controles.target.lerpVectors(a.deAlvo, a.paraAlvo, s);
    if (a.t >= 1) { anims.splice(i, 1); a.ok(); }
  }
  if (!estado.pausado) {
    tempo += dt;
    atual.animar(dt, tempo);
    if (estado.caminhos) for (const f of atual.fluxos) f.atualizar(dt);
  }
  if (!anims.length) controles.update(); else camera.lookAt(controles.target);
  renderer.render(atual.cena, camera);
  rotRenderer.render(atual.cena, camera);
}

const inicial = lerEndereco();
ativar(inicial);
camera.position.copy(posNormal(atual.cam));
controles.target.copy(atual.cam.alvo);
for (const N of Object.values(NIVEIS)) N.atualizarLuz(estado.luz);
atualizarMedidor();
redimensionar();
quadro();
window.__simulador = { NIVEIS, estado, irPara, camera, controles }; // para testes no console
