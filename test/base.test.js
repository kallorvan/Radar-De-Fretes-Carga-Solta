import { test } from "node:test";
import assert from "node:assert/strict";
import {
  novaBase, validarCampos, incluir, corrigir, excluir, restaurar,
  cadastrarCnpj, nomeDoCnpj, grupoDoCnpj, registrar, migrarBase, classificar,
  cadastrarProduto, cadastrarUnidade, definirProdutoPadrao, unidadeDe, produtoDe,
} from "../src/base.js";
import { CHAVE, campos } from "./ajuda.js";

const AGORA = "2026-10-28T12:00:00.000Z";

test("incluir calcula e registra quem e quando", () => {
  const d = novaBase();
  const r = incluir(d, campos(), "Ana", AGORA);
  assert.equal(r.ok, true);
  assert.equal(r.cte.precoTonelada, 175);
  assert.equal(r.cte.pesoKg, 50000);
  assert.equal(r.cte.produto, "ACUCAR");
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

test("validarCampos exige quantidade, frete, produto e unidade", () => {
  const d = novaBase();
  const v = validarCampos(d, campos({ quantidade: 0, valorFrete: null, produto: "", unidade: "XYZ" }));
  assert.equal(v.ok, false);
  assert.equal(v.erros.quantidade, "Informe a quantidade.");
  assert.ok(v.erros.valorFrete);
  assert.equal(v.erros.produto, "Escolha o produto.");
  assert.equal(v.erros.unidade, "Escolha a unidade.");
  assert.equal(validarCampos(d, campos({ chave: "123" })).erros.chave, "Chave de acesso precisa ter 44 dígitos.");
  assert.equal(validarCampos(d, campos()).ok, true);
});

test("big bag exige peso", () => {
  const d = novaBase();
  assert.equal(validarCampos(d, campos({ unidade: "BAG" })).erros.pesoKg, "Informe o peso total do CT-e (kg).");
  assert.equal(validarCampos(d, campos({ unidade: "BAG", pesoKg: 30000 })).ok, true);
  assert.equal(validarCampos(d, campos({ pesoInformado: true, pesoKg: 0 })).erros.pesoKg, "Informe o peso total do CT-e (kg).");
});

test("listas iniciais e versão 2", () => {
  const d = novaBase();
  assert.equal(d.versao, 2);
  assert.deepEqual(unidadeDe(d, "SC60"), { id: "SC60", nome: "Saca 60 kg", kg: 60, saca: true });
  assert.equal(unidadeDe(d, "BAG").kg, null);
  assert.equal(produtoDe(d, "ACUCAR").nome, "Açúcar");
});

test("incluir com campos inválidos devolve erros e não grava", () => {
  const d = novaBase();
  const r = incluir(d, campos({ quantidade: 0 }), "Ana", AGORA);
  assert.equal(r.ok, false);
  assert.ok(r.erros.quantidade);
  assert.equal(d.ctes.length, 0);
});

test("corrigir recalcula e não troca a chave", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  const r = corrigir(d, CHAVE, campos({ chave: "9".repeat(44), quantidade: 70 }), "Bia", "2026-10-29T00:00:00.000Z");
  assert.equal(r.ok, true);
  assert.equal(r.cte.chave, CHAVE);
  assert.equal(r.cte.precoTonelada, 125);
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

test("migrarBase converte v1 sem perder nada", () => {
  const v1 = { versao: 1, salvoEm: "x", salvoPor: "Ana", cnpjs: [{ cnpj: "1", nome: "A" }], log: [{ acao: "incluir" }],
    ctes: [{ chave: "a", numero: 1, sacas: 50, tarifa: 8750, precoSaca: 175 }],
    lixeira: [{ cte: { chave: "b", numero: 2, sacas: 20, tarifa: 100, precoSaca: 5 }, excluidoPor: "Bia", excluidoEm: "y" }] };
  const d = migrarBase(v1);
  assert.equal(d.versao, 2);
  assert.equal(d.ctes.length, 1);
  assert.deepEqual([d.ctes[0].quantidade, d.ctes[0].produto, d.ctes[0].unidade, d.ctes[0].pesoKg, d.ctes[0].precoTonelada, d.ctes[0].precoSaca],
    [50, null, null, null, null, null]);
  assert.equal("sacas" in d.ctes[0], false);
  assert.equal(d.lixeira[0].cte.quantidade, 20);
  assert.equal(d.unidades.length, 4);
  assert.equal(d.produtos.length, 2);
  assert.equal(v1.versao, 1, "não muda o original");
  assert.deepEqual(migrarBase(d), d, "v2 fica igual");
});

test("classificar recalcula e registra", () => {
  const d = migrarBase({ versao: 1, ctes: [{ chave: "a", numero: 1, sacas: 540, valorFrete: 17353.56, valorSeguro: 0, adicionais: 0, tarifa: 17353.56, precoSaca: 32.14 }], cnpjs: [], lixeira: [], log: [] });
  const r = classificar(d, "a", { produto: "CAFE", unidade: "SC60" }, "Ana", AGORA);
  assert.equal(r.ok, true);
  assert.equal(d.ctes[0].precoTonelada, 535.6);
  assert.equal(d.ctes[0].precoSaca, 32.14);
  assert.equal(d.log.at(-1).acao, "classificar");
  assert.equal(classificar(d, "a", { produto: "CAFE", unidade: "BAG" }, "Ana", AGORA).ok, false, "big bag sem peso");
});

test("unidade em uso não muda de kg", () => {
  const d = novaBase();
  incluir(d, campos({ unidade: "SC60" }), "Ana", AGORA);
  assert.equal(cadastrarUnidade(d, { id: "SC60", nome: "Saca de 60 kg", kg: 60, saca: true }, "Ana", AGORA).ok, true);
  assert.equal(unidadeDe(d, "SC60").nome, "Saca de 60 kg");
  const r = cadastrarUnidade(d, { id: "SC60", nome: "Saca", kg: 50, saca: true }, "Ana", AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.erro, "Unidade em uso: crie outra para um peso diferente.");
  assert.equal(cadastrarUnidade(d, { id: "TON", nome: "Tonelada", kg: 900, saca: false }, "Ana", AGORA).ok, true, "TON não está em uso");
  const nova = cadastrarUnidade(d, { nome: "Fardo 200 kg", kg: 200, saca: false }, "Ana", AGORA);
  assert.equal(nova.id, "FARDO200KG");
});

test("cadastrarProduto gera id e renomeia", () => {
  const d = novaBase();
  const r = cadastrarProduto(d, { nome: "Algodão em pluma" }, "Ana", AGORA);
  assert.equal(r.id, "ALGODAOEMPLUMA");
  cadastrarProduto(d, { id: "ALGODAOEMPLUMA", nome: "Algodão" }, "Ana", AGORA);
  assert.equal(produtoDe(d, "ALGODAOEMPLUMA").nome, "Algodão");
  assert.equal(d.produtos.length, 3);
  assert.equal(d.log.at(-1).acao, "produto");
});

test("produto padrão do CNPJ", () => {
  const d = novaBase();
  cadastrarCnpj(d, "07668709000109", "EISA", "Ana", AGORA);
  definirProdutoPadrao(d, "07668709000109", "CAFE", "Ana", AGORA);
  assert.equal(d.cnpjs[0].produtoPadrao, "CAFE");
  definirProdutoPadrao(d, "07668709000109", null, "Ana", AGORA);
  assert.equal(d.cnpjs[0].produtoPadrao, null);
});
