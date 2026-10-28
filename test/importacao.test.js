import { test } from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { novaBase, nomeDoCnpj } from "../src/base.js";
import { lerPlanilha, normalizarLinha, aplicarImportacao } from "../src/importacao.js";
import { gerarPlanilha, linhaPadrao } from "./fixtures/planilha.js";

const AGORA = "2026-10-28T12:00:00.000Z";
const tres = () => gerarPlanilha([linhaPadrao(1), linhaPadrao(2), linhaPadrao(3, { "QT. SACAS": 70, "PREÇO POR SACAS": 125 })]);

test("importa as linhas e cadastra os CNPJ", () => {
  const d = novaBase();
  const r = aplicarImportacao(d, lerPlanilha(XLSX, tres()), "Ana", AGORA);
  assert.equal(r.incluidos, 3);
  assert.equal(r.pulados, 0);
  assert.equal(r.rejeitados.length, 0);
  assert.equal(d.ctes[0].emissao, "2026-01-10");
  assert.equal(d.ctes[0].origemLancamento, "importacao");
  assert.equal(d.ctes[2].precoSaca, 125);
  assert.equal(nomeDoCnpj(d, "05780969000146"), "JF PEREIRA TRANSPORTES E SERVIÇOS LTDA");
  assert.equal(nomeDoCnpj(d, "44209336003583"), "USINA ALTA MOGIANA");
  assert.equal(r.cadastrados, 2);
  assert.equal(d.log.length, 1);
  assert.equal(d.log[0].acao, "importar");
});

test("pula chave repetida na segunda importação", () => {
  const d = novaBase();
  aplicarImportacao(d, lerPlanilha(XLSX, tres()), "Ana", AGORA);
  const r = aplicarImportacao(d, lerPlanilha(XLSX, tres()), "Ana", AGORA);
  assert.equal(r.incluidos, 0);
  assert.equal(r.pulados, 3);
  assert.equal(d.ctes.length, 3);
});

test("rejeita linha sem chave e sem sacas com o motivo", () => {
  const d = novaBase();
  const buf = gerarPlanilha([linhaPadrao(1, { "CHAVE DE ACESSO": null }), linhaPadrao(2, { "QT. SACAS": null }), linhaPadrao(3)]);
  const r = aplicarImportacao(d, lerPlanilha(XLSX, buf), "Ana", AGORA);
  assert.equal(r.incluidos, 1);
  assert.equal(r.rejeitados[0].numLinha, 2);
  assert.match(r.rejeitados[0].motivo, /Chave de acesso/);
  assert.equal(r.rejeitados[1].numLinha, 3);
  assert.match(r.rejeitados[1].motivo, /sacas/);
});

test("normalizarLinha aceita texto pt-BR e CNPJ numérico", () => {
  const r = normalizarLinha(linhaPadrao(1, {
    "VALOR DO FRETE": "8.750,00", "CNPJ DO CLIENTE": 44209336003583, "EMISSÃO CT-e": "13/01/2026",
    "TAXA DO SEGURO": "0,0005", "VPO": "SIM",
  }), 2);
  assert.equal(r.ok, true);
  assert.equal(r.campos.valorFrete, 8750);
  assert.equal(r.campos.cnpjCliente, "44209336003583");
  assert.equal(r.campos.emissao, "2026-01-13");
  assert.equal(r.campos.taxaSeguro, 0.0005);
  assert.equal(r.campos.vpo, true);
  assert.deepEqual(r.nomes, { transportador: "JF PEREIRA TRANSPORTES", cliente: "USINA ALTA MOGIANA" });
});

test("normalizarLinha converte número de série do Excel", () => {
  assert.equal(normalizarLinha(linhaPadrao(1, { "EMISSÃO CT-e": 46032 }), 2).campos.emissao, "2026-01-10");
  assert.equal(normalizarLinha(linhaPadrao(1, { "EMISSÃO CT-e": 46053.75 }), 2).campos.emissao, "2026-01-31");
});

test("divergência mantém o número da planilha", () => {
  const d = novaBase();
  const buf = gerarPlanilha([linhaPadrao(1, { "TARIFA DO FRETE": 8700, "PREÇO POR SACAS": 174 })]);
  const r = aplicarImportacao(d, lerPlanilha(XLSX, buf), "Ana", AGORA);
  assert.equal(r.divergentes, 1);
  assert.equal(d.ctes[0].tarifa, 8700);
  assert.equal(d.ctes[0].precoSaca, 174);
  assert.equal(d.ctes[0].divergencia.calculado.tarifa, 8750);
});

test("diferença de até 5 centavos não é divergência", () => {
  const d = novaBase();
  const r = aplicarImportacao(d, lerPlanilha(XLSX, gerarPlanilha([linhaPadrao(1, { "TARIFA DO FRETE": 8750.04 })])), "Ana", AGORA);
  assert.equal(r.divergentes, 0);
  assert.equal(d.ctes[0].tarifa, 8750);
});

test("planilha sem a aba base dá erro claro", () => {
  const r = lerPlanilha(XLSX, gerarPlanilha([], undefined, { semAbaBase: true }));
  assert.equal(r.erro, "A planilha não tem a aba BASE CARGA SOLTA 2026.");
});

test("importação com log cheio mantém o histórico anterior", async () => {
  const { registrar } = await import("../src/base.js");
  const d = novaBase();
  for (let i = 0; i < 500; i++) registrar(d, "cadastro", "Ana", AGORA, "", "x" + i);
  aplicarImportacao(d, lerPlanilha(XLSX, tres()), "Ana", AGORA);
  assert.equal(d.log.length, 500);
  assert.equal(d.log.at(-2).resumo, "x499");
  assert.equal(d.log.at(-1).acao, "importar");
});

test("exportarXlsx usa as colunas da planilha", async () => {
  const { exportarXlsx } = await import("../src/importacao.js");
  const d = novaBase();
  aplicarImportacao(d, lerPlanilha(XLSX, tres()), "Ana", AGORA);
  const buf = exportarXlsx(d, XLSX);
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  assert.deepEqual(wb.SheetNames, ["BASE CARGA SOLTA 2026", "BASE DE DADOS CNPJ"]);
  const cab = XLSX.utils.sheet_to_json(wb.Sheets["BASE CARGA SOLTA 2026"], { header: 1 })[0];
  assert.equal(cab[1], "N° CT-e");
  assert.equal(cab[16], "PREÇO POR SACAS");
  const d2 = novaBase();
  const r = aplicarImportacao(d2, lerPlanilha(XLSX, buf), "Ana", AGORA);
  assert.equal(r.incluidos, 3);
  assert.equal(r.divergentes, 0);
  assert.deepEqual(d2.ctes.map(c => [c.chave, c.emissao, c.precoSaca, c.cnpjCliente]), d.ctes.map(c => [c.chave, c.emissao, c.precoSaca, c.cnpjCliente]));
  assert.equal(nomeDoCnpj(d2, "05780969000146"), "JF PEREIRA TRANSPORTES E SERVIÇOS LTDA");
});
