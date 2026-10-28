import { test } from "node:test";
import assert from "node:assert/strict";
import { pontosCtes, corGradiente, escalaPercentil, miniGrafico } from "../src/graficos.js";

const meses = ["2026-01", "2026-02", "2026-03", "2026-04"];
const p = (data, valor, chave = data + valor) => ({ data, valor, chave });

test("corGradiente vai do navy ao rosa passando pelo plum", () => {
  assert.equal(corGradiente(0), "#112346");
  assert.equal(corGradiente(1), "#e4536c");
  assert.equal(corGradiente(0.5), "#8e5aa8");
  assert.equal(corGradiente(-1), "#112346");
  assert.equal(corGradiente(2), "#e4536c");
});

test("escalaPercentil deixa o CT-e fora da curva fora da escala", () => {
  const vals = [...Array.from({ length: 20 }, (_, i) => 100 + i), 5000];
  const e = escalaPercentil(vals);
  assert.ok(e.max < 5000, `max ${e.max}`);
  assert.ok(e.min <= 100, `min ${e.min}`);
});

test("pontosCtes desenha um ponto por CT-e e prende o fora da escala na borda", () => {
  const pontos = [...Array.from({ length: 20 }, (_, i) => p(`2026-08-${String(i + 1).padStart(2, "0")}`, 100 + i)), p("2026-09-02", 5000, "fora")];
  const svg = pontosCtes(pontos, {});
  assert.equal((svg.match(/<circle class="cte/g) || []).length, 21);
  assert.equal((svg.match(/class="cte preso"/g) || []).length, 1);
  assert.match(svg, /data-chave="fora"/);
  assert.match(svg, /ago\/26/);
  assert.ok(!/NaN|Infinity|undefined/.test(svg));
});

test("um ponto só, ou todos iguais: sem NaN e cor do meio", () => {
  for (const pontos of [[p("2026-08-10", 175)], [p("2026-08-01", 175), p("2026-08-02", 175), p("2026-08-03", 175)]]) {
    const svg = pontosCtes(pontos, {});
    assert.ok(!/NaN|Infinity|undefined/.test(svg), svg);
    assert.match(svg, /fill="#8e5aa8"/);
  }
});

test("mediana do mês em degraus só quando pedida", () => {
  const pontos = [p("2026-08-05", 170), p("2026-08-20", 180), p("2026-09-10", 190)];
  const com = pontosCtes(pontos, { medianas: [{ mes: "2026-08", valor: 175 }, { mes: "2026-09", valor: 190 }] });
  assert.equal((com.match(/<path class="mediana"/g) || []).length, 1);
  assert.equal((pontosCtes(pontos, {}).match(/class="mediana"/g) || []).length, 0);
});

test("rótulos do eixo y usam o formatador e sem dados devolve svg vazio", () => {
  assert.match(pontosCtes([p("2026-08-01", 100), p("2026-08-02", 200)], { formatar: v => "R$" + v }), />R\$\d+</);
  assert.ok(!/NaN/.test(pontosCtes([], {})));
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

