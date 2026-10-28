import { test } from "node:test";
import assert from "node:assert/strict";
import { linhasMensais, miniGrafico, CORES_SERIES } from "../src/graficos.js";

const ponto = (mediana, min = mediana, max = mediana, n = 1) => ({ mediana, min, max, n });
const meses = ["2026-01", "2026-02", "2026-03", "2026-04"];
const serie = (raiz, pontos, nome = raiz) => ({ raiz, nome, n: Object.keys(pontos).length, pontos });

test("linhasMensais quebra a linha em mês vazio", () => {
  const svg = linhasMensais({ meses, series: [serie("1", { "2026-01": ponto(175), "2026-02": ponto(180), "2026-04": ponto(190) })] }, {});
  const d = svg.match(/<path class="serie"[^>]* d="([^"]+)"/)[1];
  assert.equal((d.match(/M/g) || []).length, 2);
  assert.ok(!/NaN|Infinity|undefined/.test(svg));
  assert.match(svg, /jan\/26/);
});

test("sétima série fica em steel-l", () => {
  const series = Array.from({ length: 7 }, (_, i) => serie(String(i), { "2026-01": ponto(100 + i) }));
  const svg = linhasMensais({ meses, series }, {});
  assert.equal((svg.match(/class="serie resto"/g) || []).length, 1);
  assert.match(svg, /data-raiz="6"[^>]*stroke="var\(--steel-l\)"|stroke="var\(--steel-l\)"[^>]*data-raiz="6"/);
  assert.match(svg, new RegExp(`stroke="${CORES_SERIES[0].replace(/[()]/g, "\\$&")}"`));
});

test("pontos carregam min, max e n", () => {
  const svg = linhasMensais({ meses, series: [serie("1", { "2026-02": ponto(180, 175, 185, 2) })] }, {});
  assert.match(svg, /<circle class="ponto"[^>]*data-mes="2026-02"[^>]*data-mediana="180"[^>]*data-min="175"[^>]*data-max="185"[^>]*data-n="2"/);
  assert.match(svg, /class="faixa"/);
});

test("escapa nome do transportador no title", () => {
  const svg = linhasMensais({ meses, series: [serie("1", { "2026-01": ponto(1) }, "A<B>")] }, {});
  assert.ok(!svg.includes("A<B>"));
  assert.ok(svg.includes("A&lt;B&gt;"));
});

test("rótulos do eixo y usam o formatador", () => {
  const svg = linhasMensais({ meses, series: [serie("1", { "2026-01": ponto(100), "2026-02": ponto(200) })] }, { formatar: v => "R$" + v });
  assert.match(svg, /R\$\d/);
});

test("miniGrafico sem dados devolve svg vazio sem NaN", () => {
  const svg = miniGrafico({}, meses, {});
  assert.match(svg, /^<svg/);
  assert.ok(!/NaN|Infinity/.test(svg));
  const um = miniGrafico({ "2026-02": 5 }, meses, {});
  assert.ok(!/NaN|Infinity/.test(um));
  const com = miniGrafico({ "2026-01": 1, "2026-02": 2, "2026-04": 3 }, meses, {});
  assert.equal((com.match(/<polyline/g) || []).length, 2);
  assert.match(com, /fill="var\(--accent\)"/);
});
