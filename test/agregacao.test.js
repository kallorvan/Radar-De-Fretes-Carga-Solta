import { test } from "node:test";
import assert from "node:assert/strict";
import { novaBase, incluir, cadastrarCnpj } from "../src/base.js";
import {
  mediana, filtrar, mesesEntre, valorMetrica, serieMensal, resumoGeral, resumoRotas,
  transportadoresNaRota, excecoes,
} from "../src/agregacao.js";
import { campos, chaveN } from "./ajuda.js";

const AGORA = "2026-10-28T12:00:00.000Z";
const T1 = "11111111000100", T1F = "11111111000290", T2 = "22222222000100", T3 = "33333333000100";
let seq = 0;
function lanca(d, extra) {
  const r = incluir(d, campos({ chave: chaveN(++seq), numero: seq, origem: "A", destino: "B", ...extra }), "Ana", AGORA);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  return r.cte;
}
/* Rota A→B, 3 transportadores, meses 01, 02 e 04 (março vazio). Preço = frete/50. */
function baseAB() {
  const d = novaBase();
  for (const [c, n] of [[T1, "UM"], [T2, "DOIS"], [T3, "TRES"], [T1F, "UM FILIAL"]]) cadastrarCnpj(d, c, n, "Ana", AGORA);
  lanca(d, { cnpjTransportador: T1, emissao: "2026-01-05", valorFrete: 8750 });   // 175
  lanca(d, { cnpjTransportador: T1F, emissao: "2026-01-20", valorFrete: 9250 });  // 185 (filial)
  lanca(d, { cnpjTransportador: T2, emissao: "2026-01-10", valorFrete: 8500 });   // 170
  lanca(d, { cnpjTransportador: T1, emissao: "2026-02-10", valorFrete: 9000 });   // 180
  lanca(d, { cnpjTransportador: T3, emissao: "2026-02-11", valorFrete: 8000 });   // 160
  lanca(d, { cnpjTransportador: T1, emissao: "2026-04-02", valorFrete: 9500 });   // 190
  return d;
}

test("mediana de pares e ímpares", () => {
  assert.equal(mediana([1, 3]), 2);
  assert.equal(mediana([9, 1, 2]), 2);
  assert.equal(mediana([]), null);
});

test("mesesEntre é inclusivo e atravessa o ano", () => {
  assert.deepEqual(mesesEntre("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("filtrar por rota, raiz e período", () => {
  const d = baseAB();
  lanca(d, { cnpjTransportador: T1, emissao: "2026-01-05", origem: "C", destino: "B" });
  assert.equal(filtrar(d, { rota: "A → B" }).length, 6);
  assert.equal(filtrar(d, { rota: "A → B", transportador: "11111111" }).length, 4);
  assert.equal(filtrar(d, { rota: "A → B", mesIni: "2026-02", mesFim: "2026-02" }).length, 2);
  assert.equal(filtrar(d, { cliente: "44209336" }).length, 7);
  assert.equal(filtrar(d, { itinerario: "XYZ" }).length, 0);
});

test("serieMensal agrupa filiais na mesma série", () => {
  const d = baseAB();
  const s = serieMensal(d, filtrar(d, { rota: "A → B" }), "saca");
  assert.deepEqual(s.meses, ["2026-01", "2026-02", "2026-03", "2026-04"]);
  assert.equal(s.series.length, 3);
  const um = s.series[0];
  assert.equal(um.nome, "UM");
  assert.equal(um.n, 4);
  assert.deepEqual(um.pontos["2026-01"], { mediana: 180, min: 175, max: 185, n: 2 });
  assert.equal(um.pontos["2026-03"], undefined);
});

test("variacao pula meses vazios", () => {
  const d = baseAB();
  const r = resumoGeral(filtrar(d, { rota: "A → B" }), "saca");
  assert.equal(r.ultimoMes, "2026-04");
  assert.equal(r.valor, 190);
  assert.equal(r.mesAnterior, "2026-02");
  assert.equal(r.variacao, 190 / 170 - 1);
  assert.equal(r.nCtes, 6);
  assert.equal(r.nSacas, 300);
  assert.equal(r.nTransportadores, 3);
  assert.equal(r.nRotas, 1);
});

test("resumoGeral sem dados não quebra", () => {
  const r = resumoGeral([], "saca");
  assert.equal(r.valor, null);
  assert.equal(r.variacao, null);
  assert.equal(r.nCtes, 0);
});

test("sem sacas fica fora da métrica saca e dentro da tarifa", () => {
  const d = baseAB();
  const cte = lanca(d, { cnpjTransportador: T2, emissao: "2026-04-03", valorFrete: 7000 });
  cte.sacas = 0; cte.precoSaca = null;
  assert.equal(valorMetrica(cte, "saca"), null);
  assert.equal(valorMetrica(cte, "tarifa"), 7000);
  const ctes = filtrar(d, { rota: "A → B" });
  const dois = s => s.series.find(x => x.raiz === "22222222");
  assert.equal(dois(serieMensal(d, ctes, "saca")).pontos["2026-04"], undefined);
  assert.equal(dois(serieMensal(d, ctes, "tarifa")).pontos["2026-04"].mediana, 7000);
});

test("resumoRotas ordena por CT-e e traz porMes", () => {
  const d = baseAB();
  lanca(d, { cnpjTransportador: T1, emissao: "2026-01-05", origem: "C", destino: "B" });
  const r = resumoRotas(d, "saca");
  assert.equal(r[0].rota, "A → B");
  assert.equal(r[0].nCtes, 6);
  assert.equal(r[0].nTransportadores, 3);
  assert.equal(r[0].valor, 190);
  assert.equal(r[0].porMes["2026-02"], 170);
  assert.equal(r[1].rota, "C → B");
});

test("transportadoresNaRota", () => {
  const d = baseAB();
  const t = transportadoresNaRota(d, filtrar(d, { rota: "A → B" }), "saca");
  const um = t.find(x => x.raiz === "11111111");
  assert.equal(um.nCtes, 4);
  assert.deepEqual(um.ultimo, { valor: 190, emissao: "2026-04-02" });
  assert.equal(um.mediana, 182.5);
  assert.equal(um.variacao, 190 / 180 - 1);
  assert.equal(t.find(x => x.raiz === "33333333").variacao, null);
});

test("excecao preço fora só com 3 ou mais na rota", () => {
  const d = novaBase();
  cadastrarCnpj(d, T1, "UM", "Ana", AGORA); cadastrarCnpj(d, "44209336003583", "CLI", "Ana", AGORA);
  lanca(d, { cnpjTransportador: T1, valorFrete: 8750 });
  lanca(d, { cnpjTransportador: T1, valorFrete: 45000 });
  assert.equal(excecoes(d).filter(e => e.tipo === "preco-fora").length, 0);
  lanca(d, { cnpjTransportador: T1, valorFrete: 8500 });
  lanca(d, { cnpjTransportador: T1, valorFrete: 9000 });
  const fora = excecoes(d).filter(e => e.tipo === "preco-fora");
  assert.equal(fora.length, 1);
  assert.equal(fora[0].cte.precoSaca, 900);
});

test("excecao sem cadastro e sem sacas", () => {
  const d = novaBase();
  cadastrarCnpj(d, T1, "UM", "Ana", AGORA);
  const c = lanca(d, { cnpjTransportador: T1 });
  c.sacas = 0; c.precoSaca = null;
  const ex = excecoes(d);
  assert.deepEqual(ex.filter(e => e.tipo === "sem-cadastro").map(e => e.cnpj), ["44209336003583"]);
  assert.equal(ex.filter(e => e.tipo === "sem-sacas").length, 1);
});

test("excecao diverge-planilha vem da marca do CT-e", () => {
  const d = novaBase();
  const c = lanca(d, { cnpjTransportador: T1 });
  c.divergencia = { calculado: { tarifa: 8750 }, planilha: { tarifa: 8700 } };
  assert.equal(excecoes(d).filter(e => e.tipo === "diverge-planilha").length, 1);
});
