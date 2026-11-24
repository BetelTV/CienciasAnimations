// deriva.js — simulador da deriva dos continentes em quatro níveis:
//   1) Terra no tempo: globo com a reconstrução dos continentes de 300 milhões de anos até hoje e as evidências de Wegener
//   2) Por dentro da Terra: corte do planeta com as camadas
//   3) Litosfera de perto: crosta continental e oceânica, manto litosférico e astenosfera
//   4) Convecção do manto: corte do Pacífico à África, com o Atlântico se abrindo e a placa de Nazca mergulhando
// Os textos vêm de gerar_site.py (window.CFG). A posição dos continentes vem de reconstrucao.js.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { geoPath, geoEquirectangular, geoContains, geoCircle, geoInterpolate, geoDistance, geoGraticule10 } from "./vendor/d3-geo.module.js";
import GEO from "./continentes.js";
import * as REC from "./reconstrucao.js";

const CFG = window.CFG;
const R = CFG.rotulos;
const $ = (id) => document.getElementById(id);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI, RAD = PI / 180;
const limitar = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const suave = (x) => x * x * (3 - 2 * x);
const celular = matchMedia("(max-width: 760px)").matches;

let semente = 20261124;
function rnd() {
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => a + (b - a) * rnd();

// ---------------------------------------------------------------- estado
const estado = {
  t: 300, tocando: false, alvoT: null, encaixe: 0, encaixeAlvo: 0,
  fosseis: true, fossil: null, geleiras: false, montanhas: false, carvao: false, cores: true, campinas: true,
  nomes: true, girar: false, detalhes: false, aumentar: true, correntes: true, particulas: true, faixas: true,
  camada: null, parteLit: null,
};
const TMAX = 300, TCONV = 140; // a convecção mostra de 140 milhões de anos até hoje

// ---------------------------------------------------------------- renderizador
const cenaEl = $("cena");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
cenaEl.prepend(renderer.domElement);
const rotRenderer = new CSS2DRenderer();
rotRenderer.domElement.className = "camadaRotulos";
renderer.domElement.after(rotRenderer.domElement);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.autoRotateSpeed = 0.6;

function rotulo(texto, pos, classe = "") {
  const d = document.createElement("div");
  d.className = "rot3d";
  const s = document.createElement("span");
  s.textContent = texto;
  if (classe) s.className = classe;
  d.appendChild(s);
  const o = new CSS2DObject(d);
  o.position.copy(pos);
  o.userData.rotulo = true;
  o.center.set(0.5, 0.5);
  return o;
}
const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85, flatShading: true, ...extra });
function estrelas() {
  const n = 900, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const z = entre(-1, 1), a = entre(0, 2 * PI), r = Math.sqrt(1 - z * z), d = entre(40, 80);
    p.set([r * Math.cos(a) * d, z * d, r * Math.sin(a) * d], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.8 }));
}
const SOIS = [];
function luzes(cena, forte = 1) {
  cena.add(new THREE.HemisphereLight(0xeef3ff, 0x3a3028, 1.35 * forte));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5 * forte);
  sol.position.set(4, 3, 5);
  cena.add(sol);
  SOIS.push(sol);
  return sol;
}

// posição no globo (raio 1) a partir de longitude e latitude, compatível com a textura equirretangular
const posGlobo = (lon, lat, r = 1) => V(r * Math.cos(lat * RAD) * Math.cos(lon * RAD), r * Math.sin(lat * RAD), -r * Math.cos(lat * RAD) * Math.sin(lon * RAD));

// =====================================================================================================
// 1) TERRA NO TEMPO
// =====================================================================================================
REC.prepararPlacas(GEO);
const PL = REC.PLACAS;
const CORES_PLACA = { AF: "#e3b25b", SA: "#7cc36e", NA: "#e07a6a", CA: "#d9a0a0", EU: "#a98bd8", IS: "#c8c8c8", AR: "#ead27a",
  AN: "#f1f5fb", MG: "#f29cc2", IN: "#5fc6c8", AU: "#f39b55" };
const JOVENS = { CA: 1, IS: 1 }; // terrenos que ainda não existiam com essa forma: aparecem aos poucos
const COR_FOSSIL = { mesosaurus: "#1f6fd6", glossopteris: "#2f9e44", lystrosaurus: "#b5541c", cynognathus: "#d4a017" };
const FOSSIL = Object.fromEntries(CFG.fosseis.map((f) => [f.id, f]));

// [placa, longitude, latitude, lugar]
const PONTOS_FOSSEIS = {
  mesosaurus: [["SA", -47.56, -22.41, "Rio Claro (SP)"], ["SA", -48.05, -23.59, "Itapetininga (SP)"], ["SA", -50.38, -25.87, "São Mateus do Sul (PR)"],
    ["SA", -49.6, -27.6, "Santa Catarina"], ["SA", -55.0, -29.6, "Rio Grande do Sul"], ["SA", -54.6, -32.4, "Uruguai"],
    ["AF", 18.1, -26.6, "Keetmanshoop (Namíbia)"], ["AF", 17.3, -24.2, "Namíbia"], ["AF", 20.5, -28.6, "África do Sul"], ["AF", 21.8, -32.6, "Karoo (África do Sul)"]],
  glossopteris: [["SA", -49.4, -28.7, "Criciúma (SC)"], ["SA", -54.3, -30.3, "São Gabriel (RS)"], ["SA", -50.2, -24.6, "Paraná"], ["SA", -47.8, -22.8, "São Paulo"],
    ["SA", -68.3, -34.6, "Argentina"], ["SA", -59.0, -51.8, "Ilhas Malvinas"], ["AF", 29.2, -25.9, "África do Sul"], ["AF", 26.0, -31.0, "África do Sul"],
    ["AF", 26.5, -18.4, "Zimbábue"], ["AF", 33.6, -16.1, "Moçambique"], ["MG", 44.6, -23.8, "Madagascar"], ["IN", 86.9, 23.7, "Raniganj (Índia)"],
    ["IN", 80.5, 22.5, "Índia"], ["IN", 79.5, 17.9, "Índia"], ["AN", 166, -84.5, "Geleira Beardmore (Antártida)"], ["AN", 160, -83.3, "Antártida"],
    ["AU", 149.6, -32.6, "Nova Gales do Sul (Austrália)"], ["AU", 148.2, -23.5, "Queensland (Austrália)"], ["AU", 116.2, -33.4, "Austrália Ocidental"], ["AU", 146.5, -42.0, "Tasmânia"]],
  lystrosaurus: [["AF", 25.5, -31.5, "Bacia do Karoo (África do Sul)"], ["AF", 24.3, -32.3, "África do Sul"], ["AF", 27.2, -30.4, "África do Sul"],
    ["IN", 86.8, 23.6, "Vale do Damodar (Índia)"], ["IN", 84.0, 22.4, "Índia"], ["AN", 159.5, -84.2, "Coalsack Bluff (Antártida)"], ["AN", 165, -85.0, "Antártida"]],
  cynognathus: [["SA", -68.4, -34.9, "Mendoza (Argentina)"], ["SA", -67.6, -33.0, "Argentina"], ["AF", 26.5, -31.0, "África do Sul"], ["AF", 27.6, -30.0, "África do Sul"],
    ["AF", 16.9, -21.0, "Namíbia"], ["AN", 164, -84.6, "Antártida"]],
};
const PONTOS_GELEIRA = [["SA", -47.3, -23.2, "Salto e Itu (SP)"], ["SA", -50.5, -26.3, "Paraná e Santa Catarina"], ["SA", -56.0, -31.0, "Uruguai"],
  ["AF", 20.0, -32.0, "África do Sul"], ["AF", 16.5, -25.0, "Namíbia"], ["AF", 28.0, -17.0, "Zâmbia"], ["MG", 46.0, -21.5, "Madagascar"],
  ["IN", 85.2, 21.0, "Índia"], ["IN", 78.0, 23.5, "Índia"], ["AU", 138.5, -35.0, "Austrália do Sul"], ["AU", 116.0, -31.0, "Austrália Ocidental"],
  ["AU", 145.7, -41.0, "Tasmânia"], ["AN", -60.0, -80.0, "Antártida"], ["AN", 100.0, -76.0, "Antártida"]];
const CENTRO_GELO = ["AN", 25, -78]; // centro aproximado da calota de gelo, preso à Antártida
const MONTANHAS = [
  ["NA", "Apalaches", [[-84.5, 34], [-81, 37], [-77.5, 39.5], [-74.5, 41.5], [-71, 43.5], [-68, 46], [-64, 47.5], [-58, 48.5], [-55.5, 49.8]]],
  ["EU", "Caledonianas", [[-9.5, 53.5], [-6, 56.5], [-4.5, 58], [5.5, 59.5], [8, 62], [12, 64.5], [15, 67], [18.5, 69.2]]],
  ["NA", "Caledonianas (Groenlândia)", [[-26, 71], [-24, 74], [-21, 77]]],
  ["AF", "Mauritânides", [[-16, 15.5], [-14.5, 19], [-13, 22], [-11, 25.5], [-9, 28.5]]],
];
const ROCHAS = [
  ["SA", -44.3, -2.6, "Rochas de 2 bilhões de anos (São Luís, MA)", "#7a4fb5"], ["AF", -1.5, 6.0, "Rochas de 2 bilhões de anos (Gana)", "#7a4fb5"],
  ["SA", -51.5, -27.0, "Basalto da Serra Geral", "#3d3d48"], ["AF", 14.2, -20.5, "Basalto de Etendeka", "#3d3d48"],
];
const CARVAO = ["AN", 163, -84.2, "Carvão e fósseis de plantas"];
const CAMPINAS = ["SA", -47.06, -22.9, "Campinas"];

// textura do globo (mapa equirretangular desenhado com d3-geo)
const TW = celular ? 1536 : 2048, TH = TW / 2;
function novaTela(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
const telaTerra = novaTela(TW, TH), ctxT = telaTerra.getContext("2d");
const telaMasc = novaTela(TW, TH), ctxM = telaMasc.getContext("2d");
const proj = geoEquirectangular().scale(TW / (2 * PI)).translate([TW / 2, TH / 2]).precision(0.4);
const caminhoT = geoPath(proj, ctxT), caminhoM = geoPath(proj, ctxM);
const GRADE = geoGraticule10();
const circulo = geoCircle();

function girarPonto(rots, placa, lon, lat) { return REC.girarLonLat(rots[placa], lon, lat); }
function clarear(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (x) => Math.round(x + (255 - x) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
// setas das geleiras: calculadas na Pangeia (saindo do centro do gelo) e guardadas nas coordenadas de hoje
const SETAS_GELO = (() => {
  const r270 = REC.rotacoes(270), inv = (q) => REC.qInv(q);
  const c = girarPonto(r270, CENTRO_GELO[0], CENTRO_GELO[1], CENTRO_GELO[2]);
  return PONTOS_GELEIRA.map(([pl, lon, lat, nome]) => {
    const p = girarPonto(r270, pl, lon, lat);
    const fim = geoInterpolate(c, p)(1 + 4.5 / Math.max(3, geoDistance(c, p) / RAD));
    const ini = geoInterpolate(c, p)(1 - 2.5 / Math.max(3, geoDistance(c, p) / RAD));
    const vIni = REC.girarLonLat(inv(r270[pl]), ini[0], ini[1]), vFim = REC.girarLonLat(inv(r270[pl]), fim[0], fim[1]);
    return { pl, nome, lon, lat, ini: vIni, fim: vFim };
  });
})();

const cacheTerra = { rots: null, geos: {}, fosseis: [] };
function idadeEncaixe() { return estado.t < 0.5 && estado.encaixe > 0 ? { SA: estado.encaixe } : null; }

function desenharMapa(ctx, caminho, t, opc) {
  const rots = REC.rotacoes(t, opc.extra);
  const geos = {};
  for (const k of REC.ORDEM) geos[k] = REC.girarGeo(rots[k], GEO[k]);
  // oceano
  const g = ctx.createLinearGradient(0, 0, 0, TH);
  g.addColorStop(0, "#1b3f73"); g.addColorStop(0.5, "#2366a8"); g.addColorStop(1, "#1b3f73");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);
  ctx.beginPath(); caminho(GRADE); ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "rgba(255,236,150,.55)"; ctx.fillRect(0, TH / 2 - 1.5, TW, 3); // equador
  // plataforma continental (borda clara em volta de cada continente)
  ctx.lineJoin = "round";
  for (const k of REC.ORDEM) {
    const a = JOVENS[k] ? limitar(1 - t / 45, 0.12, 1) : 1;
    ctx.globalAlpha = a; ctx.beginPath(); caminho(geos[k]);
    ctx.strokeStyle = "#5d9bd6"; ctx.lineWidth = TW / 300; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // continentes (em uma tela separada, para as evidências ficarem só em terra)
  const m = opc.masc;
  m.ctx.globalCompositeOperation = "source-over";
  m.ctx.clearRect(0, 0, TW, TH);
  const evid = opc.evidencias;
  for (const k of REC.ORDEM) {
    let cor = opc.cores ? CORES_PLACA[k] : (k === "AN" ? "#eef3f7" : "#97c26e");
    if (evid && opc.cores) cor = clarear(CORES_PLACA[k], 0.5);
    m.ctx.globalAlpha = JOVENS[k] ? limitar(1 - t / 45, 0.12, 1) : 1;
    m.ctx.beginPath(); m.caminho(geos[k]);
    m.ctx.fillStyle = cor; m.ctx.fill();
    m.ctx.strokeStyle = "rgba(40,30,20,.55)"; m.ctx.lineWidth = 1.2; m.ctx.stroke();
  }
  m.ctx.globalAlpha = 1;
  m.ctx.globalCompositeOperation = "source-atop";
  if (t > 255) { // calota de gelo de ~300 milhões de anos (sobre os continentes)
    const c = girarPonto(rots, CENTRO_GELO[0], CENTRO_GELO[1], CENTRO_GELO[2]);
    const a = limitar((t - 255) / 30) * (opc.geleiras ? 0.85 : 0.55);
    m.ctx.fillStyle = "#ffffff";
    m.ctx.globalAlpha = a * 0.55; m.ctx.beginPath(); m.caminho(circulo.center(c).radius(27)()); m.ctx.fill();
    m.ctx.globalAlpha = a * 0.6; m.ctx.beginPath(); m.caminho(circulo.center(c).radius(17)()); m.ctx.fill();
    m.ctx.globalAlpha = 1;
  }
  const fosseis = [];
  if (opc.fosseis) {
    for (const [id, pts] of Object.entries(PONTOS_FOSSEIS)) {
      const ativo = !opc.fossil || opc.fossil === id;
      m.ctx.fillStyle = COR_FOSSIL[id];
      m.ctx.globalAlpha = ativo ? 0.62 : 0.12;
      for (const [pl, lon, lat, lugar] of pts) {
        const c = girarPonto(rots, pl, lon, lat);
        m.ctx.beginPath(); m.caminho(circulo.center(c).radius(id === "glossopteris" ? 5.5 : 4.8)());
        m.ctx.fill();
        fosseis.push({ id, lugar, lon: c[0], lat: c[1], ativo });
      }
    }
  }
  if (opc.montanhas) {
    m.ctx.globalAlpha = 0.9;
    for (const [pl, lon, lat, , cor] of ROCHAS) {
      const c = girarPonto(rots, pl, lon, lat);
      m.ctx.beginPath(); m.caminho(circulo.center(c).radius(3.2)()); m.ctx.fillStyle = cor; m.ctx.fill();
    }
  }
  m.ctx.globalAlpha = 1;
  m.ctx.globalCompositeOperation = "source-over";
  if (opc.montanhas) {
    for (const [pl, , pts] of MONTANHAS) {
      const linha = { type: "LineString", coordinates: pts.map(([lon, lat]) => girarPonto(rots, pl, lon, lat)) };
      m.ctx.beginPath(); m.caminho(linha); m.ctx.strokeStyle = "#4a2f17"; m.ctx.lineWidth = TW / 170; m.ctx.lineCap = "round"; m.ctx.stroke();
      m.ctx.beginPath(); m.caminho(linha); m.ctx.strokeStyle = "#a86a32"; m.ctx.lineWidth = TW / 300; m.ctx.stroke();
    }
  }
  ctx.drawImage(m.tela, 0, 0);
  if (opc.geleiras) {
    ctx.strokeStyle = "#0b2a4a"; ctx.fillStyle = "#0b2a4a"; ctx.lineWidth = TW / 520;
    for (const s of SETAS_GELO) {
      const a = proj(girarPonto(rots, s.pl, s.ini[0], s.ini[1])), b = proj(girarPonto(rots, s.pl, s.fim[0], s.fim[1]));
      if (!a || !b || Math.abs(a[0] - b[0]) > TW / 3) continue;
      seta(ctx, a, b, TW / 160);
    }
  }
  if (opc.fosseis) {
    for (const f of fosseis) {
      const p = proj([f.lon, f.lat]);
      ctx.globalAlpha = f.ativo ? 1 : 0.25;
      ctx.beginPath(); ctx.arc(p[0], p[1], TW / 700, 0, 2 * PI);
      ctx.fillStyle = COR_FOSSIL[f.id]; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = TW / 1400; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  return { rots, geos, fosseis };
}
function seta(ctx, a, b, tam) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - tam * Math.cos(ang - 0.45), b[1] - tam * Math.sin(ang - 0.45));
  ctx.lineTo(b[0] - tam * Math.cos(ang + 0.45), b[1] - tam * Math.sin(ang + 0.45));
  ctx.closePath(); ctx.fill();
}

function criarTerra() {
  const cena = new THREE.Scene();
  cena.add(estrelas());
  luzes(cena);
  const tex = new THREE.CanvasTexture(telaTerra);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const globo = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 }));
  cena.add(globo);
  // atmosfera
  const atm = new THREE.Mesh(new THREE.SphereGeometry(1.045, 64, 48), new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false,
    vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "varying vec3 vN; void main(){ float k = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.35,0.62,1.0,1.0)*k; }",
  }));
  cena.add(atm);

  const grupoRot = new THREE.Group();
  cena.add(grupoRot);
  const rotPlaca = {};
  for (const k of REC.ORDEM) if (!JOVENS[k]) { rotPlaca[k] = rotulo(PL[k].nome, V(0, 0, 0)); grupoRot.add(rotPlaca[k]); }
  const rotMar = {
    pangeia: rotulo("Pangeia", V(), "grande"), laurasia: rotulo("Laurásia", V(), "grande"), gondwana: rotulo("Gondwana", V(), "grande"),
    pantalassa: rotulo("Oceano Pantalassa", V(), "oceano"), tetis: rotulo("Mar de Tétis", V(), "oceano"), atlantico: rotulo("Oceano Atlântico", V(), "oceano"),
    atlanticoN: rotulo("Atlântico Norte", V(), "oceano"), indico: rotulo("Oceano Índico", V(), "oceano"), pacifico: rotulo("Oceano Pacífico", V(), "oceano"),
  };
  Object.values(rotMar).forEach((o) => grupoRot.add(o));
  const rotFossil = {};
  for (const f of CFG.fosseis) {
    const o = rotulo(f.nome, V(), "fossil");
    o.element.firstChild.style.color = COR_FOSSIL[f.id];
    rotFossil[f.id] = o; grupoRot.add(o);
  }
  const rotEvid = {
    gelo: rotulo("Calota de gelo", V(), "fraco"), saltoItu: rotulo("Marcas de geleira: Salto e Itu (SP)", V(), "fraco"),
    carvao: rotulo("⚫ " + CARVAO[3], V(), "fraco"), campinas: rotulo("📍 Campinas", V(), "local"),
  };
  MONTANHAS.forEach(([, nome], i) => { if (i !== 2) rotEvid["m" + i] = rotulo("⛰️ " + nome, V(), "fraco"); });
  ROCHAS.forEach(([, , , nome], i) => { rotEvid["r" + i] = rotulo(nome, V(), "fraco " + (i % 2 ? "dir" : "esq")); });
  Object.values(rotEvid).forEach((o) => grupoRot.add(o));

  let sujo = true;
  const N = {
    id: "terra", cena, globo, cam: { pos: V(0, 0.25, 3.95), alvo: V(0, 0, 0), min: 1.4, max: 7 },
    marcarSujo() { sujo = true; },
    redesenhar() {
      const evid = estado.fosseis || estado.geleiras || estado.montanhas || estado.carvao;
      const r = desenharMapa(ctxT, caminhoT, estado.t, {
        extra: idadeEncaixe(), cores: estado.cores, evidencias: evid, fosseis: estado.fosseis, fossil: estado.fossil,
        geleiras: estado.geleiras, montanhas: estado.montanhas, masc: { ctx: ctxM, caminho: caminhoM, tela: telaMasc },
      });
      cacheTerra.rots = r.rots; cacheTerra.geos = r.geos; cacheTerra.fosseis = r.fosseis;
      tex.needsUpdate = true;
      posicionarRotulos(r.rots);
      sujo = false;
    },
    animar(dt) { // durante a animação, redesenha no máximo ~20 vezes por segundo
      const agora = performance.now();
      if (sujo && (agora - (N.ultimo || 0) > 48 || !(estado.tocando || tour.ativo))) { N.redesenhar(); N.ultimo = agora; }
    },
    clicaveis: [],
  };

  const meio = (a, b) => geoInterpolate(a, b)(0.5);
  function poe(o, lonlat, mostrar = true, r = 1.03) { o.position.copy(posGlobo(lonlat[0], lonlat[1], r)); o.userData.ligado = mostrar; }
  function posicionarRotulos(rots) {
    const t = estado.t;
    const c = (k) => REC.lonlat(REC.qGira(rots[k], PL[k].centro));
    const p = (k, lon, lat) => girarPonto(rots, k, lon, lat);
    for (const k in rotPlaca) poe(rotPlaca[k], c(k), estado.nomes);
    poe(rotMar.pangeia, p("AF", 5, 22), t >= 190);
    poe(rotMar.laurasia, p("EU", 20, 58), t < 190 && t >= 100);
    poe(rotMar.gondwana, p("AF", 22, -12), t < 175 && t >= 100);
    const ctrAF = c("AF");
    poe(rotMar.pantalassa, [ctrAF[0] + 180, -ctrAF[1] * 0.3], t >= 160);
    poe(rotMar.pacifico, [ctrAF[0] + 180, -ctrAF[1] * 0.3], t < 160);
    poe(rotMar.tetis, meio(p("AR", 50, 25), p("EU", 88, 40)), t >= 30 && t < 280);
    poe(rotMar.atlantico, meio(p("SA", -37, -14), p("AF", 12, -16)), t < 105 && estado.encaixe < 0.3);
    poe(rotMar.atlanticoN, meio(p("NA", -68, 36), p("AF", -12, 28)), t < 170);
    poe(rotMar.indico, meio(p("AF", 42, -18), p("AU", 115, -28)), t < 70);
    for (const f of CFG.fosseis) {
      const [pl, lon, lat] = PONTOS_FOSSEIS[f.id][0];
      poe(rotFossil[f.id], p(pl, lon, lat + 3), estado.fosseis && estado.fossil === f.id, 1.04);
    }
    const cg = p(...CENTRO_GELO);
    poe(rotEvid.gelo, cg, t > 260);
    poe(rotEvid.saltoItu, p("SA", -47.3, -24.6), estado.geleiras);
    poe(rotEvid.carvao, p(CARVAO[0], CARVAO[1], CARVAO[2] + 2), estado.carvao);
    poe(rotEvid.campinas, p("SA", CAMPINAS[1], CAMPINAS[2]), estado.campinas, 1.02);
    MONTANHAS.forEach(([pl, , pts], i) => { if (i !== 2) { const q = pts[Math.floor(pts.length / 2)]; poe(rotEvid["m" + i], p(pl, q[0], q[1]), estado.montanhas); } });
    ROCHAS.forEach(([pl, lon, lat], i) => poe(rotEvid["r" + i], p(pl, lon, lat), estado.montanhas));
    for (const k in rotPlaca) rotPlaca[k].userData.ligado = estado.nomes;
    for (const o of Object.values(rotMar)) o.userData.ligado = o.userData.ligado && estado.nomes;
  }
  // esconde os rótulos que estão do outro lado do globo
  N.ocultar = () => {
    const dir = camera.position.clone().normalize();
    grupoRot.children.forEach((o) => {
      const vis = o.userData.ligado && o.position.clone().normalize().dot(dir) > 0.18;
      o.visible = vis;
    });
  };
  // marcador de Campinas (alfinete 3D)
  return N;
}

// clique no globo: fósseis, evidências e continentes
function lonLatDoClique(hit) { return [hit.uv.x * 360 - 180, hit.uv.y * 180 - 90]; }
function cliqueTerra(hit) {
  const ll = lonLatDoClique(hit);
  if (estado.fosseis) {
    let melhor = null, dm = 4.2 * RAD;
    for (const f of cacheTerra.fosseis) {
      if (!f.ativo) continue;
      const d = geoDistance(ll, [f.lon, f.lat]);
      if (d < dm) { dm = d; melhor = f; }
    }
    if (melhor) {
      estado.fossil = melhor.id;
      NIVEIS.terra.marcarSujo();
      montarPainel();
      avisar(`${FOSSIL[melhor.id].nome}: ${melhor.lugar}`);
      return;
    }
  }
  if (estado.geleiras) {
    for (const s of SETAS_GELO) {
      const c = girarPonto(cacheTerra.rots, s.pl, s.lon, s.lat);
      if (geoDistance(ll, c) < 4 * RAD) return avisar(`Marcas de geleiras de ~300 milhões de anos: ${s.nome}`);
    }
  }
  if (estado.montanhas) {
    for (const [pl, lon, lat, nome] of ROCHAS) if (geoDistance(ll, girarPonto(cacheTerra.rots, pl, lon, lat)) < 4 * RAD) return avisar(nome);
  }
  for (const k of REC.ORDEM) {
    if (geoContains(cacheTerra.geos[k], ll)) {
      if (JOVENS[k] && estado.t > 30) return avisar(`${PL[k].nome}: esta região ainda estava se formando nessa época.`);
      return avisar(PL[k].nome);
    }
  }
  avisar(estado.t >= 170 ? "Oceano Pantalassa: o oceano único que cercava a Pangeia." : "Oceano");
}

// =====================================================================================================
// 2) POR DENTRO DA TERRA (corte em cunha)
// =====================================================================================================
const RT = 6371;
const CAMADA = Object.fromEntries(CFG.camadas.map((c) => [c.id, c]));
const COR_CAMADA = { crosta_cont: "#c98f6b", crosta_oce: "#4b5060", litosfera: "#8e7c55", astenosfera: "#f2a64e", manto_sup: "#e07a3a",
  manto_inf: "#c24f2c", nucleo_ext: "#ffb43a", nucleo_int: "#fff2a8" };
// profundidade (km) -> raio no desenho (0 a 1). Com "engrossar", a parte de cima fica bem aumentada.
function raioCorte(d) {
  if (!estado.aumentar) return 1 - d / RT;
  const pts = [[0, 0], [100, 0.07], [350, 0.125], [660, 0.17], [RT, 1]];
  for (let i = 1; i < pts.length; i++) if (d <= pts[i][0]) {
    const [d0, f0] = pts[i - 1], [d1, f1] = pts[i];
    return 1 - (f0 + (f1 - f0) * (d - d0) / (d1 - d0));
  }
  return 0;
}
// ângulos (graus, na face do corte) com crosta continental; o resto é oceânica
const CONT_ANG = [[14, 58], [-68, -24]];
const ehCont = (a) => CONT_ANG.some(([x, y]) => a >= x && a <= y);
function espCrosta(a) { // espessura em km, com "raiz" no meio do continente
  for (const [x, y] of CONT_ANG) if (a >= x && a <= y) { const u = (a - x) / (y - x); return 35 + 30 * Math.exp(-((u - 0.35) ** 2) / 0.02); }
  return 7;
}
function desenharCorte(ctx, S, sel) {
  const c = S / 2, k = S / 2 - 2;
  ctx.clearRect(0, 0, S, S);
  const disco = (r, cor) => { ctx.beginPath(); ctx.arc(c, c, r * k, 0, 2 * PI); ctx.fillStyle = cor; ctx.fill(); };
  // manto (com degradê), núcleo externo e interno
  let g = ctx.createRadialGradient(c, c, raioCorte(2900) * k, c, c, raioCorte(660) * k);
  g.addColorStop(0, "#a83a22"); g.addColorStop(1, "#d76334");
  disco(raioCorte(100), COR_CAMADA.astenosfera);
  disco(raioCorte(350), COR_CAMADA.manto_sup);
  ctx.beginPath(); ctx.arc(c, c, raioCorte(660) * k, 0, 2 * PI); ctx.fillStyle = g; ctx.fill();
  g = ctx.createRadialGradient(c, c, raioCorte(5150) * k, c, c, raioCorte(2900) * k);
  g.addColorStop(0, "#ffd45e"); g.addColorStop(1, "#ff9a26");
  ctx.beginPath(); ctx.arc(c, c, raioCorte(2900) * k, 0, 2 * PI); ctx.fillStyle = g; ctx.fill();
  g = ctx.createRadialGradient(c, c, 0, c, c, raioCorte(5150) * k);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#ffe679");
  ctx.beginPath(); ctx.arc(c, c, raioCorte(5150) * k, 0, 2 * PI); ctx.fillStyle = g; ctx.fill();
  // litosfera e crosta, que variam com o ângulo (continente ou oceano)
  const anel = (fBase, fTopo, cor) => {
    ctx.beginPath();
    for (let a = -180; a <= 180; a += 0.5) { const r = fTopo(a) * k, x = c + r * Math.cos(a * RAD), y = c - r * Math.sin(a * RAD); a === -180 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    for (let a = 180; a >= -180; a -= 0.5) { const r = fBase(a) * k; ctx.lineTo(c + r * Math.cos(a * RAD), c - r * Math.sin(a * RAD)); }
    ctx.closePath(); ctx.fillStyle = cor; ctx.fill();
  };
  anel((a) => raioCorte(ehCont(a) ? 160 : 90), (a) => raioCorte(espCrosta(a)), COR_CAMADA.litosfera);
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, k, 0, 2 * PI); ctx.clip();
  for (const [x, y] of CONT_ANG) {
    ctx.beginPath();
    for (let a = x; a <= y; a += 0.5) { const r = k; ctx.lineTo(c + r * Math.cos(a * RAD), c - r * Math.sin(a * RAD)); }
    for (let a = y; a >= x; a -= 0.5) { const r = raioCorte(espCrosta(a)) * k; ctx.lineTo(c + r * Math.cos(a * RAD), c - r * Math.sin(a * RAD)); }
    ctx.closePath(); ctx.fillStyle = COR_CAMADA.crosta_cont; ctx.fill();
  }
  anel((a) => (ehCont(a) ? 1 : raioCorte(7)), () => 1, COR_CAMADA.crosta_oce);
  ctx.restore();
  // camada escolhida: contorno brilhante
  if (sel) {
    ctx.save();
    ctx.lineWidth = 5; ctx.strokeStyle = "#ffffff"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 12;
    const limites = { astenosfera: [100, 350], manto_sup: [0, 660], manto_inf: [660, 2900], nucleo_ext: [2900, 5150], nucleo_int: [5150, RT] }[sel];
    if (limites) for (const d of limites) { if (d >= RT) continue; ctx.beginPath(); ctx.arc(c, c, raioCorte(d) * k, 0, 2 * PI); ctx.stroke(); }
    else {
      ctx.beginPath();
      for (let a = -180; a <= 180; a += 1) {
        const crosta = sel === "crosta_cont" ? ehCont(a) : sel === "crosta_oce" ? !ehCont(a) : true;
        const base = sel === "litosfera" ? raioCorte(ehCont(a) ? 160 : 90) : raioCorte(espCrosta(a));
        if (!crosta) { ctx.stroke(); ctx.beginPath(); continue; }
        ctx.lineTo(c + base * k * Math.cos(a * RAD), c - base * k * Math.sin(a * RAD));
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // descontinuidades
  ctx.setLineDash([10, 7]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.75)";
  for (const d of [2900, 5150]) { ctx.beginPath(); ctx.arc(c, c, raioCorte(d) * k, 0, 2 * PI); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let a = -180; a <= 180; a += 0.5) { const r = raioCorte(espCrosta(a)) * k; ctx.lineTo(c + r * Math.cos(a * RAD), c - r * Math.sin(a * RAD)); }
  ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.5; ctx.stroke();
}
// qual camada está em (profundidade, ângulo)
function camadaEm(r, a) {
  const cont = ehCont(a);
  if (r > raioCorte(espCrosta(a))) return cont ? "crosta_cont" : "crosta_oce";
  if (r > raioCorte(cont ? 160 : 90)) return "litosfera";
  if (r > raioCorte(350)) return "astenosfera";
  if (r > raioCorte(660)) return "manto_sup";
  if (r > raioCorte(2900)) return "manto_inf";
  if (r > raioCorte(5150)) return "nucleo_ext";
  return "nucleo_int";
}

function criarCamadas() {
  const cena = new THREE.Scene();
  cena.add(estrelas());
  luzes(cena, 1.05);
  const grupo = new THREE.Group();
  cena.add(grupo);
  // superfície: textura da Terra de hoje, sem a cunha (de x>0, z>0)
  const telaHoje = novaTela(TW, TH), cH = telaHoje.getContext("2d");
  const telaM2 = novaTela(TW, TH);
  desenharMapa(cH, geoPath(proj, cH), 0, { extra: null, cores: false, evidencias: false, fosseis: false, masc: { ctx: telaM2.getContext("2d"), caminho: geoPath(proj, telaM2.getContext("2d")), tela: telaM2 } });
  const texHoje = new THREE.CanvasTexture(telaHoje); texHoje.colorSpace = THREE.SRGBColorSpace;
  const matSup = new THREE.MeshStandardMaterial({ map: texHoje, roughness: 0.9, side: THREE.DoubleSide });
  const casca = (phiS, phiL, u0, du) => {
    const g = new THREE.SphereGeometry(1, 96, 64, phiS, phiL);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * du);
    return new THREE.Mesh(g, matSup);
  };
  const cascas = [casca(PI, PI, 0.5, 0.5), casca(0, PI / 2, 0, 0.25)];
  cascas.forEach((c) => (c.userData.superficie = true));
  grupo.add(...cascas);
  // as duas faces do corte (meios-discos) com os anéis das camadas
  const S = celular ? 1024 : 2048;
  const telaCorte = novaTela(S, S), cC = telaCorte.getContext("2d");
  const texCorte = new THREE.CanvasTexture(telaCorte); texCorte.colorSpace = THREE.SRGBColorSpace;
  const matCorte = new THREE.MeshStandardMaterial({ map: texCorte, roughness: 0.75, side: THREE.DoubleSide, emissive: 0x331100, emissiveIntensity: 0.25 });
  const faceA = new THREE.Mesh(new THREE.CircleGeometry(1, 180, -PI / 2, PI), matCorte); // plano z = 0, x >= 0
  const faceB = new THREE.Mesh(new THREE.CircleGeometry(1, 180, -PI / 2, PI), matCorte); // plano x = 0, z >= 0
  faceB.rotation.y = -PI / 2;
  grupo.add(faceA, faceB);
  // brilho do núcleo
  const brilho = new THREE.PointLight(0xffb347, 1.2, 3);
  grupo.add(brilho);

  const rot = {};
  const nomesA = [["manto_inf", -32, 1700], ["nucleo_ext", -40, 4000], ["nucleo_int", -48, 5900]];
  const nomesB = [["crosta_oce", 80, 3], ["crosta_cont", 36, 20], ["litosfera", 64, 60], ["astenosfera", 8, 220], ["manto_sup", -6, 500]];
  for (const [id] of [...nomesA, ...nomesB]) { rot[id] = rotulo(CAMADA[id].nome, V(), "camada"); grupo.add(rot[id]); }
  const rotDesc = {};
  for (const d of CFG.descontinuidades) { rotDesc[d.id] = rotulo(d.nome.replace("Descontinuidade de ", ""), V(), "fraco"); grupo.add(rotDesc[d.id]); }
  const alvo = rotulo(R.camada_alvo_lit, V(), "alvo");
  alvo.element.classList.add("clicavel");
  alvo.element.addEventListener("click", () => irPara("litosfera"));
  grupo.add(alvo);

  function posicionar() {
    for (const [id, a, d] of nomesA) { const r = raioCorte(d); rot[id].position.set(r * Math.cos(a * RAD), r * Math.sin(a * RAD), 0.01); }
    for (const [id, a, d] of nomesB) {
      const r = raioCorte(d);
      rot[id].position.set(0.01, r * Math.sin(a * RAD), r * Math.cos(a * RAD));
    }
    const pd = { moho: [espCrosta(-46), -46], gutenberg: [2900, -64], lehmann: [5150, -70] };
    for (const [id, [d, a]] of Object.entries(pd)) { const r = raioCorte(d); rotDesc[id].position.set(r * Math.cos(a * RAD), r * Math.sin(a * RAD), 0.01); }
    alvo.position.set(0.02, Math.sin(48 * RAD) * 1.06, Math.cos(48 * RAD) * 1.06);
  }
  const N = {
    id: "camadas", cena, cam: { pos: V(2.55, 1.35, 2.55), alvo: V(0, -0.08, 0), min: 1.3, max: 6 },
    clicaveis: [faceA, faceB, ...cascas],
    redesenhar() { desenharCorte(cC, S, estado.camada); texCorte.needsUpdate = true; posicionar(); N.mostrarNomes(); },
    mostrarNomes() {
      Object.values(rot).forEach((o) => (o.visible = estado.nomes));
      Object.values(rotDesc).forEach((o) => (o.visible = estado.nomes && estado.detalhes));
      alvo.visible = true;
    },
    animar(dt, t) { brilho.intensity = 1.0 + 0.25 * Math.sin(t * 2); },
    clique(hit) {
      if (hit.object.userData.superficie) return avisar("Esta é a superfície. Clique no corte para conhecer as camadas.");
      const p = hit.object.worldToLocal(hit.point.clone());
      const r = Math.hypot(p.x, p.y);
      const a = Math.atan2(p.y, p.x) / RAD;
      const id = camadaEm(r, a);
      if (estado.camada === id && (id === "litosfera" || id.startsWith("crosta") || id === "astenosfera")) return irPara("litosfera");
      estado.camada = id;
      N.redesenhar(); montarPainel();
      avisar(CAMADA[id].nome);
    },
  };
  N.redesenhar();
  return N;
}

// =====================================================================================================
// 3) LITOSFERA DE PERTO (bloco-diagrama, fora de escala)
// =====================================================================================================
function criarLitosfera() {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x0d1730);
  luzes(cena, 1.1);
  const Z = 3.2, X0 = -6.5, X1 = 6.5;
  const xs = []; for (let x = X0; x <= X1 + 1e-6; x += 0.1) xs.push(+x.toFixed(2));
  const ridge = 5.0;
  // perfis (y para cima; 0 = nível do mar)
  const relevo = (x) => { // superfície do continente
    if (x > -0.6) return null;
    const mont = 1.05 * Math.exp(-((x + 4.3) ** 2) / 0.45) * (1 + 0.18 * Math.sin(x * 9));
    return 0.18 + mont - 0.12 * suave(limitar((x + 2.0) / 1.4));
  };
  const fundo = (x) => { // fundo do mar
    if (x < -1.2) return null;
    const plat = -0.12 - 0.58 * suave(limitar((x + 1.1) / 1.4));
    const d = Math.abs(x - ridge);
    return x < 0.3 ? plat : -0.7 + 0.42 * Math.exp(-d * d / 1.3);
  };
  const sup = (x) => (x <= -0.6 ? relevo(x) : Math.min(relevo(x) ?? 9, fundo(x) ?? 9));
  const moho = (x) => { // base da crosta
    const cont = -1.45 - 1.25 * Math.exp(-((x + 4.3) ** 2) / 0.6);
    const oce = sup(x) - 0.3;
    const u = suave(limitar((x + 1.0) / 1.5));
    return cont * (1 - u) + oce * u;
  };
  const baseLit = (x) => { // base da litosfera
    const cont = -4.1;
    const idade = Math.abs(x - ridge);
    const oce = -0.55 - 2.6 * Math.sqrt(limitar(idade / 5.4));
    const u = suave(limitar((x + 1.4) / 2.2));
    return Math.min(cont * (1 - u) + oce * u, moho(x) - 0.14);
  };
  const Y_BASE = -6.6;
  function forma(topo, base, x0 = X0, x1 = X1) {
    const s = new THREE.Shape();
    const lx = xs.filter((x) => x >= x0 - 1e-6 && x <= x1 + 1e-6);
    lx.forEach((x, i) => (i ? s.lineTo(x, topo(x)) : s.moveTo(x, topo(x))));
    [...lx].reverse().forEach((x) => s.lineTo(x, base(x)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: Z, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, -Z / 2);
    return g;
  }
  const partes = [];
  function peca(id, geo, cor, extra = {}) {
    const m = new THREE.Mesh(geo, mat(cor, extra));
    m.userData.parte = id;
    cena.add(m); partes.push(m);
    return m;
  }
  peca("crosta_cont", forma((x) => relevo(x) ?? 0, moho, X0, -0.6), COR_CAMADA.crosta_cont);
  peca("crosta_cont", forma((x) => sup(x), moho, -0.6, 0.6), COR_CAMADA.crosta_cont);
  peca("crosta_oce", forma((x) => sup(x), moho, 0.6, X1), COR_CAMADA.crosta_oce);
  peca("solo", forma((x) => (relevo(x) ?? 0) + 0.07, (x) => relevo(x) ?? 0, X0, -0.7), 0x6fae4f);
  peca("manto_lit", forma(moho, baseLit), COR_CAMADA.litosfera);
  peca("astenosfera", forma(baseLit, () => Y_BASE), COR_CAMADA.astenosfera, { emissive: 0x552200, emissiveIntensity: 0.25 });
  // magma sob a dorsal
  const sMag = new THREE.Shape();
  sMag.moveTo(ridge - 0.55, baseLit(ridge - 0.55)); sMag.lineTo(ridge - 0.08, fundo(ridge) - 0.12);
  sMag.lineTo(ridge + 0.08, fundo(ridge) - 0.12); sMag.lineTo(ridge + 0.55, baseLit(ridge + 0.55)); sMag.closePath();
  const gMag = new THREE.ExtrudeGeometry(sMag, { depth: Z + 0.02, bevelEnabled: false }); gMag.translate(0, 0, -Z / 2 - 0.01);
  const magma = peca("magma", gMag, 0xff4a1a, { emissive: 0xff3300, emissiveIntensity: 0.8 });
  // água do oceano (transparente)
  const sAgua = new THREE.Shape();
  const xa = xs.filter((x) => x >= -1.2);
  sAgua.moveTo(-1.2, 0); xa.forEach((x) => sAgua.lineTo(x, 0)); [...xa].reverse().forEach((x) => sAgua.lineTo(x, Math.min(0, fundo(x))));
  const gAgua = new THREE.ExtrudeGeometry(sAgua, { depth: Z, bevelEnabled: false }); gAgua.translate(0, 0, -Z / 2);
  const agua = new THREE.Mesh(gAgua, new THREE.MeshStandardMaterial({ color: 0x2d7fd0, transparent: true, opacity: 0.55, roughness: 0.2 }));
  agua.userData.parte = "oceano"; cena.add(agua); partes.push(agua);
  // partículas da astenosfera: sobem sob a dorsal e correm por baixo da litosfera
  const nP = 70, geoP = new THREE.SphereGeometry(0.05, 6, 5);
  const bolinhas = new THREE.InstancedMesh(geoP, new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), nP);
  const pts = Array.from({ length: nP }, () => ({ s: rnd(), z: entre(-Z / 2 + 0.2, Z / 2 - 0.2), lado: rnd() < 0.5 ? -1 : 1, prof: entre(0.15, 0.9) }));
  pts.forEach((p) => (p.z = Z / 2 + 0.05));
  cena.add(bolinhas);
  const _m = new THREE.Matrix4();
  const caminhoP = (p, v) => { // sobe sob a dorsal e depois corre para os lados, por baixo da litosfera
    const s = p.s, yTopo = baseLit(ridge) - 0.3;
    if (s < 0.3) { const u = s / 0.3; v.set(ridge + p.lado * 0.25 * u, Y_BASE + 0.3 + (yTopo - Y_BASE - 0.3) * u, p.z); return true; }
    const u = (s - 0.3) / 0.7, x = ridge + p.lado * (0.25 + u * 11);
    if (x > X1 - 0.1 || x < X0 + 0.1) return false;
    v.set(x, Math.min(baseLit(x) - 0.3, yTopo) - p.prof * 1.1 - u * 0.6, p.z);
    return true;
  };
  // rótulos
  const L = (id, x, y, z = Z / 2 + 0.02, classe = "") => { const o = rotulo(R[id], V(x, y, z), classe); o.userData.chave = id; cena.add(o); return o; };
  const rots = [
    L("crosta_cont", -2.3, -0.65), L("crosta_oce", 2.5, fundo(2.5) - 0.15), L("moho", -1.9, moho(-1.9) - 0.12, Z / 2 + 0.02, "fraco"),
    L("manto_lit", -1.2, -2.9), L("astenosfera", 0.6, -5.4), L("oceano", 2.6, -0.3, Z / 2 + 0.02, "oceano"), L("raiz", -4.3, -2.35, Z / 2 + 0.02, "fraco"),
    L("montanha", -4.3, 1.55, 0), L("dorsal", ridge, 0.15, 0), L("magma", ridge, -1.0),
  ];
  const chave = rotulo("Litosfera", V(X0 - 0.35, -2.0, Z / 2), "grande");
  cena.add(chave);
  const alvo = rotulo(R.camada_alvo_ast, V(-3.5, -5.6, Z / 2 + 0.02), "alvo");
  alvo.element.classList.add("clicavel");
  alvo.element.addEventListener("click", () => irPara("conveccao"));
  cena.add(alvo);
  // chave (colchete) da litosfera
  const pChave = [V(X0 - 0.12, 0.2, Z / 2), V(X0 - 0.25, 0.2, Z / 2), V(X0 - 0.25, -4.1, Z / 2), V(X0 - 0.12, -4.1, Z / 2)];
  cena.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pChave), new THREE.LineBasicMaterial({ color: 0xffffff })));
  const linhaMoho = new THREE.Line(new THREE.BufferGeometry().setFromPoints(xs.map((x) => V(x, moho(x), Z / 2 + 0.01))),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.12, gapSize: 0.08 }));
  linhaMoho.computeLineDistances(); cena.add(linhaMoho);

  const _v = new THREE.Vector3();
  const N = {
    id: "litosfera", cena, cam: { pos: V(1.6, 1.8, 15.5), alvo: V(0, -2.4, 0), min: 5, max: 26 },
    clicaveis: partes,
    mostrarNomes() { rots.forEach((o) => (o.visible = estado.nomes)); chave.visible = estado.nomes; },
    animar(dt, t) {
      magma.material.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 3);
      pts.forEach((p, i) => {
        p.s += dt * 0.035;
        if (p.s > 1 || !caminhoP(p, _v)) { p.s = 0; p.lado = rnd() < 0.5 ? -1 : 1; caminhoP(p, _v); }
        _m.makeTranslation(_v.x, _v.y, _v.z); bolinhas.setMatrixAt(i, _m);
      });
      bolinhas.instanceMatrix.needsUpdate = true;
    },
    clique(hit) {
      let id = hit.object.userData.parte;
      if (id === "solo") id = "crosta_cont";
      if (id === "magma") return avisar("Magma: o manto quente sobe sob a dorsal, derrete em parte e forma crosta oceânica nova.");
      if (id === "oceano") return avisar("Oceano: a água cobre a crosta oceânica. A profundidade média é de uns 4 km.");
      if (id === "astenosfera" && estado.parteLit === "astenosfera") return irPara("conveccao");
      const mapa = { crosta_cont: "crosta_cont", crosta_oce: "crosta_oce", manto_lit: "litosfera", astenosfera: "astenosfera" };
      estado.parteLit = mapa[id];
      partes.forEach((m) => { if (m.material.emissive && m.userData.parte !== "magma" && m.userData.parte !== "astenosfera") m.material.emissive.setHex(m.userData.parte === id ? 0x553300 : 0x000000); });
      montarPainel();
      avisar(CAMADA[estado.parteLit].nome + (id === "astenosfera" ? " · clique de novo para ver a convecção" : ""));
    },
  };
  return N;
}

// =====================================================================================================
// 4) CONVECÇÃO DO MANTO (corte do Pacífico à África, ao longo de ~25° S)
// =====================================================================================================
// Distâncias em km ao longo do corte. A dorsal mesoatlântica fica em x = 0.
const CV = {
  xmin: -10500, xmax: 6000, EPR: -9300, LARG_SA: 2600, LARG_AF: 2100, ATL_HOJE: 6000, ABRE: 132,
  vNazca: 62, // km por milhão de anos (6,2 cm por ano) para cada lado da dorsal do Pacífico
};
CV.vAtl = CV.ATL_HOJE / 2 / CV.ABRE; // meia-taxa de abertura do Atlântico Sul (~2,3 cm/ano)
function geometriaConv(t) {
  const tt = Math.min(t, TCONV);
  const W = tt >= CV.ABRE ? 0 : CV.ATL_HOJE * (1 - tt / CV.ABRE);
  const saL = -W / 2 - CV.LARG_SA, saR = -W / 2, afL = W / 2, afR = W / 2 + CV.LARG_AF;
  const subida = limitar((TCONV - tt) / TCONV); // crescimento dos Andes
  return { t: tt, W, fossa: saL, saL, saR, afL, afR, subida };
}
// inversões do campo magnético (simplificadas: na realidade houve centenas)
const INVERSOES = (() => { const v = [0]; let s = 0; semente = 777; while (s < 400) { s += entre(3.5, 9); v.push(s); } return v; })();
const polaridade = (idadeAbs) => { let i = 0; while (i < INVERSOES.length && INVERSOES[i] < idadeAbs) i++; return (i % 2) === 1; }; // true = normal (como hoje)
// profundidade (km) -> fração da altura do corte (topo exagerado)
const HD = 2900;
const corFaixa = (normal) => (normal ? "#2f3440" : "#9aa3b5");
const gProf = (d) => Math.pow(limitar(d / HD), 0.6);

function criarConveccao() {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x0d1730);
  luzes(cena, 1.1);
  const L = (CV.xmax - CV.xmin) / 1000, HM = 3.6, HN = 0.45, Z = 3.0; // tamanho do bloco
  const xw = (xkm) => (xkm - CV.xmin) / 1000 - L / 2;
  const yw = (d) => -gProf(d) * HM;
  // face da frente (corte) e face de cima (superfície), desenhadas em telas
  const FW = celular ? 1400 : 2048, FH = Math.round(FW * (HM + HN) / L);
  const telaF = novaTela(FW, FH), cF = telaF.getContext("2d");
  const texF = new THREE.CanvasTexture(telaF); texF.colorSpace = THREE.SRGBColorSpace;
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(L, HM + HN), new THREE.MeshBasicMaterial({ map: texF }));
  frente.position.set(0, -(HM + HN) / 2, Z / 2);
  cena.add(frente);
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(L - 0.02, HM + HN - 0.06, Z - 0.08), [
    mat(0x7a3a1c), mat(0x7a3a1c), mat(0x1d4f86), mat(0x5a2a12), mat(0x7a3a1c), mat(0x7a3a1c)]);
  corpo.position.set(0, -(HM + HN) / 2 - 0.03, -0.04);
  cena.add(corpo);
  const TWc = FW, THc = Math.round(FW * Z / L);
  const telaS = novaTela(TWc, THc), cS = telaS.getContext("2d");
  const texS = new THREE.CanvasTexture(telaS); texS.colorSpace = THREE.SRGBColorSpace;
  const topo = new THREE.Mesh(new THREE.PlaneGeometry(L, Z), new THREE.MeshStandardMaterial({ map: texS, roughness: 0.6 }));
  topo.rotation.x = -PI / 2; topo.position.y = 0.001;
  cena.add(topo);
  // continentes elevados, Andes e vulcões
  const H_CONT = 0.12;
  const matSA = [mat(0x8a5a3a), mat(0x8a5a3a), mat(0x6fae4f), mat(0x8a5a3a), mat(0x8a5a3a), mat(0x8a5a3a)];
  const matAF = [mat(0x9a6a3a), mat(0x9a6a3a), mat(0xc9a35a), mat(0x9a6a3a), mat(0x9a6a3a), mat(0x9a6a3a)];
  const blocoSA = new THREE.Mesh(new THREE.BoxGeometry(1, H_CONT, Z), matSA);
  const blocoAF = new THREE.Mesh(new THREE.BoxGeometry(1, H_CONT, Z), matAF);
  cena.add(blocoSA, blocoAF);
  const basaltoSA = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, Z * 0.7), mat(0x3a3a44));
  const basaltoAF = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, Z * 0.5), mat(0x3a3a44));
  cena.add(basaltoSA, basaltoAF);
  const andes = new THREE.Group(); cena.add(andes);
  const matRocha = mat(0x8c7b6b), matNeve = mat(0xf2f5f8);
  for (let i = 0; i < 9; i++) {
    const h = entre(0.5, 0.85), r = entre(0.18, 0.28);
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), matRocha);
    const neve = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, h * 0.35, 5), matNeve);
    neve.position.y = h * 0.33; m.add(neve);
    m.position.set(entre(0.08, 0.42), h / 2, -Z / 2 + 0.2 + (i / 8) * (Z - 0.4) + entre(-0.08, 0.08));
    m.userData.h = h; andes.add(m);
  }
  const vulcoes = [];
  for (const z of [-0.9, 0.2, 1.05]) {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), mat(0x5a4a40));
    cone.position.y = 0.21; g.add(cone);
    const lava = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.03, 6), new THREE.MeshBasicMaterial({ color: 0xff5a1a }));
    lava.position.y = 0.43; g.add(lava);
    g.position.set(0.55, 0, z); andes.add(g); vulcoes.push(g);
  }
  const fumaca = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshStandardMaterial({ color: 0xb9b9b9, transparent: true, opacity: 0.6 }), 30);
  cena.add(fumaca);
  const puffs = Array.from({ length: 30 }, (_, i) => ({ v: i % 3, s: rnd() }));

  // partículas do manto (advectadas pelas células de convecção)
  const NP = celular ? 220 : 380;
  const part = Array.from({ length: NP }, () => ({ x: entre(CV.xmin, CV.xmax), z: entre(0.03, 0.9), idade: rnd() * 10 }));
  const bolhas = Array.from({ length: 40 }, () => ({ qual: rnd() < 0.5 ? 0 : rnd() < 0.5 ? 1 : 2, s: rnd(), dx: entre(-1, 1) }));

  // rótulos (posições atualizadas a cada quadro)
  const ZF = Z / 2 + 0.02;
  const rot = {};
  const add = (id, classe = "") => { rot[id] = rotulo(R[id], V(), classe); cena.add(rot[id]); return rot[id]; };
  ["dorsal_atl", "dorsal_pac", "fossa", "andes", "am_sul", "africa", "atlantico", "pacifico", "nazca", "placa_mergulha",
    "litosfera", "astenosfera", "manto_sup", "manto_inf", "nucleo_ext", "sobe", "desce", "pluma", "serra_geral", "rifte", "vulcoes", "crosta_cont", "crosta_oce"].forEach((id) => {
    const classe = ["atlantico", "pacifico"].includes(id) ? "oceano" : ["sobe", "desce", "manto_sup", "manto_inf", "astenosfera", "litosfera"].includes(id) ? "fraco" : "";
    add(id, classe);
  });

  // ---------- campo de convecção: células entre fronteiras (sobe / desce)
  function celulas(G) {
    // fronteiras: [x, tipo] tipo +1 = sobe, -1 = desce
    const f = [[CV.xmin, -1], [CV.EPR, 1], [G.fossa, -1], [0, 1], [CV.xmax, -1]];
    const cel = [];
    for (let i = 0; i < f.length - 1; i++) cel.push({ a: f[i][0], b: f[i + 1][0], sobeEsq: f[i][1] > 0 });
    return cel;
  }
  // velocidade (u horizontal em km/"passo", w vertical em fração da altura) num ponto x (km), z (0 = base do manto, 1 = topo)
  function vel(cel, x, z) {
    for (const c of cel) if (x >= c.a && x <= c.b) {
      const w = c.b - c.a, X = (x - c.a) / w;
      const A = c.sobeEsq ? -1 : 1;
      // ψ = A·sen(πX)·sen(πz) nas coordenadas normalizadas da célula: dX/dt = ∂ψ/∂z, dz/dt = -∂ψ/∂X
      return [w * A * PI * Math.sin(PI * X) * Math.cos(PI * z), -A * PI * Math.cos(PI * X) * Math.sin(PI * z)];
    }
    return [0, 0];
  }

  // ---------- desenho da face da frente
  const kx = FW / (CV.xmax - CV.xmin);
  const px = (xkm) => (xkm - CV.xmin) * kx;
  const py = (d) => gProf(d) * HM / (HM + HN) * FH;
  const yManto = HM / (HM + HN) * FH;
  function tipoEm(G, x) { // o que há na superfície em x
    if (x < CV.EPR) return { tipo: "oce", idade: (CV.EPR - x) / CV.vNazca, placa: "pac" };
    if (x < G.fossa) return { tipo: "oce", idade: (x - CV.EPR) / CV.vNazca, placa: "nazca" };
    if (x < G.saR) return { tipo: "cont", placa: "sa" };
    if (x < G.afL) return { tipo: "oce", idade: Math.abs(x) / CV.vAtl, placa: x < 0 ? "atlW" : "atlE" };
    if (x < G.afR) return { tipo: "cont", placa: "af" };
    return { tipo: "oce", idade: 70 + (x - G.afR) / 30, placa: "ind" };
  }
  function desenharFrente(G, tempo) {
    const c = cF;
    // manto: degradê vertical (mais quente embaixo)
    let g = c.createLinearGradient(0, 0, 0, yManto);
    g.addColorStop(0, "#f6b25a"); g.addColorStop(0.18, "#ec8a3d"); g.addColorStop(0.6, "#cc5a2c"); g.addColorStop(1, "#a63a1e");
    c.fillStyle = g; c.fillRect(0, 0, FW, yManto);
    // regiões quentes (sobem) e frias (descem)
    const cel = celulas(G);
    const subidas = [CV.EPR, 0], descidas = [G.fossa, CV.xmin, CV.xmax];
    for (const x of subidas) {
      const rg = c.createLinearGradient(px(x) - 90, 0, px(x) + 90, 0);
      rg.addColorStop(0, "rgba(255,210,90,0)"); rg.addColorStop(0.5, "rgba(255,230,120,.45)"); rg.addColorStop(1, "rgba(255,210,90,0)");
      c.fillStyle = rg; c.fillRect(px(x) - 90, py(80), 180, yManto - py(80));
    }
    for (const x of descidas) {
      const rg = c.createLinearGradient(px(x) - 80, 0, px(x) + 80, 0);
      rg.addColorStop(0, "rgba(60,90,160,0)"); rg.addColorStop(0.5, "rgba(70,100,170,.35)"); rg.addColorStop(1, "rgba(60,90,160,0)");
      c.fillStyle = rg; c.fillRect(px(x) - 80, py(150), 160, yManto - py(150));
    }
    // pluma quente sob o futuro rifte (perto de 133 milhões de anos)
    const plum = Math.exp(-(((G.t - 134) / 7) ** 2));
    if (plum > 0.02) {
      const rg = c.createRadialGradient(px(0), yManto * 0.75, 10, px(0), yManto * 0.45, yManto * 0.6);
      rg.addColorStop(0, `rgba(255,250,170,${0.75 * plum})`); rg.addColorStop(1, "rgba(255,200,80,0)");
      c.fillStyle = rg; c.beginPath(); c.ellipse(px(0), yManto * 0.5, 120, yManto * 0.55, 0, 0, 2 * PI); c.fill();
    }
    // linhas de 350 e 660 km
    c.setLineDash([12, 8]); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 2;
    for (const d of [660]) { c.beginPath(); c.moveTo(0, py(d)); c.lineTo(FW, py(d)); c.stroke(); }
    c.setLineDash([]);
    // núcleo externo
    g = c.createLinearGradient(0, yManto, 0, FH);
    g.addColorStop(0, "#ffc445"); g.addColorStop(1, "#ff9a1f");
    c.fillStyle = g; c.fillRect(0, yManto, FW, FH - yManto);
    c.strokeStyle = "rgba(255,255,255,.6)"; c.setLineDash([10, 7]); c.beginPath(); c.moveTo(0, yManto); c.lineTo(FW, yManto); c.stroke(); c.setLineDash([]);
    // correntes de convecção (setas ovais)
    if (estado.correntes) {
      c.strokeStyle = "rgba(255,255,255,.55)"; c.fillStyle = "rgba(255,255,255,.55)"; c.lineWidth = 3;
      for (const ce of cel) {
        const cx = px((ce.a + ce.b) / 2), rx = (px(ce.b) - px(ce.a)) * 0.36;
        const top = py(260), bot = yManto - 18, cy = (top + bot) / 2, ry = (bot - top) * 0.36;
        if (rx < 20) continue;
        const sentido = ce.sobeEsq ? 1 : -1; // 1: em cima vai para a direita
        const fase = (tempo * 0.15 * sentido) % (2 * PI);
        c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 2 * PI); c.stroke();
        for (let k = 0; k < 4; k++) {
          const a = fase + k * PI / 2;
          const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
          const tx = -rx * Math.sin(a) * sentido, ty = ry * Math.cos(a) * sentido; // tangente (sentido 1: em cima vai para a direita)
          const n = Math.hypot(tx, ty) || 1;
          const ang = Math.atan2(ty / n, tx / n);
          c.beginPath(); c.moveTo(x + 12 * Math.cos(ang), y + 12 * Math.sin(ang));
          c.lineTo(x - 9 * Math.cos(ang - 0.6), y - 9 * Math.sin(ang - 0.6)); c.lineTo(x - 9 * Math.cos(ang + 0.6), y - 9 * Math.sin(ang + 0.6)); c.closePath(); c.fill();
        }
      }
    }
    // partículas
    if (estado.particulas) {
      for (const p of part) {
        const [, w] = vel(cel, p.x, p.z);
        c.fillStyle = w > 0.9 ? "rgba(255,245,170,.95)" : w < -0.9 ? "rgba(120,160,230,.95)" : "rgba(255,225,190,.7)";
        c.beginPath(); c.arc(px(p.x), yManto * (1 - p.z), 2.6, 0, 2 * PI); c.fill();
      }
    }
    // placa que mergulha (subducção sob a América do Sul)
    const espLit = (idade) => Math.min(95, 10 * Math.sqrt(Math.max(idade, 0.3))) + 8;
    const idadeFossa = (G.fossa - CV.EPR) / CV.vNazca;
    const T = espLit(idadeFossa);
    const lajeC = []; let lx = G.fossa, ld = 6;
    for (let s = 0; s <= 1500; s += 20) {
      const dip = (14 + 34 * limitar(s / 550)) * RAD;
      lajeC.push([lx, ld, s]);
      lx += 20 * Math.cos(dip); ld += 20 * Math.sin(dip);
    }
    for (let i = 0; i < lajeC.length - 1; i++) {
      const [x0, d0, s0] = lajeC[i], [x1, d1] = lajeC[i + 1];
      const fade = 1 - limitar((s0 - 1050) / 450);
      c.globalAlpha = fade;
      c.fillStyle = "#6f7f55";
      c.beginPath(); c.moveTo(px(x0), py(d0)); c.lineTo(px(x1), py(d1)); c.lineTo(px(x1 - T * 0.5), py(d1 + T)); c.lineTo(px(x0 - T * 0.5), py(d0 + T)); c.closePath(); c.fill();
      const idadeAbs = G.t + idadeFossa + s0 / CV.vNazca;
      c.fillStyle = estado.faixas ? corFaixa(polaridade(idadeAbs)) : "#3d4250";
      c.beginPath(); c.moveTo(px(x0), py(d0)); c.lineTo(px(x1), py(d1)); c.lineTo(px(x1 - 4), py(d1 + 9)); c.lineTo(px(x0 - 4), py(d0 + 9)); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
    // litosfera, crosta e água, coluna por coluna
    const passo = 2;
    for (let i = 0; i < FW; i += passo) {
      const x = CV.xmin + (i + 1) / kx;
      const s = tipoEm(G, x);
      if (s.tipo === "oce") {
        const fundo = 2.6 + 0.33 * Math.sqrt(s.idade);
        const lit = espLit(s.idade);
        c.fillStyle = "#2a6fbf"; c.fillRect(i, 0, passo, py(fundo));
        const normal = polaridade(G.t + s.idade);
        c.fillStyle = estado.faixas ? corFaixa(normal) : "#3d4250"; c.fillRect(i, py(fundo), passo, py(fundo + 7) - py(fundo));
        c.fillStyle = "#6f7f55"; c.fillRect(i, py(fundo + 7), passo, py(fundo + lit) - py(fundo + 7));
      } else {
        let crosta = 36;
        if (s.placa === "sa") { const u = (x - G.fossa) / 600; if (u < 1.4) crosta += 32 * G.subida * Math.exp(-((u - 0.45) ** 2) / 0.12); }
        // rifte: crosta afinada perto do centro antes do Atlântico abrir
        if (G.W < 300) crosta -= 14 * Math.exp(-(x * x) / (2 * 180 * 180)) * limitar((TCONV - G.t) / 8);
        c.fillStyle = "#c98f6b"; c.fillRect(i, 0, passo, py(crosta));
        c.fillStyle = "#8e7c55"; c.fillRect(i, py(crosta), passo, py(165) - py(crosta));
      }
    }
    // magma: dorsais e arco vulcânico
    const magmaSob = (x, larg) => {
      const rg = c.createLinearGradient(0, py(120), 0, py(4));
      rg.addColorStop(0, "rgba(255,80,20,0)"); rg.addColorStop(1, "rgba(255,90,20,.95)");
      c.fillStyle = rg; c.beginPath(); c.moveTo(px(x) - larg, py(120)); c.lineTo(px(x) - 3, py(3)); c.lineTo(px(x) + 3, py(3)); c.lineTo(px(x) + larg, py(120)); c.closePath(); c.fill();
    };
    magmaSob(CV.EPR, 26);
    if (G.W > 1) magmaSob(0, 22);
    for (const b of bolhas) {
      let x, d;
      if (b.qual === 0) { x = CV.EPR + b.dx * 8; d = 110 - 105 * b.s; }
      else if (b.qual === 1) { if (G.W < 1 && plum < 0.05) continue; x = b.dx * 8; d = 110 - 105 * b.s; }
      else { x = G.fossa + 330 + b.dx * 40; d = 120 - 112 * b.s; }
      c.fillStyle = `rgba(255,${120 + 80 * b.s | 0},40,.9)`;
      c.beginPath(); c.arc(px(x), py(d), 3.2, 0, 2 * PI); c.fill();
    }
    // lava da Serra Geral / Etendeka
    if (G.t < 136) {
      const a = limitar((136 - G.t) / 4);
      c.fillStyle = `rgba(60,60,70,${a})`;
      c.fillRect(px(G.saR - 1100), 0, px(G.saR - 250) - px(G.saR - 1100), py(3));
      c.fillRect(px(G.afL + 200), 0, px(G.afL + 600) - px(G.afL + 200), py(3));
    }
  }
  // ---------- face de cima
  function desenharTopo(G, tempo) {
    const c = cS;
    const kxs = TWc / (CV.xmax - CV.xmin);
    for (let i = 0; i < TWc; i += 2) {
      const x = CV.xmin + (i + 1) / kxs;
      const s = tipoEm(G, x);
      if (s.tipo === "oce") {
        const normal = polaridade(G.t + s.idade);
        c.fillStyle = estado.faixas ? (normal ? "#1d4f8f" : "#5f9be0") : `hsl(212, 60%, ${46 - Math.min(20, s.idade / 6)}%)`;
      } else c.fillStyle = s.placa === "sa" ? "#6fae4f" : "#c9a35a";
      c.fillRect(i, 0, 2, THc);
    }
    // dorsais e fossa
    const linha = (x, cor, larg) => { c.fillStyle = cor; c.fillRect(x * kxs - larg / 2, 0, larg, THc); };
    linha(CV.EPR - CV.xmin, "#ffd76a", 5);
    if (G.W > 1) linha(-CV.xmin, "#ffd76a", 5);
    linha(G.fossa - CV.xmin, "#0b1d3a", 6);
    // setas do movimento das placas
    c.fillStyle = "rgba(255,255,255,.85)";
    const setas = [[(CV.xmin + CV.EPR) / 2, -1], [(CV.EPR + G.fossa) / 2, 1]];
    if (G.W > 900) setas.push([-G.W / 4, -1], [G.W / 4, 1]);
    for (const [x, dir] of setas) {
      const X = (x - CV.xmin) * kxs;
      for (let k = -1; k <= 1; k++) {
        const y = THc / 2 + k * THc * 0.3, d = 26;
        c.beginPath(); c.moveTo(X + dir * d, y); c.lineTo(X - dir * d * 0.6, y - 14); c.lineTo(X - dir * d * 0.2, y); c.lineTo(X - dir * d * 0.6, y + 14); c.closePath(); c.fill();
      }
    }
  }
  // ---------- posicionar objetos 3D e rótulos
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function posicionar(G) {
    const largSA = (G.saR - G.saL) / 1000, largAF = (G.afR - G.afL) / 1000;
    blocoSA.scale.x = largSA; blocoSA.position.set(xw((G.saL + G.saR) / 2), H_CONT / 2, 0);
    blocoAF.scale.x = largAF; blocoAF.position.set(xw((G.afL + G.afR) / 2), H_CONT / 2, 0);
    const lava = G.t < 136 ? limitar((136 - G.t) / 4) : 0;
    basaltoSA.visible = basaltoAF.visible = lava > 0.05;
    basaltoSA.position.set(xw(G.saR - 700), H_CONT + 0.01, -0.1);
    basaltoAF.position.set(xw(G.afL + 400), H_CONT + 0.01, 0.2);
    andes.position.set(xw(G.fossa), H_CONT, 0);
    andes.children.forEach((m) => { if (m.userData.h) { m.scale.y = 0.25 + 0.75 * G.subida; m.position.y = (m.userData.h * m.scale.y) / 2; } });
    vulcoes.forEach((v) => v.scale.setScalar(0.6 + 0.4 * G.subida));
    const P = (id, x, y, z = ZF, mostrar = true) => { rot[id].position.set(x, y, z); rot[id].userData.ligado = mostrar; };
    const sup = 0.02;
    P("dorsal_pac", xw(CV.EPR), 0.35, 0);
    P("dorsal_atl", xw(0), 0.35, -0.9, G.W > 400);
    P("rifte", xw(0), 0.95, 0, G.W <= 400 && G.t < 138);
    P("fossa", xw(G.fossa) - 1.05, -0.16, Z / 2 + 0.05);
    P("andes", xw(G.fossa + 300), 1.05 * (0.4 + 0.6 * G.subida) + 0.2, 0);
    P("vulcoes", xw(G.fossa + 420), 0.62, 1.45, G.subida > 0.2);
    P("am_sul", xw((G.saL + G.saR) / 2 + 150), H_CONT + 0.12, -0.9);
    P("africa", xw((G.afL + G.afR) / 2), H_CONT + 0.12, -0.9);
    P("atlantico", xw(-G.W / 4), sup + 0.05, 1.0, G.W > 1500);
    P("pacifico", xw((CV.xmin + CV.EPR) / 2), sup + 0.05, -0.9);
    P("nazca", xw((CV.EPR + G.fossa) / 2 - 300), sup + 0.05, 0.4);
    P("placa_mergulha", xw(G.fossa + 650), yw(330));
    P("litosfera", xw(CV.xmin) + 0.75, yw(55));
    P("astenosfera", xw(CV.xmin) + 0.85, yw(230));
    P("manto_sup", xw(CV.xmin) + 0.95, yw(470));
    P("manto_inf", xw(CV.xmin) + 0.95, yw(2100));
    P("nucleo_ext", 0, -HM - HN / 2);
    P("sobe", xw(0) + 0.05, yw(1300), ZF, true);
    P("desce", xw(G.fossa) + 0.6, yw(1700), ZF, true);
    P("pluma", xw(0), yw(700), ZF, Math.exp(-(((G.t - 134) / 7) ** 2)) > 0.3);
    P("serra_geral", xw(G.saR - 700), H_CONT + 0.25, 0.2, lava > 0.5 && G.t > 110);
    P("crosta_cont", xw(G.saL + 1950), yw(18));
    P("crosta_oce", xw(-G.W / 2 + 700), yw(6), ZF, G.W > 2500);
    if (G.W < 1500) { rot.sobe.position.set(xw(CV.EPR) + 0.1, yw(900), ZF); }
    for (const o of Object.values(rot)) o.visible = estado.nomes && o.userData.ligado;
  }
  let ultT = -1, sujo = true;
  const N = {
    id: "conveccao", cena, cam: { pos: V(0.6, 4.6, 16.8), alvo: V(0, -1.5, 0), min: 4, max: 28 },
    clicaveis: [frente],
    marcarSujo() { sujo = true; },
    geo: () => geometriaConv(estado.t),
    animar(dt, tempo) {
      const G = geometriaConv(estado.t);
      const cel = celulas(G);
      // as partículas andam pelas células; se saírem, renascem
      if (estado.particulas) for (const p of part) {
        const [u, w] = vel(cel, p.x, p.z);
        p.x += u * dt * 0.06; p.z += w * dt * 0.06;
        p.idade -= dt;
        if (p.z < 0.02 || p.z > 0.93 || p.x < CV.xmin || p.x > CV.xmax || p.idade < 0) { p.x = entre(CV.xmin, CV.xmax); p.z = entre(0.05, 0.88); p.idade = entre(6, 14); }
      }
      for (const b of bolhas) { b.s += dt * 0.25; if (b.s > 1) { b.s = 0; b.dx = entre(-1, 1); } }
      desenharFrente(G, tempo); texF.needsUpdate = true;
      if (sujo || Math.abs(G.t - ultT) > 0.01) { desenharTopo(G, tempo); texS.needsUpdate = true; ultT = G.t; sujo = false; }
      posicionar(G);
      // fumaça dos vulcões
      puffs.forEach((pf, i) => {
        pf.s += dt * 0.3; if (pf.s > 1) pf.s = 0;
        const v = vulcoes[pf.v];
        v.getWorldPosition(_p);
        const ativo = G.subida > 0.2;
        _p.y += 0.45 * v.scale.y + pf.s * 0.9; _p.x += pf.s * 0.25;
        _s.setScalar(ativo ? 0.6 + pf.s * 1.6 : 0.0001);
        _m.compose(_p, _q, _s); fumaca.setMatrixAt(i, _m);
      });
      fumaca.instanceMatrix.needsUpdate = true;
    },
    clique(hit) {
      const uv = hit.uv;
      const x = CV.xmin + uv.x * (CV.xmax - CV.xmin);
      const yFrac = (1 - uv.y) * (HM + HN) / HM;
      const G = geometriaConv(estado.t);
      if (yFrac > 1) return avisar(CAMADA.nucleo_ext.nome + ": ferro e níquel líquidos, a uns 4.000 °C.");
      const d = Math.pow(yFrac, 1 / 0.6) * HD;
      const s = tipoEm(G, x);
      if (s.tipo === "oce" && d < 2.6 + 0.33 * Math.sqrt(s.idade)) return avisar("Oceano");
      if (s.tipo === "oce" && d < 12) return avisar(`Crosta oceânica com cerca de ${Math.round(s.idade)} milhões de anos` + (estado.faixas ? (polaridade(G.t + s.idade) ? " · faixa normal (como hoje)" : " · faixa invertida") : ""));
      if (s.tipo === "cont" && d < 40) return avisar("Crosta continental" + (s.placa === "sa" ? " da América do Sul" : " da África"));
      if (d < 120) return avisar("Litosfera: crosta + topo do manto, rígida.");
      if (d < 350) return avisar("Astenosfera: rocha sólida, mas plástica, que flui devagar.");
      if (d < 660) return avisar("Manto superior");
      return avisar("Manto inferior: sólido, mas flui alguns centímetros por ano.");
    },
  };
  return N;
}

// =====================================================================================================
// INTERFACE
// =====================================================================================================
const NIVEIS = {};
for (const N of [criarTerra(), criarCamadas(), criarLitosfera(), criarConveccao()]) NIVEIS[N.id] = N;
const ORDEM = CFG.niveis.map((n) => n.id);
let atual = null;

function avisar(texto) {
  const a = $("aviso");
  a.textContent = texto;
  a.classList.add("on");
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => a.classList.remove("on"), 3200);
}

// ---------- tempo
function periodoDe(t) { return CFG.periodos.find((p) => t <= p.inicio && t >= p.fim) || CFG.periodos[0]; }
function textoIdade(t) {
  const tr = Math.round(t);
  if (tr === 0) return "Hoje";
  return `${tr} milhões de anos atrás`;
}
function marcoDe(t) {
  let m = null, dm = 6;
  for (const x of CFG.marcos_tempo) { const d = Math.abs(x.t - t); if (d <= dm) { dm = d; m = x; } }
  return m;
}
function definirTempo(t, deUsuario = false) {
  const lim = atual && atual.id === "conveccao" ? TCONV : TMAX;
  estado.t = limitar(t, 0, lim);
  if (estado.t > 0.5 && estado.encaixe > 0) { estado.encaixe = 0; estado.encaixeAlvo = 0; }
  $("tempo").value = Math.round(lim - estado.t);
  $("tempo").max = lim;
  $("tempoV").textContent = Math.round(estado.t) === 0 ? "hoje" : `${Math.round(estado.t)} mi`;
  NIVEIS.terra.marcarSujo();
  NIVEIS.conveccao.marcarSujo();
  atualizarRelogio();
  if (deUsuario) escreverEndereco();
}
function atualizarRelogio() {
  const mostra = atual && (atual.id === "terra" || atual.id === "conveccao");
  $("relogio").hidden = $("regua").hidden = !mostra;
  if (!mostra) return;
  const p = periodoDe(estado.t);
  $("idade").innerHTML = `${textoIdade(estado.t)}<small>${estado.t < 0.5 ? "Quaternário · Era Cenozoica" : `${p.nome} · Era ${p.era}`}</small>`;
  const m = marcoDe(estado.t);
  $("marco").textContent = m ? m.texto : "";
  const lim = atual.id === "conveccao" ? TCONV : TMAX;
  $("cursorRegua").style.left = (100 * (TMAX - estado.t) / TMAX) + "%";
  $("foraRegua").style.width = (100 * (TMAX - lim) / TMAX) + "%";
}
function montarRegua() {
  const r = $("regua");
  const per = CFG.periodos.map((p) => ({ ...p, a: Math.min(p.inicio, TMAX), b: p.fim })).filter((p) => p.a > p.b);
  const eras = [];
  for (const p of per) { const u = eras[eras.length - 1]; if (u && u.nome === p.era) u.b = p.b; else eras.push({ nome: p.era, a: p.a, b: p.b }); }
  r.innerHTML = `<div class="eras">${eras.map((e) => `<div style="width:${100 * (e.a - e.b) / TMAX}%">${e.nome}</div>`).join("")}</div>
    <div class="pers">${per.map((p) => `<div style="width:${100 * (p.a - p.b) / TMAX}%;background:${p.cor}" title="${p.nome}: de ${p.inicio} a ${p.fim} milhões de anos">${(p.a - p.b) > 18 ? p.nome : ""}</div>`).join("")}</div>
    <div class="escala"><span>300 milhões de anos</span><span>200</span><span>100</span><span>hoje</span></div>
    <div class="fora" id="foraRegua"></div><div class="cursor" id="cursorRegua"></div>`;
  let arrastando = false;
  const ir = (ev) => { const b = r.getBoundingClientRect(); definirTempo(TMAX * (1 - limitar((ev.clientX - b.left) / b.width)), true); };
  r.addEventListener("pointerdown", (ev) => { arrastando = true; r.setPointerCapture(ev.pointerId); pararAnimacao(); ir(ev); });
  r.addEventListener("pointermove", (ev) => { if (arrastando) ir(ev); });
  r.addEventListener("pointerup", () => { arrastando = false; });
}
montarRegua();
$("tempo").addEventListener("input", () => { pararAnimacao(); definirTempo(+$("tempo").max - +$("tempo").value, true); });
function pararAnimacao() { estado.tocando = false; estado.alvoT = null; $("play").textContent = "▶ Animar"; }
$("play").addEventListener("click", () => {
  if (estado.tocando) return pararAnimacao();
  const lim = atual.id === "conveccao" ? TCONV : TMAX;
  if (estado.t < 0.5) definirTempo(lim);
  estado.tocando = true; estado.alvoT = 0;
  $("play").textContent = "⏸ Pausar";
});

// ---------- interruptores
const liga = (id, chave, depois) => $(id).addEventListener("change", (e) => { estado[chave] = e.target.checked; depois && depois(); escreverEndereco(); });
const sujaTerra = () => { NIVEIS.terra.marcarSujo(); if (atual.id === "terra") montarPainel(); };
liga("vFosseis", "fosseis", sujaTerra);
liga("vGeleiras", "geleiras", () => { sujaTerra(); if (estado.geleiras) avisar(CFG.evidencias.geleiras.nome + ": volte para 300 milhões de anos"); });
liga("vMontanhas", "montanhas", sujaTerra);
liga("vCarvao", "carvao", sujaTerra);
liga("vCores", "cores", sujaTerra);
liga("vCampinas", "campinas", sujaTerra);
liga("vAumentar", "aumentar", () => NIVEIS.camadas.redesenhar());
liga("vCorrentes", "correntes");
liga("vParticulas", "particulas");
liga("vFaixas", "faixas", () => { NIVEIS.conveccao.marcarSujo(); if (atual.id === "conveccao") montarPainel(); });
liga("vNomes", "nomes", aplicarNomes);
liga("vGirar", "girar");
liga("vDetalhes", "detalhes", () => { montarPainel(); aplicarNomes(); });
function aplicarNomes() {
  NIVEIS.terra.marcarSujo();
  NIVEIS.camadas.mostrarNomes();
  NIVEIS.litosfera.mostrarNomes();
}
function encaixar(ligar) {
  if (ligar && estado.t > 0.5) definirTempo(0);
  pararAnimacao();
  estado.encaixeAlvo = ligar ? 1 : 0;
  $("bEncaixe").textContent = ligar ? "↔ Separar" : "🧩 Encaixar";
  if (ligar) { focarGlobo(-15, -12); avisar("Encaixando a América do Sul na África..."); }
}
$("bEncaixe").addEventListener("click", () => encaixar(estado.encaixeAlvo < 0.5));
function mudarCheck(id, chave, valor) { $(id).checked = valor; estado[chave] = valor; }

// ---------- trilha e painel
function montarTrilha() {
  const t = $("trilha");
  t.innerHTML = "";
  CFG.niveis.forEach((n, i) => {
    if (i) { const s = document.createElement("i"); s.textContent = "›"; t.appendChild(s); }
    const b = document.createElement("button");
    b.textContent = n.nome;
    if (atual && n.id === atual.id) b.classList.add("atual");
    b.addEventListener("click", () => { if (n.id !== atual.id && !tour.ativo) irPara(n.id); });
    t.appendChild(b);
  });
}
const DESENHOS = {
  mesosaurus: `<svg viewBox="0 0 120 60"><path d="M6 34 C 20 30, 34 27, 48 28 C 62 26, 72 24, 80 26 L 112 22 L 113 25 L 82 31 C 74 35, 62 38, 48 37 C 34 38, 20 38, 6 34 Z" fill="var(--c)"/>
    <path d="M40 36 l-6 10 M58 36 l-4 10 M44 30 l-8 -8 M62 28 l-4 -8" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/><circle cx="84" cy="27" r="1.6" fill="#fff"/>
    <path d="M86 29 l24 -4" stroke="#fff" stroke-width=".8"/></svg>`,
  glossopteris: `<svg viewBox="0 0 120 60"><path d="M14 52 C 22 30, 48 8, 98 6 C 92 30, 66 48, 22 54 Z" fill="var(--c)"/>
    <path d="M10 56 L 96 8" stroke="#fff" stroke-width="2"/><path d="M30 44 l6 6 M42 37 l8 7 M54 30 l9 8 M66 23 l9 7 M78 16 l8 6 M36 40 l-6 -6 M48 33 l-6 -8 M60 26 l-5 -9 M72 19 l-4 -8" stroke="#fff" stroke-width=".9" opacity=".8"/></svg>`,
  lystrosaurus: `<svg viewBox="0 0 120 60"><path d="M18 30 C 18 18, 40 12, 62 14 C 76 14, 84 18, 88 22 L 100 22 C 108 22, 110 30, 104 34 L 92 36 C 86 40, 76 42, 62 42 C 40 44, 20 42, 18 30 Z" fill="var(--c)"/>
    <path d="M10 28 L 18 30" stroke="var(--c)" stroke-width="5" stroke-linecap="round"/><path d="M34 40 v12 M50 42 v12 M70 40 v12 M82 38 v12" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
    <path d="M98 34 l-2 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="96" cy="26" r="1.8" fill="#fff"/></svg>`,
  cynognathus: `<svg viewBox="0 0 120 60"><path d="M6 24 C 16 26, 24 28, 30 28 C 44 22, 64 22, 76 24 L 86 18 C 96 14, 110 16, 114 22 L 100 26 L 112 30 C 104 34, 92 34, 84 30 C 76 34, 66 36, 54 36 C 42 36, 34 34, 28 32 C 20 32, 12 30, 6 24 Z" fill="var(--c)"/>
    <path d="M38 34 l-4 16 M50 36 l2 14 M68 34 l-3 16 M78 32 l4 16" stroke="var(--c)" stroke-width="5" stroke-linecap="round"/><circle cx="96" cy="20" r="1.8" fill="#fff"/>
    <path d="M100 26 l3 3 l3 -3 l3 3" stroke="#fff" stroke-width="1.2" fill="none"/></svg>`,
};
let painelFechado = false;
function caixas(n) {
  return `<div class="caixa curio"><b>Você sabia?</b>${n.curiosidade}</div>
    <div class="caixa perg"><b>Pergunta para a turma</b>${n.pergunta}</div>
    ${estado.detalhes && n.detalhes ? `<div class="caixa det"><b>Mais detalhes</b>${n.detalhes}</div>` : ""}
    <div class="caixa dica">👆 ${n.dica}</div>`;
}
function fichaCamada(c) {
  return `<div class="fichaCamada"><h3>${c.nome}</h3><dl><dt>Onde</dt><dd>${c.prof}</dd><dt>Estado</dt><dd>${c.estado}</dd>
    <dt>Do que é feita</dt><dd>${c.composicao}</dd><dt>Temperatura</dt><dd>${c.temperatura}</dd><dt>Densidade</dt><dd>${c.densidade}</dd></dl><p>${c.texto}</p></div>`;
}
function conteudoNivel(id) {
  if (id === "terra") {
    const f = estado.fossil ? FOSSIL[estado.fossil] : null;
    const ev = CFG.evidencias;
    return `<h3 style="margin:10px 0 2px;font-size:.95rem">🦴 Fósseis ${estado.fosseis ? "" : "<small>(ligue em Evidências)</small>"}</h3>
      <div class="cartoesFossil">${CFG.fosseis.map((x) => `<div class="cFossil${estado.fossil === x.id ? " sel" : ""}${estado.fossil && estado.fossil !== x.id ? " apagado" : ""}" data-fossil="${x.id}" style="--c:${COR_FOSSIL[x.id]}">
        ${DESENHOS[x.id]}<b>${x.nome}</b><span>${x.tipo}</span></div>`).join("")}</div>
      ${f ? `<div class="fichaFossil" style="--c:${COR_FOSSIL[f.id]}"><h3>${f.nome}</h3><div class="meta">${f.tipo} · ${f.idade}</div>
        <p>${f.texto}</p><p><b>Onde:</b> ${f.onde}</p><div class="porque"><b>Por que é uma evidência?</b> ${f.porque}</div>
        <button id="bTodos" style="margin-top:6px">Ver todos os fósseis</button></div>`
        : `<p style="font-size:.85rem;color:#555">Clique em um fóssil para ver onde ele foi encontrado. Depois volte o tempo para 270 milhões de anos.</p>`}
      <div class="evid">${["geleiras", "montanhas", "carvao"].map((k) => `<button data-ev="${k}" class="${estado[k] ? "on" : ""}">${{ geleiras: "🧊", montanhas: "⛰️", carvao: "⚫" }[k]} ${ev[k].nome}</button>`).join("")}</div>
      ${["geleiras", "montanhas", "carvao"].filter((k) => estado[k]).map((k) => `<div class="caixa det" style="background:#eef5ff;border-color:#c9dcf5"><b>${ev[k].nome}</b>${ev[k].texto}</div>`).join("")}`;
  }
  if (id === "camadas") {
    const lista = ["crosta_cont", "crosta_oce", "litosfera", "astenosfera", "manto_sup", "manto_inf", "nucleo_ext", "nucleo_int"];
    const pf = { crosta_cont: "0–70 km", crosta_oce: "0–10 km", litosfera: "0–100 km", astenosfera: "100–350 km", manto_sup: "até 660 km", manto_inf: "660–2.900 km", nucleo_ext: "2.900–5.150 km", nucleo_int: "5.150–6.371 km" };
    return `<ul class="listaCamadas">${lista.map((k) => `<li data-camada="${k}" class="${estado.camada === k ? "sel" : ""}"><span class="cor" style="background:${COR_CAMADA[k]}"></span>${CAMADA[k].nome}<small>${pf[k]}</small></li>`).join("")}</ul>
      ${estado.camada ? fichaCamada(CAMADA[estado.camada]) : ""}
      ${estado.detalhes ? `<div class="caixa det"><b>Descontinuidades</b>${CFG.descontinuidades.map((d) => `<p style="margin:3px 0"><b style="display:inline;text-transform:none;letter-spacing:0">${d.nome}:</b> ${d.texto}</p>`).join("")}</div>` : ""}
      <p style="font-size:.82rem;color:#555">${estado.aumentar ? "⚠️ A crosta, a litosfera e a astenosfera foram engrossadas para aparecer. Desligue \"Engrossar a crosta\" para ver a escala real." : "Escala real: a crosta é tão fina que mal aparece."}</p>`;
  }
  if (id === "litosfera") {
    const lista = ["crosta_cont", "crosta_oce", "litosfera", "astenosfera"];
    return `<ul class="listaCamadas">${lista.map((k) => `<li data-parte="${k}" class="${estado.parteLit === k ? "sel" : ""}"><span class="cor" style="background:${COR_CAMADA[k]}"></span>${k === "litosfera" ? "Manto litosférico (parte da litosfera)" : CAMADA[k].nome}</li>`).join("")}</ul>
      ${estado.parteLit ? fichaCamada(CAMADA[estado.parteLit]) : ""}
      <p style="font-size:.82rem;color:#555">⚠️ Fora de escala: as montanhas e as camadas de cima foram engrossadas.</p>`;
  }
  if (id === "conveccao") {
    return `<div class="legendaConv">
      <span><i style="background:rgba(255,245,170,1)"></i>Rocha quente subindo</span>
      <span><i style="background:rgba(120,160,230,1)"></i>Rocha mais fria descendo</span>
      <span><i style="background:#ffd76a"></i>Dorsal: nasce crosta oceânica nova</span>
      <span><i style="background:#0b1d3a"></i>Fossa: a placa de Nazca mergulha sob a América do Sul</span>
      ${estado.faixas ? `<span><i style="background:${corFaixa(true)}"></i>Faixa magnética normal (como hoje)</span><span><i style="background:${corFaixa(false)}"></i>Faixa invertida</span>` : ""}
      </div>
      <p style="font-size:.85rem">No modelo, o Atlântico Sul se alarga cerca de ${(CV.vAtl * 2 / 10).toFixed(1).replace(".", ",")} cm por ano e a placa de Nazca anda ${(CV.vNazca / 10).toFixed(1).replace(".", ",")} cm por ano: por isso as faixas do Pacífico são mais largas.</p>
      <p style="font-size:.82rem;color:#555">⚠️ Fora de escala e simplificado: a crosta e a litosfera foram engrossadas, e as inversões do campo magnético são muito menos numerosas que as reais.</p>`;
  }
  return "";
}
function montarPainel() {
  const i = ORDEM.indexOf(atual.id);
  const n = CFG.niveis[i];
  const p = $("painel");
  p.classList.toggle("fechado", painelFechado);
  const prox = CFG.niveis[i + 1];
  p.innerHTML = `<button class="recolher" id="recolher">${painelFechado ? "Mostrar explicação ▾" : "Recolher ▴"}</button>
    <div class="nivelNum">Nível ${i + 1} de ${ORDEM.length}</div>
    <h2>${n.titulo}</h2>
    <p>${n.texto}</p>
    ${conteudoNivel(atual.id)}
    ${caixas(n)}
    ${prox ? `<button class="botaoProx" id="bProx">Próximo: ${prox.nome} →</button>` : `<button class="botaoProx" id="bProx">⟲ Voltar para a Terra no tempo</button>`}`;
  $("recolher").addEventListener("click", () => { painelFechado = !painelFechado; montarPainel(); });
  $("bProx").addEventListener("click", () => irPara(prox ? prox.id : "terra"));
  p.querySelectorAll("[data-fossil]").forEach((el) => el.addEventListener("click", () => escolherFossil(el.dataset.fossil === estado.fossil ? null : el.dataset.fossil, true)));
  p.querySelectorAll("[data-ev]").forEach((el) => el.addEventListener("click", () => {
    const k = el.dataset.ev; mudarCheck({ geleiras: "vGeleiras", montanhas: "vMontanhas", carvao: "vCarvao" }[k], k, !estado[k]);
    if (estado[k] && k === "geleiras" && estado.t < 260) definirTempo(300);
    if (estado[k]) focarGlobo(...{ geleiras: [20, -45], montanhas: [-30, 30], carvao: [160, -75] }[k]);
    NIVEIS.terra.marcarSujo(); montarPainel(); escreverEndereco();
  }));
  const bt = $("bTodos"); if (bt) bt.addEventListener("click", () => escolherFossil(null));
  p.querySelectorAll("[data-camada]").forEach((el) => el.addEventListener("click", () => { estado.camada = el.dataset.camada; NIVEIS.camadas.redesenhar(); montarPainel(); }));
  p.querySelectorAll("[data-parte]").forEach((el) => el.addEventListener("click", () => { estado.parteLit = el.dataset.parte; montarPainel(); }));
  redimensionar();
}
const FOCO_FOSSIL = { mesosaurus: [-15, -30], glossopteris: [40, -45], lystrosaurus: [60, -45], cynognathus: [-20, -35] };
function escolherFossil(id, focar = false) {
  estado.fossil = id;
  if (id && !estado.fosseis) mudarCheck("vFosseis", "fosseis", true);
  NIVEIS.terra.marcarSujo();
  montarPainel();
  if (id && focar && cacheTerra.rots) {
    const [pl, lon, lat] = PONTOS_FOSSEIS[id][0];
    const c = girarPonto(cacheTerra.rots, pl, lon, lat);
    focarGlobo(c[0], Math.max(-55, c[1]));
  }
  escreverEndereco();
}
function focarGlobo(lon, lat) {
  if (atual.id !== "terra") return;
  const d = camera.position.length();
  const destino = posGlobo(lon, lat, d);
  animarCamera(camera.position.clone(), destino, controles.target.clone(), V(0, 0, 0), 1.2);
}

function atualizarInterface() {
  montarTrilha();
  montarPainel();
  $("voltar").hidden = ORDEM.indexOf(atual.id) === 0;
  $("relogio").classList.toggle("abaixo", !$("voltar").hidden);
  document.querySelectorAll("[data-so]").forEach((el) => (el.hidden = !el.dataset.so.split(" ").includes(atual.id)));
  atualizarRelogio();
  escreverEndereco();
}
$("voltar").addEventListener("click", () => { const i = ORDEM.indexOf(atual.id); if (i > 0 && !tour.ativo) irPara(ORDEM[i - 1]); });

// ---------- linha do tempo das ideias
function montarHistoria() {
  $("cartoesHist").innerHTML = CFG.historia.map((h, i) => `<div class="cHist" data-i="${i}"><div class="ano">${h.ano}</div><div class="quem">${h.nome}</div>
    <p>${h.texto}</p>${h.acao ? `<button data-acao="${i}">${h.botao}</button>` : ""}</div>`).join("");
  $("cartoesHist").querySelectorAll("[data-acao]").forEach((b) => b.addEventListener("click", () => {
    const i = +b.dataset.acao;
    $("cartoesHist").querySelectorAll(".cHist").forEach((c) => c.classList.toggle("atual", +c.dataset.i === i));
    executarAcao(CFG.historia[i].acao);
  }));
}
montarHistoria();
$("bHistoria").addEventListener("click", () => { $("historia").hidden = !$("historia").hidden; });
$("fecharHist").addEventListener("click", () => { $("historia").hidden = true; });

async function executarAcao(a) {
  if (!a) return;
  pararAnimacao();
  if (a.nivel && a.nivel !== atual.id) await irPara(a.nivel);
  if (a.t !== undefined) definirTempo(a.t);
  if (a.encaixe) encaixar(true); else if (estado.encaixeAlvo) encaixar(false);
  if (a.todas) { mudarCheck("vFosseis", "fosseis", true); mudarCheck("vGeleiras", "geleiras", true); mudarCheck("vMontanhas", "montanhas", true); mudarCheck("vCarvao", "carvao", true); estado.fossil = null; }
  if (a.fossil) escolherFossil(a.fossil);
  if (a.fosseis) { mudarCheck("vFosseis", "fosseis", true); estado.fossil = null; }
  if (a.camada) mudarCheck({ geleiras: "vGeleiras", montanhas: "vMontanhas", carvao: "vCarvao" }[a.camada], a.camada, true);
  if (a.faixas) mudarCheck("vFaixas", "faixas", true);
  if (a.foco) focarGlobo(a.foco[0], a.foco[1]);
  NIVEIS.terra.marcarSujo(); NIVEIS.conveccao.marcarSujo();
  montarPainel();
  escreverEndereco();
}

// ---------- endereço (atalhos para preparar a aula)
function lerEndereco() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has("t")) estado.t = limitar(+h.get("t") || 0, 0, TMAX);
  else estado.t = h.get("nivel") === "conveccao" ? 0 : TMAX;
  if (h.has("fossil") && FOSSIL[h.get("fossil")]) estado.fossil = h.get("fossil");
  for (const [k, id] of [["fosseis", "vFosseis"], ["geleiras", "vGeleiras"], ["montanhas", "vMontanhas"], ["carvao", "vCarvao"], ["nomes", "vNomes"], ["detalhes", "vDetalhes"], ["faixas", "vFaixas"], ["cores", "vCores"]]) {
    if (h.has(k)) mudarCheck(id, k, h.get(k) === "1");
  }
  if (h.get("encaixe") === "1") { estado.t = 0; estado.encaixe = estado.encaixeAlvo = 1; $("bEncaixe").textContent = "↔ Separar"; }
  const n = h.get("nivel");
  return NIVEIS[n] ? n : "terra";
}
function escreverEndereco() {
  if (!atual) return;
  const p = [`nivel=${atual.id}`];
  if (atual.id === "terra" || atual.id === "conveccao") p.push(`t=${Math.round(estado.t)}`);
  if (atual.id === "terra") {
    if (estado.fossil) p.push(`fossil=${estado.fossil}`);
    if (!estado.fosseis) p.push("fosseis=0");
    for (const k of ["geleiras", "montanhas", "carvao"]) if (estado[k]) p.push(`${k}=1`);
    if (estado.encaixeAlvo > 0.5) p.push("encaixe=1");
  }
  if (estado.detalhes) p.push("detalhes=1");
  if (!estado.nomes) p.push("nomes=0");
  history.replaceState(null, "", "#" + p.join("&"));
}

// ---------- transições entre níveis
const anims = [];
function animarCamera(dePos, paraPos, deAlvo, paraAlvo, dur) {
  return new Promise((ok) => anims.push({ dePos, paraPos, deAlvo, paraAlvo, dur, t: 0, ok, globo: atual && atual.id === "terra" }));
}
function ativar(id) {
  if (atual) { atual.cena.visible = false; rotRenderer.render(atual.cena, camera); atual.cena.visible = true; }
  atual = NIVEIS[id];
  controles.minDistance = atual.cam.min;
  controles.maxDistance = atual.cam.max;
  if (id === "conveccao" && estado.t > TCONV) estado.t = TCONV;
  definirTempo(estado.t);
  atualizarInterface();
}
function posNormal(c) {
  const asp = cenaEl.clientWidth / Math.max(1, cenaEl.clientHeight);
  const largo = atual.id === "conveccao" || atual.id === "litosfera"; // blocos compridos precisam de mais distância em tela de pé
  const fator = asp < 0.8 ? (largo ? 3.1 : 1.5) : asp < 1.1 ? (largo ? 1.7 : 1.25) : 1;
  return c.alvo.clone().add(c.pos.clone().sub(c.alvo).multiplyScalar(fator));
}
let ocupado = false;
async function irPara(id) {
  if (ocupado || !NIVEIS[id] || (atual && atual.id === id)) return;
  ocupado = true;
  controles.enabled = false;
  pararAnimacao();
  const entrando = ORDEM.indexOf(id) > ORDEM.indexOf(atual.id);
  const pos0 = camera.position.clone(), alvo0 = controles.target.clone();
  const pos1 = entrando ? alvo0.clone().add(pos0.clone().sub(alvo0).multiplyScalar(0.45)) : alvo0.clone().add(pos0.clone().sub(alvo0).multiplyScalar(1.8));
  setTimeout(() => $("veu").classList.add("on"), 300);
  await animarCamera(pos0, pos1, alvo0, alvo0.clone(), 0.8);
  ativar(id);
  const c = atual.cam;
  const destino = posNormal(c);
  const inicio = c.alvo.clone().add(destino.clone().sub(c.alvo).multiplyScalar(entrando ? 1.8 : 0.6));
  camera.position.copy(inicio);
  controles.target.copy(c.alvo);
  $("veu").classList.remove("on");
  await animarCamera(inicio, destino, c.alvo.clone(), c.alvo.clone(), 1.0);
  controles.enabled = true;
  ocupado = false;
}

// ---------- viagem guiada
const tour = { ativo: false, geracao: 0 };
const vivo = (g) => tour.ativo && tour.geracao === g;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function viagem() {
  if (tour.ativo) return encerrarViagem();
  tour.ativo = true; const g = ++tour.geracao;
  $("bViagem").textContent = "⏹ Parar a viagem";
  $("roteiro").hidden = false;
  document.body.classList.add("emViagem");
  for (const passo of CFG.viagem) {
    if (!vivo(g)) return;
    $("roteiroTexto").textContent = passo.texto;
    if (passo.nivel !== atual.id) await irPara(passo.nivel);
    if (!vivo(g)) return;
    if (atual.id === "terra") {
      mudarCheck("vGeleiras", "geleiras", passo.camada === "geleiras");
      if (passo.fosseis) { mudarCheck("vFosseis", "fosseis", true); estado.fossil = null; }
    }
    if (passo.faixas) mudarCheck("vFaixas", "faixas", true);
    if (passo.t !== undefined) definirTempo(passo.t);
    if (passo.encaixe) encaixar(true); else if (estado.encaixeAlvo) encaixar(false);
    if (passo.foco) focarGlobo(passo.foco[0], passo.foco[1]);
    NIVEIS.terra.marcarSujo(); montarPainel();
    if (passo.anima) {
      definirTempo(passo.anima[0]);
      const dur = 7000, t0 = performance.now();
      while (vivo(g) && performance.now() - t0 < dur) {
        const u = suave(limitar((performance.now() - t0) / dur));
        definirTempo(passo.anima[0] + (passo.anima[1] - passo.anima[0]) * u);
        await esperar(30);
      }
      await esperar(1500);
    } else await esperar(Math.max(5200, passo.texto.length * 60));
  }
  encerrarViagem();
}
function encerrarViagem() {
  tour.ativo = false; tour.geracao++;
  $("bViagem").textContent = "🎬 Viagem guiada";
  $("roteiro").hidden = true;
  document.body.classList.remove("emViagem");
}
$("bViagem").addEventListener("click", viagem);
$("roteiroParar").addEventListener("click", encerrarViagem);

// ---------- cliques na cena
const raio = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
let apertou = null;
function acertar(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raio.setFromCamera(ponteiro, camera);
  const lista = atual.id === "terra" ? [atual.globo] : atual.clicaveis;
  const hits = raio.intersectObjects(lista, false);
  return hits[0] || null;
}
renderer.domElement.addEventListener("pointerdown", (ev) => { apertou = { x: ev.clientX, y: ev.clientY }; });
renderer.domElement.addEventListener("pointerup", (ev) => {
  if (!apertou || ocupado) return;
  const mov = Math.hypot(ev.clientX - apertou.x, ev.clientY - apertou.y);
  apertou = null;
  if (mov > 8) return;
  const hit = acertar(ev);
  if (!hit) return;
  if (atual.id === "terra") cliqueTerra(hit); else atual.clique(hit);
});

// ---------- tamanho e laço principal
function redimensionar() {
  if (innerWidth > 760) {
    const topo = cenaEl.getBoundingClientRect().top + scrollY;
    cenaEl.style.height = Math.max(500, innerHeight - topo) + "px";
  } else cenaEl.style.height = "";
  const w = cenaEl.clientWidth, h = cenaEl.clientHeight;
  renderer.setSize(w, h);
  rotRenderer.setSize(w, h);
  camera.aspect = w / h;
  const painel = $("painel");
  const cobre = getComputedStyle(painel).position === "absolute" && !painel.classList.contains("fechado");
  const desl = cobre ? (painel.offsetWidth + 20) / 2 : 0;
  if (desl) camera.setViewOffset(w, h, desl, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  const dir = cobre ? painel.offsetWidth + 30 : 10;
  $("regua").style.right = dir + "px"; $("historia").style.right = dir + "px";
}
addEventListener("resize", redimensionar);

const relogio = new THREE.Clock();
let tempo = 0;
function quadro() {
  requestAnimationFrame(quadro);
  const dt = Math.min(relogio.getDelta(), 0.05);
  tempo += dt;
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.t = Math.min(1, a.t + dt / a.dur);
    const s = suave(a.t);
    if (a.globo) { // no globo, a câmera gira em volta mantendo a distância
      const d = a.dePos.length() + (a.paraPos.length() - a.dePos.length()) * s;
      camera.position.copy(a.dePos).normalize().lerp(a.paraPos.clone().normalize(), s).normalize().multiplyScalar(d);
    } else camera.position.lerpVectors(a.dePos, a.paraPos, s);
    controles.target.lerpVectors(a.deAlvo, a.paraAlvo, s);
    if (a.t >= 1) { anims.splice(i, 1); a.ok(); }
  }
  // tempo geológico animado (botão ▶)
  if (estado.tocando && estado.alvoT !== null) {
    const vel = atual.id === "conveccao" ? 9 : 18; // milhões de anos por segundo
    const nt = Math.max(estado.alvoT, estado.t - vel * dt);
    definirTempo(nt);
    if (nt <= estado.alvoT + 1e-6) { pararAnimacao(); escreverEndereco(); }
  }
  // encaixe da América do Sul
  if (Math.abs(estado.encaixe - estado.encaixeAlvo) > 1e-4) {
    estado.encaixe += Math.sign(estado.encaixeAlvo - estado.encaixe) * Math.min(Math.abs(estado.encaixeAlvo - estado.encaixe), dt / 2.2);
    NIVEIS.terra.marcarSujo();
  }
  controles.autoRotate = estado.girar && !tour.ativo;
  if (atual.id === "terra" || atual.id === "camadas") for (const s of SOIS) s.position.copy(camera.position).applyAxisAngle(camera.up, 0.5).add(V(0, 1.2, 0));
  atual.animar(dt, tempo);
  if (atual.ocultar) atual.ocultar();
  if (!anims.length) controles.update(); else camera.lookAt(controles.target);
  renderer.render(atual.cena, camera);
  rotRenderer.render(atual.cena, camera);
}

const inicial = lerEndereco();
ativar(inicial);
camera.position.copy(posNormal(atual.cam));
if (inicial === "terra") camera.position.copy(estado.t > 150 ? posGlobo(12, -34, camera.position.length()) : posGlobo(-15, -5, camera.position.length()));
controles.target.copy(atual.cam.alvo);
aplicarNomes();
redimensionar();
quadro();
window.__simulador = { NIVEIS, estado, irPara, definirTempo, encaixar, escolherFossil, viagem, executarAcao, camera, controles }; // para testes no console
