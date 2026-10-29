// Esvaziar a lixeira: os CT-e saem de vez, com registro, e a junção com o arquivo não os traz de volta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { novaBase, incluir, excluir, esvaziarLixeira } from "../src/base.js";
import { novaSessao, sessaoVazia, juntar } from "../src/arquivo.js";
import * as A from "../src/acoes.js";
import { campos, chaveN } from "./ajuda.js";

const AGORA = "2026-10-29T12:00:00.000Z";
const clone = o => JSON.parse(JSON.stringify(o));
function baseComLixo() {
  const d = novaBase();
  for (const n of [1, 2, 3]) incluir(d, campos({ chave: chaveN(n), numero: n }), "Ana", AGORA);
  excluir(d, chaveN(1), "Ana", AGORA); excluir(d, chaveN(2), "Ana", AGORA);
  return d;
}

test("esvaziarLixeira apaga tudo da lixeira e registra quantos", () => {
  const d = baseComLixo();
  const r = esvaziarLixeira(d, "Bia", AGORA);
  assert.equal(r.ok, true);
  assert.deepEqual(r.chaves.sort(), [chaveN(1), chaveN(2)].sort());
  assert.equal(d.lixeira.length, 0);
  assert.deepEqual(d.ctes.map(c => c.numero), [3], "a base não muda");
  assert.equal(d.log.at(-1).acao, "esvaziar-lixeira");
  assert.equal(d.log.at(-1).quem, "Bia");
  assert.match(d.log.at(-1).resumo, /2 CT-e/);
  assert.equal(esvaziarLixeira(d, "Bia", AGORA).ok, false, "lixeira vazia: nada a fazer");
});

test("na sessão, os apagados contam como alteração", () => {
  const d = baseComLixo(), s = novaSessao();
  A.esvaziarLixeira(d, s, "Bia", AGORA);
  assert.deepEqual([...s.apagados].sort(), [chaveN(1), chaveN(2)].sort());
  assert.equal(sessaoVazia({ ...novaSessao(), apagados: new Set(["x"]) }), false);
});

test("juntar: o que esta página apagou some da lixeira do arquivo; o que outra pessoa excluiu depois fica", () => {
  const inicial = baseComLixo();
  const arquivo = clone(inicial);
  excluir(arquivo, chaveN(3), "Caio", AGORA);           // outra pessoa exclui o 3 e grava
  const tela = clone(inicial), s = novaSessao();
  A.esvaziarLixeira(tela, s, "Bia", AGORA);
  const r = juntar(arquivo, tela, s);
  assert.deepEqual(r.lixeira.map(l => l.cte.numero), [3]);
  assert.deepEqual(r.ctes.map(c => c.numero), []);
});

test("juntar: CT-e apagado da lixeira que outra pessoa restaurou continua na base", () => {
  const inicial = baseComLixo();
  const arquivo = clone(inicial);
  const i = arquivo.lixeira.findIndex(l => l.cte.chave === chaveN(1));
  arquivo.ctes.push(arquivo.lixeira.splice(i, 1)[0].cte);   // outra pessoa restaurou o 1
  const tela = clone(inicial), s = novaSessao();
  A.esvaziarLixeira(tela, s, "Bia", AGORA);
  const r = juntar(arquivo, tela, s);
  assert.ok(r.ctes.some(c => c.chave === chaveN(1)), "restaurado por outra pessoa não se perde");
  assert.equal(r.lixeira.length, 0);
});
