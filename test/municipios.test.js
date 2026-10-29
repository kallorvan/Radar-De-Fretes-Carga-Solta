// Sugestão de municípios na digitação da origem e do destino.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sugerirCidades, cidadeConhecida } from "../src/municipios.js";

test("sugere pelo começo do nome, sem acento e sem diferença de maiúscula", () => {
  const s = sugerirCidades("são joaq");
  assert.ok(s.includes("SAO JOAQUIM DA BARRA"), s.join());
  assert.deepEqual(s.slice(0, 2), ["SAO JOAQUIM", "SAO JOAQUIM DA BARRA"]);
  assert.equal(s.at(-1), "NOVO SAO JOAQUIM", "começo de palavra no meio vem depois");
});

test("começo do nome vem antes de começo de palavra no meio", () => {
  const s = sugerirCidades("joaquim", { limite: 20 });
  assert.ok(s.includes("JOAQUIM GOMES"));
  assert.ok(s.includes("SAO JOAQUIM DA BARRA"));
  assert.ok(s.indexOf("JOAQUIM GOMES") < s.indexOf("SAO JOAQUIM DA BARRA"));
});

test("limita a quantidade e não sugere nada com menos de 2 letras", () => {
  assert.equal(sugerirCidades("sa").length, 8);
  assert.equal(sugerirCidades("s").length, 0);
  assert.equal(sugerirCidades("").length, 0);
});

test("cidades da base entram nas sugestões e contam como conhecidas", () => {
  assert.ok(sugerirCidades("exte", { extras: ["EXTERIOR"] }).includes("EXTERIOR"));
  assert.equal(cidadeConhecida("Exterior", ["EXTERIOR"]), true);
  assert.equal(cidadeConhecida("Exterior"), false);
});

test("cidadeConhecida: município da lista sim, nome errado não", () => {
  assert.equal(cidadeConhecida("Guarujá"), true);
  assert.equal(cidadeConhecida("são joaquim da barra"), true);
  assert.equal(cidadeConhecida("Joaquim da Barra"), false);
  assert.equal(cidadeConhecida(""), true, "vazio não avisa");
});
