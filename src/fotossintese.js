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

const CORES = { agua: 0x2f8cff, minerais: 0xb46cff, co2: 0x6f7682, luz: 0xffd92e, o2: 0x9ff0ff, glicose: 0xff9a1f,
  bateria: 0xb6f23a, bateriaV: 0x8d939b, eletron: 0xfff3a0, h: 0xff6fae, luzverde: 0x46d65a };
// cor das partículas de luz e da luz das cenas, conforme o seletor "Cor da luz"
const TINTA = { branca: 0xffd92e, vermelha: 0xff4a3d, azul: 0x3d7bff, verde: 0x46d65a };
const LUZ_CENA = { branca: 0xfff1cc, vermelha: 0xffb3a6, azul: 0xb3c9ff, verde: 0xbdf5bd };
const EFIC = Object.fromEntries(CFG.cores_luz.map((c) => [c.id, c.eficiencia]));
const CSS_COR = (c) => "#" + c.toString(16).padStart(6, "0");

// ---------------------------------------------------------------- estado
const estado = { luz: 1, agua: 1, co2: 1, cor: "branca", taxa: 1, carga: 1, montagem: 1, estoque: 1, limite: 1,
  caminhos: true, nomes: true, raiox: true, detalhes: false, pausado: false, simbolos: false };
// Duas etapas ligadas por um "estoque de baterias":
//  carga    = etapa da luz (tilacoides): depende da luz aproveitada e da água
//  montagem = montagem da glicose (estroma): depende do gás carbônico e das baterias carregadas
// Sem luz, a carga para na hora e a montagem continua um pouco, até as baterias acabarem.
function calcularTaxa(dt) {
  const lef = estado.luz * EFIC[estado.cor];
  const co2ef = Math.min(estado.co2, estado.agua);       // com pouca água os estômatos fecham
  estado.carga = Math.min(lef, estado.agua);
  estado.montagem = Math.min(co2ef, 1.5 * estado.estoque);
  estado.estoque = limitar(estado.estoque + 0.5 * (estado.carga - estado.montagem) * dt);
  estado.limite = Math.min(lef, estado.agua, estado.co2);
  estado.taxa = estado.montagem;
}
const absorcao = () => (estado.cor === "verde" ? EFIC.verde : 1);
const DENS = {
  agua: () => estado.agua * (0.35 + 0.65 * estado.luz * EFIC[estado.cor]),
  luz: () => estado.luz,
  co2: () => estado.montagem,
  o2: () => estado.carga,
  glicose: () => estado.montagem,
  bateria: () => estado.carga,
  bateriaV: () => estado.montagem,
  eletron: () => estado.carga,
  h: () => estado.carga,
  luzverde: () => estado.luz * (estado.cor === "verde" ? 1 : estado.cor === "branca" ? 0.6 : 0),
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

// rótulo a partir de uma chave de CFG.rotulos (troca para o nome científico com "Mais detalhes")
const RD = CFG.rotulos_detalhes || {};
function rk(chave, pos, lado = "", extra = "") {
  const o = rotulo(R[chave], pos, lado, extra);
  o.element.dataset.simples = R[chave];
  o.element.dataset.det = RD[chave] || R[chave];
  return o;
}
function trocarNomes() {
  for (const N of Object.values(NIVEIS)) N.cena.traverse((o) => {
    const d = o.element;
    if (o.userData.rotulo && d && d.dataset.simples) d.firstChild.textContent = estado.detalhes ? d.dataset.det : d.dataset.simples;
  });
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
const geoBat = new THREE.CapsuleGeometry(0.55, 1.1, 3, 8);
const FLUXOS_LUZ = [];
class Fluxo {
  constructor(tipo, rotas, { n = 60, vel = 1.5, tam = 0.06, minerais = 0, dens = null, giro = true } = {}) {
    this.tipo = tipo; this.rotas = rotas; this.vel = vel; this.tam = tam; this.giro = giro;
    this.densidade = dens || DENS[tipo];
    const geo = tipo === "glicose" ? geoHex : tipo.startsWith("bateria") ? geoBat : geoEsfera;
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    if (tipo === "luz") { FLUXOS_LUZ.push(this); }
    this.mesh = new THREE.InstancedMesh(geo, material, n);
    this.mesh.frustumCulled = false;
    this.p = [];
    const cor = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.p.push({ r: Math.floor(rnd() * rotas.length), t: rnd(), u: rnd(), giro: rnd() * 6, k: entre(0.8, 1.2) });
      const mineral = rnd() < minerais;
      this.mesh.setColorAt(i, cor.set(tipo === "luz" ? 0xffffff : mineral ? CORES.minerais : CORES[tipo]));
    }
  }
  recolorir(fn) {
    const cor = new THREE.Color();
    for (let i = 0; i < this.p.length; i++) this.mesh.setColorAt(i, cor.set(fn(i)));
    this.mesh.instanceColor.needsUpdate = true;
  }
  atualizar(dt) {
    const dens = this.densidade();
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      let rota = this.rotas[p.r];
      p.t += (dt * this.vel * p.k) / rota.comp;
      if (p.t >= 1) {
        p.t -= 1; p.r = Math.floor(rnd() * this.rotas.length); p.u = rnd(); rota = this.rotas[p.r];
      }
      rota.ponto(p.t, _v);
      const s = this.tam * Math.min(1, Math.sin(PI * p.t) * 5) * limitar((dens - p.u) * 6);
      if (this.giro) p.giro += dt * 2;
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
    id, cena, cam, fluxosGrupo: fluxos, fluxos: [], clicaveis: [], sois: [], animar: () => {}, atualizarLuz: () => {},
    entrar: null, volta: null, aoMudarCor: null,
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
  N.sois.push(sol);

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
  cena.add(rk("sol", posSol.clone().add(V(0, -1.6, 0))));

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
  cena.add(rk("solo", V(RS * 0.72, -HS + 0.4, RS * 0.72), "dir"));

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
  cena.add(rk("raizes", V(-2.2, -1.6, 2.2), "esq"));

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
  cena.add(rk("caule", V(0.5, 1.6, 0.4), "dir"));
  cena.add(rk("xilema", V(0.35, 0.9, 0.35), "dir"));
  cena.add(rk("floema", V(-0.35, 2.3, 0.35), "esq"));

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
  cena.add(rk("folhas", V(-2.6, 6.6, 0.8), "esq"));

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
  cena.add(rk("folha_alvo", centroAlvo.clone().add(V(0.6, 0.6, 0.3)), "dir", "alvo"));
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
    frutos.push({ pos: pf, copa: cp, mesh: fr });
  }
  const maisBaixo = frutos.reduce((a, b) => (b.pos.y < a.pos.y ? b : a));
  cena.add(rk("frutos", maisBaixo.pos.clone().add(V(0.35, -0.35, 0)), "dir"));

  // ----- entrada (viagem completa) e caminho de volta da glicose até um fruto
  N.entrar = () => irPara("folha", centroAlvo);
  const peciolo = V(1.2, 5.0, 1.3);
  const frutoVolta = frutos.reduce((a, b) => (b.pos.distanceTo(peciolo) < a.pos.distanceTo(peciolo) ? b : a));
  N.volta = {
    curva: () => new THREE.CatmullRomCurve3([centroAlvo.clone(), baseAlvo.clone(), peciolo.clone(),
      frutoVolta.copa.c.clone().lerp(frutoVolta.pos, 0.55), frutoVolta.pos.clone()]),
    marcador: () => frutoVolta.pos.clone(),
    offset: V(3.6, 1.8, 6.2),
    aoChegar: () => { frutoVolta.pulso = 1; },
  };
  N.frutoVolta = frutoVolta;

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
    if (frutoVolta.pulso > 0) {
      frutoVolta.pulso = Math.max(0, frutoVolta.pulso - dt * 0.4);
      frutoVolta.mesh.scale.setScalar(1 + 0.45 * Math.sin(frutoVolta.pulso * PI * 3) * frutoVolta.pulso);
    }
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
  N.sois.push(sol);

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
  cena.add(rk("palicadico", V(-LX - 0.2, 0.66, LZ), "esq"));

  // célula destacada (clique para entrar)
  const matAlvo = new THREE.MeshStandardMaterial({ color: 0x7ee05a, emissive: 0x2a7a00, roughness: 0.5 });
  const celAlvo = new THREE.Mesh(geoPal, matAlvo);
  celAlvo.position.copy(alvoPal);
  cena.add(celAlvo);
  cena.add(rk("celula_alvo", alvoPal.clone().add(V(0, 1.4, 0.4)), "", "alvo"));
  N.clicaveis.push({ obj: celAlvo, acao: () => irPara("celula", alvoPal) });
  N.entrar = () => irPara("celula", alvoPal);

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
  cena.add(rk("nervura", V(VX, VY + 0.75, LZ + 0.1)));
  cena.add(rk("xilema", V(VX + 0.45, VY + 0.2, LZ + 0.05), "dir"));
  cena.add(rk("floema", V(VX + 0.45, VY - 0.25, LZ + 0.05), "dir"));

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
  cena.add(rk("lacunoso", V(-LX - 0.2, -0.55, LZ), "esq"));

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
  cena.add(rk("estomato", frente.clone().add(V(0, -0.55, 0.2))));
  cena.add(rk("cuticula", V(-LX - 0.2, 1.68, LZ), "esq"));
  cena.add(rk("epiderme_sup", V(-LX - 0.2, 1.36, LZ), "esq"));
  cena.add(rk("epiderme_inf", V(-LX - 0.2, -1.3, LZ), "esq"));

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

  // caminho de volta: da célula destacada até o floema, e pelo floema em direção ao caule
  const floVolta = floemas[0];
  N.volta = {
    curva: () => new THREE.CatmullRomCurve3([alvoPal.clone(), V((alvoPal.x + floVolta.x) / 2, -0.2, alvoPal.z - 0.1),
      V(floVolta.x, floVolta.y, alvoPal.z - 0.2), V(floVolta.x, floVolta.y, 0), V(floVolta.x, floVolta.y, -LZ - 0.8)]),
    marcador: () => V(floVolta.x, floVolta.y, alvoPal.z - 0.2),
    offset: V(3.2, 2.2, 4.5),
  };

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
  N.sois.push(sol);

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
  cena.add(rk("parede", V(-3.55, 2.25, 2.25), "esq"));
  cena.add(rk("membrana", V(3.3, -2.0, 2.0), "dir"));
  cena.add(rk("citoplasma", V(2.85, 1.55, 1.75), "dir"));

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
  cena.add(rk("vacuolo", V(0.6, -0.1, 1.3)));

  // núcleo
  const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 20), matVidro(0x9575cd, 0.65, { side: THREE.FrontSide }));
  nucleo.position.set(-2.55, 0.75, 1.3);
  const nucleolo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat(0x4527a0, { flatShading: false }));
  nucleolo.position.copy(nucleo.position).add(V(0.08, 0.05, 0));
  cena.add(nucleolo, nucleo);
  cena.add(rk("nucleo", nucleo.position.clone().add(V(-0.3, 0.75, 0)), "esq"));

  // mitocôndrias
  const matMito = mat(0xff7043, { flatShading: false });
  const mitos = [V(2.95, 1.55, -1.3), V(-1.2, -1.75, 1.45), V(2.7, -1.65, 1.2), V(-0.4, 1.75, -1.4), V(-2.9, -1.4, -1.2)];
  mitos.forEach((p, i) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 10), matMito);
    m.position.copy(p); m.rotation.set(entre(0, 3), entre(0, 3), entre(0, 3));
    cena.add(m);
    if (i === 2) cena.add(rk("mitocondria", p.clone().add(V(0.4, -0.35, 0)), "dir"));
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
      N.clicaveis.push({ obj: corpo, acao: () => irPara("cloroplasto", g.position.clone()) });
    }
  });
  const cloroAlvo = cloros.find((c) => c.alvo);
  cloroAlvo.g.add(rk("cloroplasto_alvo", V(0, 0.45, 0), "", "alvo"));
  cloros[9].g.add(rk("cloroplastos", V(0, 0.4, 0)));
  N.entrar = () => irPara("cloroplasto", cloroAlvo.g.position.clone());
  N.volta = {
    curva: () => {
      const a = cloroAlvo.g.position.clone();
      return new THREE.CatmullRomCurve3([a, V(2.0, a.y * 0.5 - 0.3, 1.4), V(3.5, -0.4, 1.0), V(5.6, -0.5, 0.8), V(7.2, -0.6, 0.6)]);
    },
    marcador: () => V(3.5, -0.4, 1.0),
    offset: V(1.5, 1.8, 5.5),
  };
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

// ================================================================ NÍVEL 4: O CLOROPLASTO
function criarCloroplasto() {
  const N = novoNivel("cloroplasto", { pos: V(4.2, 4.2, 11.8), alvo: V(0, -0.1, 0), min: 3, max: 26 });
  const cena = N.cena;
  const fundoDia = new THREE.Color(0xe3f4d8), fundoNoite = new THREE.Color(0x12241a);
  cena.background = fundoDia.clone();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5f8a4f, 1.3);
  const sol = new THREE.DirectionalLight(0xfff1cc, 1.9);
  sol.position.set(-3, 9, 5);
  cena.add(hemi, sol);
  N.sois.push(sol);

  // duas membranas (elipsoides transparentes)
  const A = 5.2, B = 2.3, C = 3.0;
  const geoElip = new THREE.SphereGeometry(1, 48, 32);
  const externa = new THREE.Mesh(geoElip, matVidro(0x5fae5f, 0.2, { side: THREE.FrontSide }));
  externa.scale.set(A, B, C); externa.renderOrder = 6;
  const interna = new THREE.Mesh(geoElip, matVidro(0xb7e3b0, 0.18, { side: THREE.FrontSide }));
  interna.scale.set(A * 0.95, B * 0.91, C * 0.93); interna.renderOrder = 5;
  const estroma = new THREE.Mesh(geoElip, matVidro(0xe9f8d0, 0.22, { side: THREE.BackSide }));
  estroma.scale.copy(interna.scale);
  cena.add(estroma, interna, externa);
  const naMembrana = (d, f = 1) => { // ponto da membrana externa na direção d
    const k = 1 / Math.sqrt((d.x / A) ** 2 + (d.y / B) ** 2 + (d.z / C) ** 2);
    return d.clone().multiplyScalar(k * f);
  };
  cena.add(rk("memb_ext", naMembrana(V(-0.75, 0.55, 0.45)).add(V(-0.2, 0.2, 0)), "esq"));
  cena.add(rk("memb_int", naMembrana(V(0.8, -0.5, 0.5), 0.95), "dir"));
  cena.add(rk("estroma", V(-0.6, -1.35, 1.7)));

  // pilhas de tilacoides (grana) e as ligações entre elas (lamelas)
  const posGrana = [V(-3.2, -0.2, 0.3), V(-1.8, 0.45, -1.2), V(-1.2, -0.45, 1.25), V(0.3, 0.3, 0.0),
    V(1.6, -0.4, -1.15), V(1.9, 0.45, 1.15), V(3.4, 0.0, -0.2)];
  const geoDisco = new THREE.CylinderGeometry(0.5, 0.5, 0.085, 22);
  const matDisco = [mat(0x2e9b3a, { flatShading: false, roughness: 0.6 }), mat(0x3fae46, { flatShading: false, roughness: 0.6 })];
  const matDiscoAlvo = new THREE.MeshStandardMaterial({ color: 0x66d34a, emissive: 0x1f6a00, roughness: 0.5 });
  const IALVO = 5;
  const topos = [];
  posGrana.forEach((p, gi) => {
    const n = 7 + (gi % 3);
    for (let k = 0; k < n; k++) {
      const d = new THREE.Mesh(geoDisco, gi === IALVO ? matDiscoAlvo : matDisco[k % 2]);
      d.position.set(p.x, p.y - (n * 0.12) / 2 + k * 0.12, p.z);
      cena.add(d);
    }
    topos.push(V(p.x, p.y + (n * 0.12) / 2, p.z));
  });
  const matLamela = mat(0x8fd18a, { flatShading: false });
  const pares = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6]];
  for (const [a, b] of pares) {
    const pa = posGrana[a].clone(), pb = posGrana[b].clone();
    cena.add(bastao(pa, pb, 0.06, 0.06, matLamela, 6));
  }
  cena.add(rk("granum", topos[0].clone().add(V(0, 0.45, 0))));
  cena.add(rk("lamela", posGrana[3].clone().lerp(posGrana[4], 0.5).add(V(0.2, -0.25, 0.3)), "dir"));
  const alvoGranum = posGrana[IALVO];
  cena.add(rk("tilacoide_alvo", topos[IALVO].clone().add(V(0.3, 0.55, 0.3)), "", "alvo"));
  const caixaAlvo = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.4, 16),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  caixaAlvo.position.copy(alvoGranum);
  cena.add(caixaAlvo);
  N.clicaveis.push({ obj: caixaAlvo, acao: () => irPara("tilacoide", alvoGranum.clone()) });
  N.entrar = () => irPara("tilacoide", alvoGranum.clone());

  // "fábricas" de glicose no estroma (ciclo de Calvin): anéis que giram
  const posFab = [V(0.9, -1.15, 0.55), V(-2.5, 0.95, -0.1)];
  const fabricas = posFab.map((p) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 32), mat(0xffb74d, { flatShading: false })));
    for (let k = 0; k < 6; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(k % 2 ? 0xffd54f : 0xff8a65, { flatShading: false }));
      b.position.set(0.42 * Math.cos((k / 6) * 2 * PI), 0.42 * Math.sin((k / 6) * 2 * PI), 0);
      g.add(b);
    }
    g.position.copy(p);
    g.rotation.x = -0.5;
    cena.add(g);
    return g;
  });
  cena.add(rk("fabrica", posFab[0].clone().add(V(0, -0.65, 0.2))));

  // ----- rotas
  const fora = () => direcaoAleatoria().multiplyScalar(entre(6.5, 8)).setY(entre(-2.5, 2.5));
  const perto = (p, r = 0.35) => p.clone().add(direcaoAleatoria().multiplyScalar(r));
  const rotasLuz = [], rotasAgua = [], rotasO2 = [], rotasCO2 = [], rotasBat = [], rotasBatV = [], rotasGli = [];
  for (let i = 0; i < 40; i++) {
    const gi = Math.floor(rnd() * posGrana.length), g = posGrana[gi], f = escolher(posFab);
    rotasLuz.push(rotaCurva([V(g.x - 2 + entre(-1, 1), 6.5, g.z + 1.5), topos[gi].clone()]));
    const o = fora();
    rotasAgua.push(rotaCurva([o, naMembrana(o.clone().normalize()), perto(g)]));
    const o2 = fora();
    rotasO2.push(rotaCurva([perto(g), naMembrana(o2.clone().normalize()), o2]));
    const o3 = fora();
    rotasCO2.push(rotaCurva([o3, naMembrana(o3.clone().normalize()), perto(f, 0.2)]));
    const meio = g.clone().lerp(f, 0.5).add(V(0, entre(0.2, 0.6), 0));
    rotasBat.push(rotaCurva([perto(g, 0.5), meio, perto(f, 0.3)]));
    rotasBatV.push(rotaCurva([perto(f, 0.3), meio.clone().add(V(0, -0.5, 0)), perto(g, 0.5)]));
    const o4 = fora();
    rotasGli.push(rotaCurva([perto(f, 0.2), naMembrana(o4.clone().normalize()), o4]));
  }
  N.addFluxo(new Fluxo("luz", rotasLuz, { n: 50, vel: 6, tam: 0.07 }));
  N.addFluxo(new Fluxo("agua", rotasAgua, { n: 45, vel: 1.2, tam: 0.07 }));
  N.addFluxo(new Fluxo("o2", rotasO2, { n: 40, vel: 1.2, tam: 0.07 }));
  N.addFluxo(new Fluxo("co2", rotasCO2, { n: 40, vel: 1.2, tam: 0.07 }));
  N.addFluxo(new Fluxo("bateria", rotasBat, { n: 45, vel: 1.0, tam: 0.07, giro: false }));
  N.addFluxo(new Fluxo("bateriaV", rotasBatV, { n: 40, vel: 1.0, tam: 0.07, giro: false }));
  N.addFluxo(new Fluxo("glicose", rotasGli, { n: 35, vel: 1.0, tam: 0.085 }));

  // caminho de volta: começa na fábrica e sai pela membrana
  const saida = naMembrana(V(1, -0.32, 0.55).normalize());
  N.volta = {
    curva: () => new THREE.CatmullRomCurve3([posFab[0].clone(), posFab[0].clone().lerp(saida, 0.5).add(V(0, 0.2, 0.2)),
      saida.clone(), saida.clone().multiplyScalar(1.35)]),
    marcador: () => saida.clone(),
    offset: V(2.2, 2.4, 6.8),
  };

  N.atualizarLuz = (L) => {
    cena.background.copy(fundoNoite).lerp(fundoDia, L);
    sol.intensity = 0.3 + 1.6 * L;
    hemi.intensity = 0.6 + 0.7 * L;
  };
  N.animar = (dt, t) => {
    const pulso = 0.5 + 0.5 * Math.sin(t * 3.5);
    matDiscoAlvo.emissive.setRGB(0.08 + 0.22 * pulso, 0.35 + 0.35 * pulso, 0.02);
    for (const f of fabricas) f.rotateZ(dt * 2.2 * estado.montagem);
  };
  return N;
}

// ================================================================ NÍVEL 5: A MEMBRANA DO TILACOIDE
function criarTilacoide() {
  const N = novoNivel("tilacoide", { pos: V(2.5, 6.2, 17.5), alvo: V(0.8, 0.2, 0), min: 4, max: 34 });
  const cena = N.cena;
  const fundoDia = new THREE.Color(0xe8f5df), fundoNoite = new THREE.Color(0x152219);
  cena.background = fundoDia.clone();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a6f9a, 1.3);
  const sol = new THREE.DirectionalLight(0xfff1cc, 1.8);
  sol.position.set(-4, 10, 6);
  cena.add(hemi, sol);
  N.sois.push(sol);

  const LX = 8.5, LZ = 4;
  // interior do tilacoide (lúmen) levemente colorido
  const lumen = new THREE.Mesh(new THREE.BoxGeometry(2 * LX, 3.2, 2 * LZ), matVidro(0xe9c9f0, 0.22, { side: THREE.FrontSide }));
  lumen.position.y = -2.1;
  cena.add(lumen);
  cena.add(rk("lado_estroma", V(-LX - 0.3, 2.6, LZ), "esq"));
  cena.add(rk("lado_lumen", V(-LX - 0.3, -2.4, LZ), "esq"));
  cena.add(rk("membrana_til", V(-LX - 0.3, 0, LZ), "esq"));

  // proteínas (posições ao longo de x)
  const XPS2 = -5, XCIT = -1.8, XPS1 = 1.5, XATP = 5.4;
  const ocupadoPor = (x, z) => Math.hypot(x - XPS2, z) < 2.3 || Math.hypot(x - XPS1, z) < 2.3 ||
    Math.hypot(x - XCIT, z) < 1.0 || Math.hypot(x - XATP, z) < 1.0;

  // bicamada de fosfolipídios: cabeças (esferas) e caudas (bastões)
  const cabecas = [], caudas = [];
  for (let x = -LX + 0.2; x < LX; x += 0.42) for (let z = -LZ + 0.2; z < LZ; z += 0.42) {
    if (ocupadoPor(x, z)) continue;
    for (const s of [1, -1]) {
      cabecas.push(V(x, 0.45 * s, z));
      caudas.push(V(x - 0.07, 0.22 * s, z), V(x + 0.07, 0.22 * s, z));
    }
  }
  const mCab = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), mat(0xffcc80, { flatShading: false }), cabecas.length);
  const mCau = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 5), mat(0xfff3c4), caudas.length);
  const ob = new THREE.Object3D();
  cabecas.forEach((p, i) => { ob.position.copy(p); ob.updateMatrix(); mCab.setMatrixAt(i, ob.matrix); });
  caudas.forEach((p, i) => { ob.position.copy(p); ob.updateMatrix(); mCau.setMatrixAt(i, ob.matrix); });
  cena.add(mCab, mCau);

  // blocos de proteína feitos de várias esferas
  function proteina(x, cor, raio, partes = 7, altura = 1.0) {
    const g = new THREE.Group();
    const m = mat(cor, { flatShading: false, roughness: 0.55 });
    for (let k = 0; k < partes; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(entre(0.5, 0.75) * raio, 16, 12), m);
      s.position.set(entre(-0.5, 0.5) * raio, entre(-altura, altura), entre(-0.5, 0.5) * raio);
      g.add(s);
    }
    g.position.set(x, 0, 0);
    cena.add(g);
    return g;
  }
  proteina(XPS2, 0x2e7d32, 1.25);
  proteina(XCIT, 0xd2691e, 0.95, 5, 0.8);
  proteina(XPS1, 0x388e3c, 1.2);
  // complexo que quebra a água (do lado de dentro)
  const posQuebra = V(XPS2 + 0.3, -1.05, 0.5);
  const quebra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32), mat(0xffa726));
  quebra.position.copy(posQuebra);
  cena.add(quebra);

  // antenas: clorofilas (discos verdes com magnésio no centro) em volta dos fotossistemas
  const geoCl = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 14);
  const matCl = mat(0x4caf50, { flatShading: false, roughness: 0.4 });
  const matClAlvo = new THREE.MeshStandardMaterial({ color: 0x7ee05a, emissive: 0x2a7a00, roughness: 0.4 });
  const matMg = new THREE.MeshBasicMaterial({ color: 0xc6ff7a });
  const clorofilas = [];
  let clAlvo = null;
  for (const xc of [XPS2, XPS1]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * PI;
      const g = new THREE.Group();
      const alvo = xc === XPS2 && k === 3;
      const disco = new THREE.Mesh(geoCl, alvo ? matClAlvo : matCl);
      disco.rotation.x = 0.6;
      const mg = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), matMg);
      mg.position.y = 0.04;
      g.add(disco, mg);
      g.position.set(xc + 1.85 * Math.cos(a), 0.55 + 0.25 * Math.sin(a * 3), 1.85 * Math.sin(a));
      g.lookAt(V(xc, 3, 0));
      cena.add(g);
      clorofilas.push(g.position);
      if (alvo) clAlvo = g.position;
      N.clicaveis.push({ obj: disco, acao: () => irPara("clorofila", g.position.clone()) });
    }
  }
  cena.add(rk("clorofila_alvo", clAlvo.clone().add(V(0, 0.75, 0.3)), "", "alvo"));
  N.entrar = () => irPara("clorofila", clAlvo.clone());

  // ATP sintase: anel na membrana + haste + cabeça (gira com a carga)
  const rotor = new THREE.Group();
  const matRotor = mat(0x7e57c2, { flatShading: false });
  for (let k = 0; k < 10; k++) {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 3, 8), k % 2 ? matRotor : mat(0x9575cd, { flatShading: false }));
    c.position.set(0.62 * Math.cos((k / 10) * 2 * PI), 0, 0.62 * Math.sin((k / 10) * 2 * PI));
    rotor.add(c);
  }
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 10), mat(0xb39ddb, { flatShading: false }));
  haste.position.y = 1.0;
  const aleta = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), mat(0xffd54f));
  aleta.position.y = 1.15;
  rotor.add(haste, aleta);
  rotor.position.set(XATP, 0, 0);
  cena.add(rotor);
  const cabeca = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(k % 2 ? 0xb39ddb : 0x9575cd, { flatShading: false }));
    s.position.set(0.5 * Math.cos((k / 6) * 2 * PI), 0, 0.5 * Math.sin((k / 6) * 2 * PI));
    cabeca.add(s);
  }
  cabeca.position.set(XATP, 2.15, 0);
  const lateral = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), mat(0x9e9e9e));
  lateral.position.set(XATP + 0.95, 1.0, 0);
  cena.add(cabeca, lateral);
  const posCabeca = cabeca.position.clone();

  cena.add(rk("ps2", V(XPS2, 2.2, 0)));
  cena.add(rk("cit", V(XCIT, 1.55, 0)));
  cena.add(rk("ps1", V(XPS1, 2.2, 0)));
  cena.add(rk("atp", V(XATP, 3.2, 0)));

  // ----- rotas
  const antena = (xc) => escolher(clorofilas.filter((c) => Math.abs(c.x - xc) < 2.5));
  const noLumen = () => V(entre(-6, 6), entre(-1.4, -3.2), entre(-LZ + 0.6, LZ - 0.6));
  const rotasLuz = [], rotasAgua = [], rotasO2 = [], rotasH = [], rotasE = [], rotasBat = [], rotasBatV = [];
  for (let i = 0; i < 40; i++) {
    const c = antena(rnd() < 0.55 ? XPS2 : XPS1);
    rotasLuz.push(rotaCurva([V(c.x - 3 + entre(-1, 1), 8, c.z + entre(0, 2)), c.clone()]));
    rotasAgua.push(rotaCurva([V(posQuebra.x + entre(-2.5, 2.5), -4.2, entre(-LZ, LZ)), V(posQuebra.x, -2.2, posQuebra.z), posQuebra.clone()]));
    const sai = V(entre(-LX, -LX + 3), entre(-1.6, -3.4), entre(-LZ, LZ)).add(V(-1.5, 0, 0));
    rotasO2.push(rotaCurva([posQuebra.clone(), V(posQuebra.x - 1.2, -2.2, posQuebra.z), sai]));
    const inicioH = rnd() < 0.5 ? posQuebra.clone() : V(XCIT + entre(-0.3, 0.3), entre(-0.9, -1.2), entre(-0.3, 0.3));
    rotasH.push(rotaCurva([inicioH, noLumen(), V(XATP + entre(-0.3, 0.3), -1.4, entre(-0.3, 0.3)), V(XATP + 0.62, -0.2, 0),
      V(XATP + 0.62, 0.4, 0), V(XATP + entre(0.6, 2), entre(2.5, 4), entre(-2, 2))]));
    rotasE.push(rotaCurva([V(XPS2, 0.2, 0.3), V(XPS2 + 1.6, 0.7, 0.6), V(XCIT, 0.25, 0.4), V(XCIT + 1.7, 0.7, 0.5),
      V(XPS1, 0.3, 0.3), V(XPS1 + 0.3, 1.3, 0.7), V(XPS1 + entre(0, 1.5), entre(3, 4.5), entre(-1, 2))]));
    const deFora = V(entre(2, LX), entre(3.5, 5), entre(-LZ, LZ));
    if (rnd() < 0.6) {
      rotasBatV.push(rotaCurva([deFora, posCabeca.clone().add(V(0, 0.7, 0))]));
      rotasBat.push(rotaCurva([posCabeca.clone().add(V(0.3, 0.5, 0.3)), V(entre(XATP, LX + 2), entre(3.5, 5.5), entre(-LZ, LZ))]));
    } else {
      rotasBatV.push(rotaCurva([deFora, V(XPS1 + 0.4, 1.5, 0.6)]));
      rotasBat.push(rotaCurva([V(XPS1 + 0.4, 1.5, 0.6), V(entre(-1, 4), entre(3.5, 5.5), entre(-LZ, LZ))]));
    }
  }
  N.addFluxo(new Fluxo("luz", rotasLuz, { n: 55, vel: 7, tam: 0.1 }));
  N.addFluxo(new Fluxo("agua", rotasAgua, { n: 35, vel: 1.4, tam: 0.11 }));
  N.addFluxo(new Fluxo("o2", rotasO2, { n: 25, vel: 1.4, tam: 0.11 }));
  N.addFluxo(new Fluxo("h", rotasH, { n: 70, vel: 1.6, tam: 0.07 }));
  N.addFluxo(new Fluxo("eletron", rotasE, { n: 30, vel: 2.6, tam: 0.08 }));
  N.addFluxo(new Fluxo("bateriaV", rotasBatV, { n: 30, vel: 1.4, tam: 0.11, giro: false }));
  N.addFluxo(new Fluxo("bateria", rotasBat, { n: 30, vel: 1.4, tam: 0.11, giro: false }));

  N.atualizarLuz = (L) => {
    cena.background.copy(fundoNoite).lerp(fundoDia, L);
    sol.intensity = 0.3 + 1.5 * L;
    hemi.intensity = 0.6 + 0.7 * L;
  };
  N.animar = (dt, t) => {
    const pulso = 0.5 + 0.5 * Math.sin(t * 3.5);
    matClAlvo.emissive.setRGB(0.1 + 0.25 * pulso, 0.4 + 0.35 * pulso, 0.05);
    rotor.rotateY(dt * 3.5 * estado.carga);
    matMg.color.setHSL(0.25, 1, 0.55 + 0.3 * estado.carga * pulso * absorcao());
    quebra.rotation.y += dt * 1.5 * estado.carga;
  };
  return N;
}

// ================================================================ NÍVEL 6: A MOLÉCULA DE CLOROFILA
function criarClorofila() {
  const N = novoNivel("clorofila", { pos: V(2, 0.5, 28), alvo: V(1.2, -3.6, 0), min: 5, max: 45 });
  const cena = N.cena;
  cena.background = new THREE.Color(0x0f1a2b);
  const hemi = new THREE.HemisphereLight(0xdde8ff, 0x223044, 1.4);
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(-6, 8, 10);
  cena.add(hemi, sol);
  N.sois.push(sol);

  const COR_AT = { C: 0x455a64, N: 0x1e88e5, O: 0xe53935, Mg: 0x7cff4f };
  const RAIO_AT = { C: 0.34, N: 0.38, O: 0.36, Mg: 0.62 };
  const matAt = {};
  for (const k in COR_AT) matAt[k] = new THREE.MeshStandardMaterial({ color: COR_AT[k], roughness: 0.35, metalness: 0.05 });
  matAt.Mg.emissive = new THREE.Color(0x2f8f10);
  const matLig = new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.5 });
  const matLigMg = new THREE.MeshStandardMaterial({ color: 0x9ccc65, roughness: 0.5, transparent: true, opacity: 0.6 });
  const geoAt = new THREE.SphereGeometry(1, 20, 14);
  const atomos = [];
  const atomo = (tipo, p) => {
    const m = new THREE.Mesh(geoAt, matAt[tipo]);
    m.scale.setScalar(RAIO_AT[tipo]); m.position.copy(p);
    cena.add(m); atomos.push({ tipo, p: p.clone(), m });
    return p.clone();
  };
  const ligar = (a, b, m = matLig, r = 0.11) => cena.add(bastao(a, b, r, r, m, 8));

  // anel: 4 pirróis (pentágonos) com o nitrogênio virado para o magnésio
  const mg = atomo("Mg", V(0, 0, 0));
  const RN = 2.0, R5 = 1.19;
  const pir = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2;
    const u = V(Math.cos(a), Math.sin(a), 0);
    const centro = u.clone().multiplyScalar(RN + R5);
    const vs = [];
    for (let k = 0; k < 5; k++) {
      const ang = a + PI + (k * 2 * PI) / 5;
      vs.push(centro.clone().add(V(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(R5)));
    }
    vs.forEach((v, k) => atomo(k === 0 ? "N" : "C", v));
    for (let k = 0; k < 5; k++) ligar(vs[k], vs[(k + 1) % 5]);
    ligar(mg, vs[0], matLigMg, 0.08);
    pir.push({ u, centro, vs });
  }
  // carbonos "meso" ligando os pirróis vizinhos
  const meso = [];
  for (let i = 0; i < 4; i++) {
    const A = pir[i], B = pir[(i + 1) % 4];
    const ca = A.vs[1].distanceTo(B.centro) < A.vs[4].distanceTo(B.centro) ? A.vs[1] : A.vs[4];
    const cb = B.vs[1].distanceTo(A.centro) < B.vs[4].distanceTo(A.centro) ? B.vs[1] : B.vs[4];
    const m = ca.clone().add(cb).multiplyScalar(0.5);
    m.add(m.clone().normalize().multiplyScalar(0.55));
    atomo("C", m); ligar(ca, m); ligar(m, cb);
    meso.push(m);
  }
  // grupos laterais nos carbonos de fora (beta)
  const lateral = (de, dir, n) => {
    let p = de;
    for (let k = 0; k < n; k++) {
      const q = p.clone().add(dir.clone().applyAxisAngle(V(0, 0, 1), k % 2 ? 0.5 : -0.5).multiplyScalar(1.05));
      atomo("C", q); ligar(p, q); p = q;
    }
    return p;
  };
  for (let i = 0; i < 4; i++) {
    for (const k of [2, 3]) {
      if (i === 3 && k === 2) continue; // este carbono recebe a "cauda"
      const v = pir[i].vs[k];
      lateral(v, v.clone().sub(pir[i].centro).normalize(), i === 1 && k === 2 ? 2 : 1);
    }
  }
  // quinto anel com um oxigênio (C=O), perto do pirrol de baixo
  const m3 = meso[2];
  const cO = m3.clone().add(V(0.35, -1.0, 0));
  atomo("C", cO); ligar(m3, cO);
  const oCet = atomo("O", cO.clone().add(V(-0.6, -0.85, 0))); ligar(cO, oCet, matLig, 0.14);
  // éster e a cauda de fitol (20 carbonos), que desce para dentro da membrana
  const base = pir[3].vs[2];
  const c1 = base.clone().add(V(0.6, -0.9, 0.2)); atomo("C", c1); ligar(base, c1);
  const c2 = c1.clone().add(V(0.9, -0.6, 0)); atomo("C", c2); ligar(c1, c2);
  const oD = atomo("O", c2.clone().add(V(0.7, 0.6, 0))); ligar(c2, oD, matLig, 0.14);
  const oE = atomo("O", c2.clone().add(V(0.4, -0.95, 0))); ligar(c2, oE);
  let p = oE;
  const dirCauda = V(0.32, -0.95, -0.05).normalize();
  const lado = V(1, 0.3, 0).normalize();
  const cauda = [];
  for (let k = 0; k < 20; k++) {
    const q = p.clone().addScaledVector(dirCauda, 0.62).addScaledVector(lado, k % 2 ? 0.38 : -0.38);
    atomo("C", q); ligar(p, q); p = q; cauda.push(q);
    if (k % 4 === 2) { // ramificações (metil)
      const r = q.clone().add(V(k % 8 === 2 ? 0.9 : -0.9, 0.2, 0.3));
      atomo("C", r); ligar(q, r);
    }
  }

  // membrana onde a cauda fica presa
  const membrana = new THREE.Mesh(new THREE.BoxGeometry(16, 7.5, 7), matVidro(0xffe0b2, 0.16, { side: THREE.FrontSide }));
  membrana.position.set(1.5, -12.2, 0);
  cena.add(membrana);
  const topoMemb = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), matVidro(0xffcc80, 0.3));
  topoMemb.rotation.x = -PI / 2; topoMemb.position.set(1.5, -8.45, 0);
  cena.add(topoMemb);

  // brilho do anel quando absorve luz
  const halo = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), new THREE.MeshBasicMaterial({
    color: 0x9cff57, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  halo.position.z = -0.4;
  cena.add(halo);

  // rótulos e clique no magnésio
  cena.add(rk("magnesio", V(0.8, 0.75, 0.6), "dir"));
  cena.add(rk("anel", V(0, 5.3, 0)));
  cena.add(rk("cauda", cauda[9].clone().add(V(1.2, 0, 0)), "dir"));
  cena.add(rk("nitrogenio", pir[2].vs[0].clone().add(V(-0.2, 0.75, 0.4)), "esq"));
  cena.add(rk("carbono", pir[1].vs[2].clone().add(V(-0.3, 0.65, 0.4))));
  cena.add(rk("oxigenio_at", oCet.clone().add(V(-0.6, -0.6, 0.4)), "esq"));
  cena.add(rk("membrana_til", V(8.0, -9.0, 3.5), "dir"));
  const mgMesh = atomos[0].m;
  N.clicaveis.push({ obj: mgMesh, acao: () => avisar("Este magnésio veio do solo: as raízes o absorveram junto com a água e os sais minerais!") });

  // ----- luz que chega, luz verde refletida e elétrons liberados
  const noAnel = () => escolher(atomos.slice(0, 30)).p.clone();
  const rotasAbs = [], rotasRef = [], rotasE = [];
  for (let i = 0; i < 40; i++) {
    const de = V(-14, entre(3, 9), entre(-1, 4));
    const alvo = noAnel();
    rotasAbs.push(rotaCurva([de, alvo]));
    rotasRef.push(rotaCurva([de.clone().add(V(0, entre(-1, 1), 0)), alvo.clone(), V(entre(-3, 6), entre(-1, 6), 13)]));
    rotasE.push(rotaCurva([alvo.clone(), alvo.clone().add(V(1.5, 1.5, 1)), V(14, entre(-2, 4), entre(-2, 2))]));
  }
  const fluxAbs = new Fluxo("luz", rotasAbs, { n: 55, vel: 7, tam: 0.16, dens: () => estado.luz * absorcao() });
  N.addFluxo(fluxAbs);
  N.addFluxo(new Fluxo("luzverde", rotasRef, { n: 45, vel: 7, tam: 0.14 }));
  N.addFluxo(new Fluxo("eletron", rotasE, { n: 30, vel: 3.5, tam: 0.14, dens: () => estado.luz * absorcao() }));
  // com luz branca, a luz absorvida aparece como vermelha e azul
  N.aoMudarCor = (cor) => {
    if (cor === "branca") {
      fluxAbs.mesh.material.color.set(0xffffff);
      fluxAbs.recolorir((i) => (i % 2 ? TINTA.vermelha : TINTA.azul));
    } else {
      fluxAbs.recolorir(() => 0xffffff);
    }
  };

  N.animar = (dt, t) => {
    const forca = estado.luz * absorcao();
    halo.material.opacity = 0.05 + 0.22 * forca * (0.6 + 0.4 * Math.sin(t * 6));
    matAt.Mg.emissive.setRGB(0.1 + 0.4 * forca, 0.4 + 0.5 * forca, 0.05);
  };
  return N;
}

// ---------------------------------------------------------------- montagem
const NIVEIS = {};
for (const N of [criarPlanta(), criarFolha(), criarCelula(), criarCloroplasto(), criarTilacoide(), criarClorofila()]) NIVEIS[N.id] = N;
// tipos de partícula que aparecem em cada nível (para a legenda)
for (const N of Object.values(NIVEIS)) {
  N.tipos = [...new Set(N.fluxos.map((f) => f.tipo))];
  if (N.id === "planta" || N.id === "folha") N.tipos.splice(1, 0, "minerais");
}
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

const LEG = CFG.legenda, LEGD = CFG.legenda_detalhes || {};
const corBola = (tipo) => (tipo === "luz" ? TINTA[estado.cor] : CORES[tipo]);
const bolinha = (tipo) => `<span class="bola${tipo === "glicose" ? " hex" : tipo.startsWith("bateria") ? " bat" : ""}" style="background:${CSS_COR(corBola(tipo))}"></span>`;
function montarLegenda() {
  $("legenda").innerHTML = atual.tipos.map((t) => `<span>${bolinha(t)}${(estado.detalhes && LEGD[t]) || LEG[t]}</span>`).join("");
}

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
    else if (ORDEM.indexOf(n.id) > ORDEM.indexOf(atual.id) + 1) b.classList.add("longe");
    if (atual && n.id === atual.id) b.classList.add("atual");
    b.addEventListener("click", () => {
      if (!n.pronto) return avisar(`${n.titulo}: chega na etapa 2!`);
      if (n.id !== atual.id && !tour.ativo) irPara(n.id, null);
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
    ${estado.detalhes && n.detalhes ? `<div class="caixa det"><b>Mais detalhes</b>${n.detalhes}</div>` : ""}
    <div class="caixa dica">👆 ${n.dica}</div>`;
  $("recolher").addEventListener("click", () => { painelFechado = !painelFechado; montarPainel(); });
  redimensionar();
}

function atualizarInterface() {
  montarTrilha();
  montarPainel();
  $("voltar").hidden = ORDEM.indexOf(atual.id) === 0;
  document.querySelectorAll("[data-so]").forEach((el) => (el.hidden = el.dataset.so !== atual.id));
  montarLegenda();
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
  const pct = Math.round(estado.taxa * 100);
  if (pct !== ultimaTaxa) {
    ultimaTaxa = pct;
    $("taxaV").textContent = pct + "%";
    $("taxaBarra").style.width = pct + "%";
  }
  const M = CFG.medidor;
  let msg;
  const lef = estado.luz * EFIC[estado.cor];
  if (estado.luz < 0.02) msg = estado.montagem > 0.04 ? M.acabando : M.escuro;
  else if (estado.cor === "verde" && lef === estado.limite) msg = M.verde;
  else if (estado.limite >= 0.75 && estado.taxa >= 0.7) msg = M.otimo;
  else if (lef === estado.limite) msg = M.luz;
  else if (estado.agua === estado.limite) msg = M.agua;
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
function aplicarCorLuz() {
  for (const f of FLUXOS_LUZ) f.mesh.material.color.set(TINTA[estado.cor]);
  for (const N of Object.values(NIVEIS)) {
    for (const s of N.sois) s.color.set(LUZ_CENA[estado.cor]);
    if (N.aoMudarCor) N.aoMudarCor(estado.cor);
  }
  if (atual) montarLegenda();
}
const selCor = $("corLuz");
selCor.innerHTML = CFG.cores_luz.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");
selCor.addEventListener("change", () => { estado.cor = selCor.value; aplicarCorLuz(); atualizarMedidor(); escreverEndereco(); });
$("vDetalhes").addEventListener("change", (e) => {
  estado.detalhes = e.target.checked; trocarNomes(); montarPainel(); montarLegenda();
});
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
  if (h.has("cor") && EFIC[h.get("cor")] !== undefined) { estado.cor = selCor.value = h.get("cor"); }
  if (h.get("detalhes") === "1") { $("vDetalhes").checked = true; estado.detalhes = true; }
  const n = h.get("nivel");
  return NIVEIS[n] ? n : "planta";
}
function escreverEndereco() {
  if (!atual) return;
  const partes = [`nivel=${atual.id}`];
  for (const id of ["luz", "agua", "co2"]) if ($(id).value !== "100") partes.push(`${id}=${$(id).value}`);
  if (estado.cor !== "branca") partes.push(`cor=${estado.cor}`);
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

// ---------------------------------------------------------------- viagens: caminho de volta da glicose e viagem completa
const _alvoCam = new THREE.Vector3();
const heroi = { ativo: false, seguindo: false, esperando: false, curva: null, t: 0, dur: 4.5, ok: null, resolver: null,
  offset: V(2, 2, 5), alvoClique: null };
heroi.mesh = new THREE.Mesh(geoHex, new THREE.MeshStandardMaterial({ color: 0xffb02e, emissive: 0xff7a00, emissiveIntensity: 0.9 }));
{
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,200,80,.9)"); gr.addColorStop(1, "rgba(255,160,40,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, transparent: true }));
  brilho.scale.setScalar(4.5);
  heroi.mesh.add(brilho);
}
const marcador = new THREE.Group();
marcador.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffa000 })));
const marcadorAlvo = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
marcador.add(marcadorAlvo);
const rotMarcador = rotulo("Clique aqui", V(0, 1.9, 0), "", "alvo");
marcador.add(rotMarcador);
function tirarMarcador() { marcador.removeFromParent(); rotMarcador.element.style.display = "none"; }

const tour = { ativo: false, geracao: 0 };
const vivo = (g) => tour.ativo && tour.geracao === g;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
function mostrarRoteiro(texto, pedido) {
  $("roteiroTexto").textContent = texto;
  $("roteiroPedido").textContent = pedido || "";
  $("roteiroPedido").hidden = !pedido;
  $("roteiro").hidden = false;
}
function iniciarTour() {
  tour.ativo = true; tour.geracao++;
  document.body.classList.add("emViagem");
  return tour.geracao;
}
function encerrarTour() {
  tour.ativo = false; tour.geracao++;
  heroi.seguindo = heroi.ativo = heroi.esperando = false;
  if (heroi.resolver) { const r = heroi.resolver; heroi.resolver = null; r(); }
  if (heroi.ok) { const r = heroi.ok; heroi.ok = null; r(); }
  heroi.mesh.removeFromParent();
  tirarMarcador();
  $("roteiro").hidden = true;
  controles.autoRotate = $("vGirar").checked;
  controles.enabled = true;
  document.body.classList.remove("emViagem");
}
function moverHeroi(dt) {
  if (heroi.mesh.parent) heroi.mesh.rotation.y += dt * 1.5;
  if (marcador.parent) {
    marcador.quaternion.copy(camera.quaternion);
    marcador.children[0].scale.setScalar(1 + 0.15 * Math.sin(tempo * 5));
  }
  if (!heroi.ativo) return;
  heroi.t = Math.min(1, heroi.t + dt / heroi.dur);
  heroi.curva.getPointAt(heroi.t, heroi.mesh.position);
  if (heroi.t >= 1) {
    heroi.ativo = false;
    const ok = heroi.ok; heroi.ok = null;
    if (ok) ok();
  }
}
async function percorrer(N, guiado, passo, g) {
  const v = N.volta;
  heroi.curva = v.curva();
  heroi.offset = v.offset;
  N.cena.add(heroi.mesh);
  heroi.mesh.scale.setScalar(v.offset.length() * 0.045);
  heroi.curva.getPointAt(0, heroi.mesh.position);
  heroi.seguindo = true;
  mostrarRoteiro(passo.texto, guiado ? passo.clique : "");
  if (guiado) {
    marcador.position.copy(v.marcador());
    marcador.scale.setScalar(v.offset.length() * 0.028);
    N.cena.add(marcador);
    heroi.esperando = true;
    await new Promise((ok) => {
      heroi.resolver = ok;
      heroi.alvoClique = { obj: marcadorAlvo, acao: () => { heroi.esperando = false; tirarMarcador(); heroi.resolver = null; ok(); } };
    });
  } else await esperar(1500);
  if (!vivo(g)) return;
  await new Promise((ok) => { heroi.t = 0; heroi.dur = 4.5; heroi.ok = ok; heroi.ativo = true; });
  if (!vivo(g)) return;
  if (v.aoChegar) v.aoChegar();
  await esperar(guiado ? 600 : 1200);
}
async function caminhoDeVolta(guiado, g = null) {
  if (g === null) {
    if (tour.ativo || ocupado) return;
    g = iniciarTour();
  }
  for (const passo of CFG.volta) {
    if (!vivo(g)) return;
    heroi.seguindo = false;
    heroi.mesh.removeFromParent();
    if (atual.id !== passo.nivel) await irPara(passo.nivel, null);
    if (!vivo(g)) return;
    await percorrer(NIVEIS[passo.nivel], guiado, passo, g);
  }
  if (!vivo(g)) return;
  heroi.seguindo = false;
  mostrarRoteiro(CFG.volta_fim, "");
  const c = atual.cam;
  await animarCamera(camera.position.clone(), posNormal(c), controles.target.clone(), c.alvo.clone(), 1.6);
  await esperar(7000);
  if (vivo(g)) encerrarTour();
}
async function viagemCompleta() {
  if (tour.ativo || ocupado) return;
  const g = iniciarTour();
  if (atual.id !== "planta") await irPara("planta", null);
  for (let i = 0; i < ORDEM.length; i++) {
    if (!vivo(g)) return;
    mostrarRoteiro(CFG.niveis[i].viagem, "");
    controles.autoRotate = true;
    await esperar(8000);
    controles.autoRotate = $("vGirar").checked;
    if (!vivo(g)) return;
    if (i < ORDEM.length - 1) await NIVEIS[ORDEM[i]].entrar();
  }
  await caminhoDeVolta(false, g);
}
$("bViagem").addEventListener("click", viagemCompleta);
$("bVoltaAuto").addEventListener("click", () => caminhoDeVolta(false));
$("bVoltaGuiada").addEventListener("click", () => caminhoDeVolta(true));
$("roteiroParar").addEventListener("click", encerrarTour);

// ---------------------------------------------------------------- clique nas partes destacadas
const raio = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
let apertou = null;
function acertar(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raio.setFromCamera(ponteiro, camera);
  const lista = heroi.esperando ? [heroi.alvoClique] : atual.clicaveis;
  const hits = raio.intersectObjects(lista.map((c) => c.obj), false);
  return hits.length ? lista.find((c) => c.obj === hits[0].object) : null;
}
renderer.domElement.addEventListener("pointerdown", (ev) => { apertou = { x: ev.clientX, y: ev.clientY }; });
renderer.domElement.addEventListener("pointerup", (ev) => {
  if (!apertou || ocupado || (tour.ativo && !heroi.esperando)) return;
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
    calcularTaxa(dt);
    atualizarMedidor();
    moverHeroi(dt);
    atual.animar(dt, tempo);
    if (estado.caminhos) for (const f of atual.fluxos) f.atualizar(dt);
  }
  if (heroi.seguindo && !anims.length) {
    controles.target.lerp(heroi.mesh.position, Math.min(1, dt * 4));
    camera.position.lerp(_alvoCam.copy(heroi.mesh.position).add(heroi.offset), Math.min(1, dt * 1.6));
  }
  if (!anims.length && !heroi.seguindo) controles.update(); else camera.lookAt(controles.target);
  renderer.render(atual.cena, camera);
  rotRenderer.render(atual.cena, camera);
}

const inicial = lerEndereco();
ativar(inicial);
camera.position.copy(posNormal(atual.cam));
controles.target.copy(atual.cam.alvo);
for (const N of Object.values(NIVEIS)) N.atualizarLuz(estado.luz);
aplicarCorLuz();
trocarNomes();
calcularTaxa(0);
atualizarMedidor();
redimensionar();
quadro();
window.__simulador = { NIVEIS, estado, irPara, camera, controles, caminhoDeVolta, viagemCompleta, heroi, marcadorAlvo, encerrarTour }; // para testes no console
