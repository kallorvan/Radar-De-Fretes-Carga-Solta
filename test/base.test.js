import { test } from "node:test";
import assert from "node:assert/strict";
import {
  novaBase, validarCampos, incluir, corrigir, excluir, restaurar,
  cadastrarCnpj, nomeDoCnpj, grupoDoCnpj, registrar,
} from "../src/base.js";
import { CHAVE, campos } from "./ajuda.js";

const AGORA = "2026-10-28T12:00:00.000Z";

test("incluir calcula e registra quem e quando", () => {
  const d = novaBase();
  const r = incluir(d, campos(), "Ana", AGORA);
  assert.equal(r.ok, true);
  assert.equal(r.cte.precoSaca, 175);
  assert.equal(r.cte.tarifa, 8750);
  assert.equal(r.cte.origem, "SAO JOAQUIM DA BARRA");
  assert.equal(r.cte.criadoPor, "Ana");
  assert.equal(r.cte.criadoEm, AGORA);
  assert.equal(r.cte.origemLancamento, "formulario");
  assert.equal(d.ctes.length, 1);
  assert.equal(d.log.at(-1).acao, "incluir");
  assert.equal(d.log.at(-1).quem, "Ana");
});

test("incluir bloqueia chave repetida e devolve o existente", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  const r = incluir(d, campos({ valorFrete: 1 }), "Bia", AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.existente.numero, 10600);
  assert.equal(d.ctes.length, 1);
});

test("chave na lixeira também bloqueia", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  excluir(d, CHAVE, "Ana", AGORA);
  const r = incluir(d, campos(), "Ana", AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.naLixeira, true);
});

test("validarCampos exige sacas e frete", () => {
  const v = validarCampos(campos({ sacas: 0, valorFrete: null }));
  assert.equal(v.ok, false);
  assert.ok(v.erros.sacas);
  assert.ok(v.erros.valorFrete);
  assert.equal(validarCampos(campos({ chave: "123" })).erros.chave, "Chave de acesso precisa ter 44 dígitos.");
  assert.equal(validarCampos(campos()).ok, true);
});

test("incluir com campos inválidos devolve erros e não grava", () => {
  const d = novaBase();
  const r = incluir(d, campos({ sacas: 0 }), "Ana", AGORA);
  assert.equal(r.ok, false);
  assert.ok(r.erros.sacas);
  assert.equal(d.ctes.length, 0);
});

test("corrigir recalcula e não troca a chave", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  const r = corrigir(d, CHAVE, campos({ chave: "9".repeat(44), sacas: 70 }), "Bia", "2026-10-29T00:00:00.000Z");
  assert.equal(r.ok, true);
  assert.equal(r.cte.chave, CHAVE);
  assert.equal(r.cte.precoSaca, 125);
  assert.equal(r.cte.criadoPor, "Ana");
  assert.equal(r.cte.alteradoPor, "Bia");
  assert.equal(d.log.at(-1).acao, "corrigir");
});

test("excluir manda para a lixeira e restaurar devolve", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  assert.equal(excluir(d, CHAVE, "Bia", AGORA).ok, true);
  assert.equal(d.ctes.length, 0);
  assert.equal(d.lixeira[0].excluidoPor, "Bia");
  assert.equal(restaurar(d, CHAVE, "Caio", AGORA).ok, true);
  assert.equal(d.ctes.length, 1);
  assert.equal(d.lixeira.length, 0);
  assert.deepEqual(d.log.map(l => l.acao), ["incluir", "excluir", "restaurar"]);
});

test("grupo usa o nome da matriz e junta filiais", () => {
  const d = novaBase();
  cadastrarCnpj(d, "07668709000290", "atma filial ", "Ana", AGORA);
  cadastrarCnpj(d, "07.668.709/0001-09", "ATMA LOGISTICA", "Ana", AGORA);
  assert.equal(nomeDoCnpj(d, "07668709000290"), "ATMA FILIAL");
  assert.deepEqual(grupoDoCnpj(d, "07668709000290"), { raiz: "07668709", nome: "ATMA LOGISTICA" });
  assert.deepEqual(grupoDoCnpj(d, "11111111000100"), { raiz: "11111111", nome: "CNPJ 11.111.111/0001-00" });
});

test("cadastrar renomeia sem duplicar", () => {
  const d = novaBase();
  cadastrarCnpj(d, "07668709000109", "A", "Ana", AGORA);
  cadastrarCnpj(d, "07668709000109", "B", "Ana", AGORA);
  assert.equal(d.cnpjs.length, 1);
  assert.equal(nomeDoCnpj(d, "07668709000109"), "B");
});

test("log guarda só as 500 últimas", () => {
  const d = novaBase();
  for (let i = 0; i < 510; i++) registrar(d, "cadastro", "Ana", AGORA, "", "x" + i);
  assert.equal(d.log.length, 500);
  assert.equal(d.log[0].resumo, "x10");
});
