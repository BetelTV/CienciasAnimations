// reconstrucao.js — posição dos continentes ao longo do tempo geológico (reconstrução simplificada, didática).
// Cada placa tem uma rotação "na Pangeia" (posição há ~250 milhões de anos) e uma função de separação f(t),
// de 0 (hoje) a 1 (ainda unida). As placas formam uma árvore: cada uma se move junto com a "mãe" até se separar dela.
// Rotações em quaternions [x, y, z, w]; pontos como vetores unitários [x, y, z] (x: lon 0, y: lon 90°L, z: polo norte).

const RAD = Math.PI / 180;
export const vet = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
export const lonlat = (v) => [Math.atan2(v[1], v[0]) / RAD, Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD];
const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pesc = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const QI = [0, 0, 0, 1];
export function qEixo(eixo, ang) { const e = norm(eixo), s = Math.sin(ang / 2); return [e[0] * s, e[1] * s, e[2] * s, Math.cos(ang / 2)]; }
export function qMul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
export const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];
export function qGira(q, v) {
  const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2],
    iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
export function qSlerp(a, b, t) {
  let c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (c < 0) { c = -c; bb = b.map((x) => -x); }
  if (c > 0.9995) return norm(a.map((x, i) => x + (bb[i] - x) * t));
  const th = Math.acos(c), s = Math.sin(th);
  const ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
  return a.map((x, i) => ka * x + kb * bb[i]);
}
// rotação que leva o ponto a até o ponto b pelo menor caminho
function qDePara(a, b) {
  const c = pesc(a, b);
  if (c > 0.999999) return QI;
  return qEixo(cruz(a, b), Math.acos(Math.max(-1, Math.min(1, c))));
}

// ---------------------------------------------------------------- placas
// A posição na Pangeia (~250 milhões de anos) pode ser dada de três jeitos:
//   pangeia: para onde vai o "centro" da placa (lat, lon) e o giro em torno dele (graus, + = anti-horário visto de fora)
//   polo:    rotação em torno de um polo de Euler (lat, lon, ângulo), relativa à placa-mãe (ex.: encaixe de Bullard, 1965)
//   q:       rotação absoluta já calculada (quaternion), obtida ajustando pontos do litoral que devem se encostar
// mae: placa à qual está presa; separa: pares [idade em milhões de anos, f] (f = 1 unida à mãe como na Pangeia, 0 = posição de hoje)
export const PLACAS = {
  AF: { nome: "África", mae: null, pangeia: { lat: -14, lon: 6, giro: -12 }, separa: [[0, 0], [250, 1], [400, 1]] },
  SA: { nome: "América do Sul", mae: "AF", polo: { lat: 44.0, lon: -30.6, ang: 57.0 }, separa: [[0, 0], [135, 1], [400, 1]] },
  NA: { nome: "América do Norte", mae: "AF", polo: { lat: 66.95, lon: -12.02, ang: 75.55 }, separa: [[0, 0], [195, 1], [400, 1]] },
  CA: { nome: "América Central e Caribe", mae: "NA", pangeia: null, separa: [[0, 0]] },
  EU: { nome: "Eurásia", mae: "AF", q: [0.13886, 0.18942, 0.14508, 0.96114], separa: [[0, 0], [200, 1], [400, 1]] },
  IS: { nome: "Islândia", mae: "EU", pangeia: null, separa: [[0, 0]] },
  AR: { nome: "Arábia", mae: "AF", q: [-0.16113, 0.15749, -0.10521, 0.96859], separa: [[0, 0], [25, 1], [400, 1]] },
  AN: { nome: "Antártida", mae: "AF", q: [0.18773, -0.12507, -0.25456, 0.94038], separa: [[0, 0], [180, 1], [400, 1]] },
  MG: { nome: "Madagascar", mae: "AF", q: [-0.1146, 0.01465, -0.09262, 0.98898], separa: [[0, 0], [120, 0], [165, 1], [400, 1]] },
  IN: { nome: "Índia", mae: "MG", q: [-0.64226, -0.45323, -0.11212, 0.60788], separa: [[0, 0], [50, 0.14], [90, 1], [400, 1]] },
  AU: { nome: "Austrália", mae: "AN", q: [-0.07017, -0.15096, -0.41171, 0.89598], separa: [[0, 0], [45, 0.72], [85, 1], [400, 1]] },
};
export const ORDEM = ["AF", "SA", "NA", "CA", "EU", "IS", "AR", "AN", "MG", "IN", "AU"];

function interp(pares, t) {
  if (t <= pares[0][0]) return pares[0][1];
  for (let i = 1; i < pares.length; i++) {
    const [t1, f1] = pares[i], [t0, f0] = pares[i - 1];
    if (t <= t1) { const u = (t - t0) / (t1 - t0); const s = u * u * (3 - 2 * u); return f0 + (f1 - f0) * (0.35 * u + 0.65 * s); }
  }
  return pares[pares.length - 1][1];
}

// centro aproximado de cada placa (média dos vértices, normalizada)
export function prepararPlacas(geo) {
  for (const k of ORDEM) {
    const p = PLACAS[k];
    let s = [0, 0, 0];
    for (const poly of geo[k].coordinates) for (const [lon, lat] of poly[0]) { const v = vet(lon, lat); s = [s[0] + v[0], s[1] + v[1], s[2] + v[2]]; }
    p.centro = norm(s);
  }
  calcularPangeia();
}
export function calcularPangeia() {
  for (const k of ORDEM) {
    const p = PLACAS[k];
    if (p.q) { p.qAbs = p.q; continue; }
    if (p.polo) { p.qAbs = qMul(PLACAS[p.mae].qAbs, qEixo(vet(p.polo.lon, p.polo.lat), p.polo.ang * RAD)); continue; }
    if (!p.pangeia) { p.qAbs = null; continue; }
    const alvo = vet(p.pangeia.lon, p.pangeia.lat);
    p.qAbs = qMul(qEixo(alvo, p.pangeia.giro * RAD), qDePara(p.centro, alvo));
  }
  for (const k of ORDEM) {
    const p = PLACAS[k];
    if (!p.qAbs) { p.qRel = QI; p.qAbs = p.mae ? PLACAS[p.mae].qAbs : QI; continue; }
    p.qRel = p.mae ? qMul(qInv(PLACAS[p.mae].qAbs), p.qAbs) : p.qAbs;
  }
}

// rotação total da placa na idade t (milhões de anos atrás). extra: {placa: f} para forçar uma separação (ex.: encaixe)
export function rotacao(k, t, extra = null, cache = {}) {
  if (cache[k]) return cache[k];
  const p = PLACAS[k];
  const f = extra && k in extra ? extra[k] : interp(p.separa, t);
  const rel = qSlerp(QI, p.qRel, f);
  const q = p.mae ? qMul(rotacao(p.mae, t, extra, cache), rel) : rel;
  cache[k] = q;
  return q;
}
export function rotacoes(t, extra = null) {
  const cache = {};
  for (const k of ORDEM) rotacao(k, t, extra, cache);
  return cache;
}
export function girarLonLat(q, lon, lat) { return lonlat(qGira(q, vet(lon, lat))); }
export function girarGeo(q, mp) {
  return { type: "MultiPolygon", coordinates: mp.coordinates.map((poly) => poly.map((r) => r.map(([lon, lat]) => girarLonLat(q, lon, lat)))) };
}
