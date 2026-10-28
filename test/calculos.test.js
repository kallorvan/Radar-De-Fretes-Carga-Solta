import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularCte, normalizarCnpj, raizCnpj, ehMatriz, numeroDaChave, chaveValida,
  normalizarCidade, rotaDe, mesDe, numeroBR, arred2,
} from "../src/calculos.js";

const SC60 = { kg: 60, saca: true }, TON = { kg: 1000, saca: false }, BAG = { kg: null, saca: false };

test("calcularCte reproduz a planilha, com o seguro informado e a taxa calculada", () => {
  assert.deepEqual(calcularCte({ valorAssegurado: 917213.08, valorSeguro: 458.61, valorFrete: 29141.78, adicionais: 0, quantidade: 666, unidade: SC60 }),
    { taxaSeguro: 0.0005, valorSeguro: 458.61, tarifa: 28683.17, pesoKg: 39960, precoTonelada: 717.8, precoSaca: 43.07 });
});
test("calcularCte por tonelada e por saca", () => {
  assert.deepEqual(calcularCte({ valorAssegurado: 0, valorSeguro: 0, valorFrete: 17353.56, adicionais: 0, quantidade: 540, unidade: SC60 }),
    { taxaSeguro: null, valorSeguro: 0, tarifa: 17353.56, pesoKg: 32400, precoTonelada: 535.6, precoSaca: 32.14 });
  assert.deepEqual(calcularCte({ valorAssegurado: 119322.29, valorSeguro: 0, valorFrete: 8750, adicionais: 0, quantidade: 50, unidade: TON }),
    { taxaSeguro: 0, valorSeguro: 0, tarifa: 8750, pesoKg: 50000, precoTonelada: 175, precoSaca: null });
});
test("seguro sem valor assegurado: taxa vazia e tarifa sem o seguro", () => {
  const r = calcularCte({ valorAssegurado: 0, valorSeguro: 100, valorFrete: 1000, adicionais: 0, quantidade: 1, unidade: TON });
  assert.equal(r.taxaSeguro, null);
  assert.equal(r.tarifa, 900);
  assert.equal(calcularCte({ valorFrete: 1000, quantidade: 1, unidade: TON }).valorSeguro, 0, "seguro vazio = 0");
});
test("peso informado vale sobre a unidade", () => {
  const r = calcularCte({ valorFrete: 10000, quantidade: 20, unidade: TON, pesoKg: 25000, pesoInformado: true });
  assert.equal(r.pesoKg, 25000);
  assert.equal(r.precoTonelada, 400);
});
test("sem peso dá precoTonelada null", () => {
  assert.equal(calcularCte({ valorFrete: 100, quantidade: 3, unidade: BAG }).precoTonelada, null);
  assert.equal(calcularCte({ valorFrete: 100, quantidade: 3, unidade: null }).precoTonelada, null);
  assert.equal(calcularCte({ valorFrete: 100, quantidade: 3, unidade: BAG, pesoKg: 0, pesoInformado: true }).precoTonelada, null);
});
test("quantidade zerada ou vazia dá preços null", () => {
  const r = calcularCte({ valorFrete: 100, quantidade: 0, unidade: SC60 });
  assert.equal(r.precoSaca, null); assert.equal(r.precoTonelada, null);
  assert.equal(calcularCte({ valorFrete: 100, quantidade: null, unidade: SC60 }).precoSaca, null);
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
  assert.equal(numeroBR("8.750"), 8750);
  assert.equal(numeroBR("1.080"), 1080);
  assert.equal(numeroBR("1.234.567"), 1234567);
  assert.equal(numeroBR("0.0005"), 0.0005);
  assert.equal(numeroBR("12.5"), 12.5);
});
