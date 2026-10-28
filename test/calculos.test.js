import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularCte, normalizarCnpj, raizCnpj, ehMatriz, numeroDaChave, chaveValida,
  normalizarCidade, rotaDe, mesDe, numeroBR, arred2,
} from "../src/calculos.js";

test("calcularCte reproduz a planilha", () => {
  assert.deepEqual(calcularCte({ valorAssegurado: 917213.08, taxaSeguro: 0.0005, valorFrete: 29141.78, adicionais: 0, sacas: 666 }),
    { valorSeguro: 458.61, tarifa: 28683.17, precoSaca: 43.07 });
  assert.deepEqual(calcularCte({ valorAssegurado: 119322.29, taxaSeguro: 0, valorFrete: 8750, adicionais: 0, sacas: 50 }),
    { valorSeguro: 0, tarifa: 8750, precoSaca: 175 });
});
test("sacas zeradas ou vazias dão precoSaca null", () => {
  assert.equal(calcularCte({ valorAssegurado: 1, taxaSeguro: 0, valorFrete: 100, adicionais: 0, sacas: 0 }).precoSaca, null);
  assert.equal(calcularCte({ valorAssegurado: 1, taxaSeguro: 0, valorFrete: 100, adicionais: 0, sacas: null }).precoSaca, null);
});
test("arred2 arredonda meio para cima", () => {
  assert.equal(arred2(1.005), 1.01);
  assert.equal(arred2(458.6065), 458.61);
});
test("normalizarCnpj recompõe zeros e aceita máscara", () => {
  assert.equal(normalizarCnpj(7668709000109), "07668709000109");
  assert.equal(normalizarCnpj("07.668.709/0001-09"), "07668709000109");
  assert.equal(normalizarCnpj(""), "");
  assert.equal(normalizarCnpj(null), "");
});
test("raiz e matriz", () => {
  assert.equal(raizCnpj("07668709000290"), "07668709");
  assert.equal(ehMatriz("07668709000109"), true);
  assert.equal(ehMatriz("07668709000290"), false);
});
test("numeroDaChave", () => {
  assert.equal(numeroDaChave("35260105780969000146570010000106001000120718"), 10600);
  assert.equal(numeroDaChave("123"), null);
  assert.equal(chaveValida("3526"), false);
  assert.equal(chaveValida("35260105780969000146570010000106001000120718"), true);
});
test("cidade, rota e mês", () => {
  assert.equal(normalizarCidade("  São  Joaquim da Barra "), "SAO JOAQUIM DA BARRA");
  assert.equal(rotaDe({ origem: "Cacoal", destino: "santos" }), "CACOAL → SANTOS");
  assert.equal(mesDe("2026-01-10"), "2026-01");
});
test("numeroBR", () => {
  assert.equal(numeroBR("1.234,56"), 1234.56);
  assert.equal(numeroBR(1234.56), 1234.56);
  assert.equal(numeroBR("1234.56"), 1234.56);
  assert.equal(numeroBR("0,0005"), 0.0005);
  assert.equal(numeroBR(""), null);
  assert.equal(numeroBR(null), null);
  assert.equal(numeroBR("abc"), null);
});
