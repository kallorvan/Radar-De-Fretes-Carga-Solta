import { test } from "node:test";
import assert from "node:assert/strict";
import { migrarBase, cadastrarCnpj } from "../src/base.js";
import { sugerirProdutoCliente, semeiaProdutosPadrao, sugerirClassificacao, pendentesDeClassificacao } from "../src/classificacao.js";

const AGORA = "2026-10-28T12:00:00.000Z";
const USINA = "44209336003583", EISA = "11111111000100", COLOMBARI = "22222222000100";

/* Base v1 com os casos reais do adendo. */
function baseV1() {
  const cte = (n, cli, quantidade, valorFrete) => ({ chave: String(n).padStart(44, "0"), numero: n, emissao: "2026-07-01", cnpjCliente: cli,
    cnpjTransportador: "99999999000100", origem: "A", destino: "B", valorAssegurado: 0, taxaSeguro: 0, valorSeguro: 0, adicionais: 0,
    valorFrete, tarifa: valorFrete, sacas: quantidade, precoSaca: valorFrete / quantidade });
  const d = migrarBase({ versao: 1, corte: null, cnpjs: [], lixeira: [], log: [], ctes: [
    cte(1, USINA, 50, 8750), cte(2, USINA, 1080, 9612), cte(3, EISA, 20, 10836.81), cte(4, EISA, 540, 17353.56), cte(5, COLOMBARI, 50, 6900)] });
  cadastrarCnpj(d, USINA, "USINA ALTA MOGIANA S/A", "Ana", AGORA);
  cadastrarCnpj(d, EISA, "EISA", "Ana", AGORA);
  cadastrarCnpj(d, COLOMBARI, "COLOMBARI SERVIÇOS DE TRANSPORTES LTDA", "Ana", AGORA);
  return d;
}

test("produto pelo nome do cliente", () => {
  assert.equal(sugerirProdutoCliente("USINA ALTA MOGIANA S/A"), "ACUCAR");
  assert.equal(sugerirProdutoCliente("U.S.J AÇUCAR E ALCOOL S/A"), "ACUCAR");
  assert.equal(sugerirProdutoCliente("COPLASA - AÇUCAR E ALCOOL LTDA"), "ACUCAR");
  assert.equal(sugerirProdutoCliente("EISA"), "CAFE");
  assert.equal(sugerirProdutoCliente("LOUIS DREYFUS"), "CAFE");
  assert.equal(sugerirProdutoCliente("UNICAFE COMPANHIA"), "CAFE");
  assert.equal(sugerirProdutoCliente("COLOMBARI SERVIÇOS DE TRANSPORTES LTDA"), null);
});

test("semeia produto padrão só onde falta", () => {
  const d = baseV1();
  d.cnpjs.find(c => c.cnpj === EISA).produtoPadrao = "ACUCAR";   // escolha do usuário fica
  const logAntes = d.log.length;
  assert.equal(semeiaProdutosPadrao(d), 1);
  assert.equal(d.cnpjs.find(c => c.cnpj === USINA).produtoPadrao, "ACUCAR");
  assert.equal(d.cnpjs.find(c => c.cnpj === EISA).produtoPadrao, "ACUCAR");
  assert.equal(d.cnpjs.find(c => c.cnpj === COLOMBARI).produtoPadrao ?? null, null);
  assert.equal(d.log.length, logAntes);
});

test("sugestões batem com os casos reais", () => {
  const d = baseV1(); semeiaProdutosPadrao(d);
  const s = n => sugerirClassificacao(d, d.ctes.find(c => c.numero === n));
  assert.deepEqual([s(1).produto, s(1).unidade, s(1).precoTonelada], ["ACUCAR", "TON", 175]);
  assert.deepEqual([s(2).produto, s(2).unidade, s(2).pesoKg, s(2).precoTonelada], ["ACUCAR", "SC50", 54000, 178]);
  assert.deepEqual([s(3).produto, s(3).unidade], ["CAFE", "TON"]);
  assert.deepEqual([s(4).produto, s(4).unidade, s(4).precoTonelada], ["CAFE", "SC60", 535.6]);
  assert.deepEqual([s(5).produto, s(5).unidade, s(5).precoTonelada], [null, null, null]);
  assert.match(s(5).motivo, /sem produto padrão/);
  assert.match(s(4).motivo, /saca 60 kg/i);
});

test("pendentes são os sem produto ou unidade", () => {
  const d = baseV1();
  assert.equal(pendentesDeClassificacao(d).length, 5);
  d.ctes[0].produto = "ACUCAR"; d.ctes[0].unidade = "TON";
  assert.equal(pendentesDeClassificacao(d).length, 4);
});

test("produto padrão limpo de propósito não volta", () => {
  const d = baseV1();
  d.cnpjs.find(c => c.cnpj === USINA).produtoPadrao = null;
  semeiaProdutosPadrao(d);
  assert.equal(d.cnpjs.find(c => c.cnpj === USINA).produtoPadrao, null);
});
