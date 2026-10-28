// Gráficos em SVG montados como texto: os pontos por CT-e da Evolução e a linha miúda das Rotas.

import { esc, fmtMes, fmtNum } from "./formato.js";

const r1 = n => Math.round(n * 10) / 10;

/* Passo "redondo" (1, 2, 2,5 ou 5 × 10^k) para cerca de 4 intervalos. */
function marcas(min, max) {
  if (min === max) { min -= 1; max += 1; }
  const bruto = (max - min) / 4, pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map(m => m * pot).find(p => p >= bruto);
  const ini = Math.floor(min / passo) * passo, out = [];
  for (let v = ini; v <= max + passo * 1e-9; v += passo) out.push(+v.toFixed(10));
  if (out.at(-1) < max) out.push(+(out.at(-1) + passo).toFixed(10));
  return out;
}

/* Gradiente do frete: navy (mais barato) → plum → accent (mais caro), linear em RGB entre as paradas. */
const PARADAS = [[0x11, 0x23, 0x46], [0x8e, 0x5a, 0xa8], [0xe4, 0x53, 0x6c]];
export function corGradiente(t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0)) * (PARADAS.length - 1), i = Math.min(PARADAS.length - 2, Math.floor(x)), f = x - i;
  return "#" + PARADAS[i].map((c, k) => Math.round(c + (PARADAS[i + 1][k] - c) * f).toString(16).padStart(2, "0")).join("");
}

const percentil = (ord, q) => {
  const pos = (ord.length - 1) * q, i = Math.floor(pos);
  return ord[i] + ((ord[i + 1] ?? ord[i]) - ord[i]) * (pos - i);
};
/* Escala do percentil 5 ao 95 com folga: um CT-e fora da curva (unidade errada, digitação) não achata os outros. */
export function escalaPercentil(valores) {
  const ord = [...valores].sort((a, b) => a - b);
  let min = percentil(ord, 0.05), max = percentil(ord, 0.95);
  const folga = (max - min || Math.abs(max) || 1) * 0.08;
  const ticks = marcas(min >= 0 ? Math.max(0, min - folga) : min - folga, max + folga);
  return { min: ticks[0], max: ticks.at(-1), ticks };
}

const diaUTC = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const proxMes = mes => { let [a, m] = mes.split("-").map(Number); if (++m > 12) { m = 1; a++; } return `${a}-${String(m).padStart(2, "0")}`; };

/* Um ponto por CT-e na data de emissão; a cor é a posição do valor entre o menor e o maior do recorte.
   medianas: [{ mes, valor }] desenhadas em degraus (um patamar por mês). */
export function pontosCtes(pontos, { medianas = [], largura = 760, altura = 300, formatar = v => fmtNum(v, 2) } = {}) {
  const esq = 64, dir = 14, topo = 12, base = 26;
  if (!pontos.length) return `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Sem CT-e no recorte"></svg>`;
  const { min: vmin, max: vmax, ticks } = escalaPercentil(pontos.map(p => p.valor));
  const datas = pontos.map(p => p.data).sort();
  const meses = [];
  for (let m = datas[0].slice(0, 7); m <= datas.at(-1).slice(0, 7); m = proxMes(m)) meses.push(m);
  const t0 = diaUTC(meses[0] + "-01"), t1 = diaUTC(proxMes(meses.at(-1)) + "-01");
  const w = largura - esq - dir, h = altura - topo - base;
  const xt = t => r1(esq + ((t - t0) / (t1 - t0)) * w);
  const x = iso => xt(diaUTC(iso) + 432e5);   // meio do dia
  const y = v => r1(topo + h - ((v - vmin) / (vmax - vmin)) * h);
  const lo = Math.min(...pontos.map(p => p.valor)), hi = Math.max(...pontos.map(p => p.valor));
  const cor = v => corGradiente(hi === lo ? 0.5 : (v - lo) / (hi - lo));

  const partes = [`<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Frete de cada CT-e na data de emissão">`];
  for (const t of ticks) partes.push(`<line class="gl" x1="${esq}" x2="${largura - dir}" y1="${y(t)}" y2="${y(t)}"/>`,
    `<text class="ax" x="${esq - 8}" y="${y(t) + 3}" text-anchor="end">${esc(formatar(t))}</text>`);
  const cada = Math.ceil(meses.length / 12);
  meses.forEach((m, i) => {
    const xi = xt(diaUTC(m + "-01")), xf = xt(diaUTC(proxMes(m) + "-01"));
    if (i) partes.push(`<line class="gl mes" x1="${xi}" x2="${xi}" y1="${topo}" y2="${topo + h}"/>`);
    if (i % cada === 0) partes.push(`<text class="ax" x="${r1((xi + xf) / 2)}" y="${altura - 8}" text-anchor="middle">${fmtMes(m)}</text>`);
  });
  if (medianas.length) {
    let d = "";
    for (const { mes, valor } of [...medianas].sort((a, b) => a.mes.localeCompare(b.mes))) {
      if (valor == null || mes < meses[0] || mes > meses.at(-1)) continue;
      const yv = Math.min(topo + h, Math.max(topo, y(valor)));
      d += `M${xt(diaUTC(mes + "-01"))} ${yv} H${xt(diaUTC(proxMes(mes) + "-01"))} `;
    }
    if (d) partes.push(`<path class="mediana" d="${d.trim()}" fill="none"/>`);
  }
  // os mais caros por cima: são os que chamam a conferência
  for (const p of [...pontos].sort((a, b) => a.valor - b.valor)) {
    const preso = p.valor < vmin || p.valor > vmax;
    const cy = Math.min(topo + h, Math.max(topo, y(p.valor)));
    partes.push(`<circle class="cte${preso ? " preso" : ""}" data-chave="${esc(p.chave)}" cx="${x(p.data)}" cy="${cy}" r="4.5" fill="${cor(p.valor)}"/>`);
  }
  partes.push("</svg>");
  return partes.join("");
}

export function miniGrafico(porMes, meses, { largura = 120, altura = 28 } = {}) {
  const vals = meses.map(m => porMes[m]).filter(v => v != null);
  const abre = `<svg class="mini" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" aria-hidden="true">`;
  if (!vals.length) return abre + "</svg>";
  const min = Math.min(...vals), max = Math.max(...vals), pad = 3;
  const x = i => r1(meses.length === 1 ? largura / 2 : pad + (i * (largura - 2 * pad)) / (meses.length - 1));
  const y = v => r1(max === min ? altura / 2 : altura - pad - ((v - min) / (max - min)) * (altura - 2 * pad));
  const trechos = [];
  let atual = [], ultimo = null;
  meses.forEach((m, i) => {
    const v = porMes[m];
    if (v == null) { if (atual.length) trechos.push(atual); atual = []; return; }
    atual.push(`${x(i)},${y(v)}`); ultimo = [x(i), y(v)];
  });
  if (atual.length) trechos.push(atual);
  return abre + trechos.map(t => `<polyline points="${t.join(" ")}" fill="none" stroke="var(--navy)" stroke-width="1.5"/>`).join("") +
    `<circle cx="${ultimo[0]}" cy="${ultimo[1]}" r="2.6" fill="var(--accent)"/></svg>`;
}
