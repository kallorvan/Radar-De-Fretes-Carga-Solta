// Gráficos em SVG montados como texto. Mês sem dado interrompe a linha; nunca vira zero.

import { esc, fmtMes, fmtNum } from "./formato.js";

export const CORES_SERIES = ["var(--navy)", "var(--accent)", "var(--plum)", "var(--yard-20)", "var(--pie-6)", "var(--pie-5)"];
const COR_RESTO = "var(--steel-l)";
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

export function linhasMensais({ meses, series }, { largura = 760, altura = 300, formatar = v => fmtNum(v, 2) } = {}) {
  const esq = 64, dir = 14, topo = 12, base = 26;
  // a escala segue as medianas: um CT-e fora da curva (unidade diferente, erro de digitação) não achata a linha;
  // a faixa mín–máx é cortada na borda e os extremos continuam na dica
  const valores = series.flatMap(s => Object.values(s.pontos).map(p => p.mediana));
  if (!meses.length || !valores.length) return `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Sem dados no período"></svg>`;
  let vmin = Math.min(...valores), vmax = Math.max(...valores);
  const folga = (vmax - vmin || Math.abs(vmax) || 1) * 0.08;
  const ticks = marcas(vmin >= 0 ? Math.max(0, vmin - folga) : vmin - folga, vmax + folga);
  vmin = ticks[0]; vmax = ticks.at(-1);
  const w = largura - esq - dir, h = altura - topo - base;
  const x = i => r1(esq + (meses.length === 1 ? w / 2 : (i * w) / (meses.length - 1)));
  const y = v => r1(topo + h - ((v - vmin) / (vmax - vmin)) * h);
  const yc = v => Math.min(topo + h, Math.max(topo, y(v)));

  const partes = [`<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Evolução mensal por transportador">`];
  for (const t of ticks) partes.push(`<line class="gl" x1="${esq}" x2="${largura - dir}" y1="${y(t)}" y2="${y(t)}"/>`,
    `<text class="ax" x="${esq - 8}" y="${y(t) + 3}" text-anchor="end">${esc(formatar(t))}</text>`);
  const cada = Math.ceil(meses.length / 12);
  meses.forEach((m, i) => { if (i % cada === 0 || i === meses.length - 1) partes.push(`<text class="ax" x="${x(i)}" y="${altura - 8}" text-anchor="middle">${fmtMes(m)}</text>`); });

  // as séries de destaque por último, para ficarem por cima
  const ordem = series.map((s, i) => [s, i]).reverse();
  for (const [s, i] of ordem) {
    const cor = i < CORES_SERIES.length ? CORES_SERIES[i] : COR_RESTO;
    const classe = i < CORES_SERIES.length ? "serie" : "serie resto";
    let d = "", aberto = false;
    meses.forEach((m, j) => {
      const p = s.pontos[m];
      if (!p) { aberto = false; return; }
      d += `${aberto ? "L" : "M"}${x(j)} ${y(p.mediana)} `;
      aberto = true;
    });
    partes.push(`<g class="grupo-serie" data-raiz="${esc(s.raiz)}"><title>${esc(s.nome)}</title>`);
    meses.forEach((m, j) => {
      const p = s.pontos[m];
      if (p && p.max > p.min) partes.push(`<line class="faixa" x1="${x(j)}" x2="${x(j)}" y1="${yc(p.min)}" y2="${yc(p.max)}" stroke="${cor}" stroke-opacity=".35" stroke-width="5"/>`);
    });
    partes.push(`<path class="${classe}" data-raiz="${esc(s.raiz)}" d="${d.trim()}" stroke="${cor}" fill="none" stroke-width="${i < CORES_SERIES.length ? 2.2 : 1.4}"/>`);
    meses.forEach((m, j) => {
      const p = s.pontos[m];
      if (p) partes.push(`<circle class="ponto" data-raiz="${esc(s.raiz)}" data-nome="${esc(s.nome)}" data-mes="${m}" data-mediana="${p.mediana}" data-min="${p.min}" data-max="${p.max}" data-n="${p.n}" cx="${x(j)}" cy="${y(p.mediana)}" r="3.6" fill="${cor}"/>`);
    });
    partes.push("</g>");
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
