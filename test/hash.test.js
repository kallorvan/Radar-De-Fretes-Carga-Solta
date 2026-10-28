import { test } from "node:test";
import assert from "node:assert/strict";
import { lerHash, escreverHash } from "../src/hash.js";

test("hash ida e volta com acento e seta", () => {
  const h = escreverHash("evolucao", { rota: "SAO JOAQUIM DA BARRA → SANTOS", metrica: "tarifa", transportador: "" });
  assert.equal(h, "#evolucao?rota=SAO%20JOAQUIM%20DA%20BARRA%20%E2%86%92%20SANTOS&metrica=tarifa");
  assert.deepEqual(lerHash(h), { aba: "evolucao", filtros: { rota: "SAO JOAQUIM DA BARRA → SANTOS", metrica: "tarifa" } });
});
test("hash vazio ou desconhecido cai na evolução com métrica saca", () => {
  assert.deepEqual(lerHash(""), { aba: "evolucao", filtros: { metrica: "saca" } });
  assert.deepEqual(lerHash("#xpto?metrica=abc"), { aba: "evolucao", filtros: { metrica: "saca" } });
  assert.equal(escreverHash("rotas", { metrica: "saca" }), "#rotas");
});
