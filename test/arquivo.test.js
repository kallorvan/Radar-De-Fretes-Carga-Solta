import { test } from "node:test";
import assert from "node:assert/strict";
import { novaBase, incluir, excluir, corrigir, cadastrarCnpj } from "../src/base.js";
import { lerDadosJs, montarDadosJs, nomeBackup, ehBackup, podar, novaSessao, juntar, resumoConflito, MARCA } from "../src/arquivo.js";
import { campos, chaveN } from "./ajuda.js";

const AGORA = "2026-10-28T12:00:00.000Z";
const clone = o => JSON.parse(JSON.stringify(o));

test("montarDadosJs e lerDadosJs fazem ida e volta", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  d.salvoEm = AGORA;
  const txt = montarDadosJs(d);
  assert.ok(txt.includes(MARCA));
  assert.match(txt, /Não edite à mão/);
  assert.deepEqual(lerDadosJs(txt), d);
});

test("montarDadosJs escapa </", () => {
  const d = novaBase();
  incluir(d, campos({ observacoes: "x</script><b>" }), "Ana", AGORA);
  const txt = montarDadosJs(d);
  assert.ok(!txt.includes("</script>"));
  assert.equal(lerDadosJs(txt).ctes[0].observacoes, "x</script><b>");
});

test("lerDadosJs rejeita texto sem marca ou sem ctes", () => {
  assert.equal(lerDadosJs("window.OUTRO={}"), null);
  assert.equal(lerDadosJs(MARCA + "{quebrado"), null);
  assert.equal(lerDadosJs(MARCA + '{"ctes":1};'), null);
});

test("nome de backup e poda mantêm os 60 mais novos", () => {
  const nome = nomeBackup("2026-10-28T14:03:11.000Z");
  assert.match(nome, /^radar-carga-solta-dados 2026-10-28 \d\dh03m11s\.js$/);
  assert.equal(ehBackup(nome), true);
  assert.equal(ehBackup("outro.js"), false);
  const nomes = Array.from({ length: 62 }, (_, i) => `radar-carga-solta-dados 2026-01-${String(i % 28 + 1).padStart(2, "0")} ${String(Math.floor(i / 28)).padStart(2, "0")}h00m00s.js`);
  const sai = podar(nomes);
  assert.equal(sai.length, 2);
  assert.deepEqual(sai, [...nomes].sort().slice(0, 2));
});

test("juntar preserva lançamento do outro e exclusão local", () => {
  const inicial = novaBase();
  incluir(inicial, campos({ chave: chaveN(1), numero: 1 }), "Ana", AGORA);   // Y
  inicial.salvoEm = "2026-10-28T10:00:00.000Z";
  // outra pessoa lança X e grava
  const arquivo = clone(inicial);
  incluir(arquivo, campos({ chave: chaveN(2), numero: 2 }), "Bia", AGORA);
  arquivo.salvoEm = "2026-10-28T11:00:00.000Z";
  // esta página exclui Y e lança Z
  const tela = clone(inicial), s = novaSessao();
  const antes = tela.log.length;
  excluir(tela, chaveN(1), "Caio", AGORA); s.excluidos.add(chaveN(1));
  incluir(tela, campos({ chave: chaveN(3), numero: 3 }), "Caio", AGORA); s.alterados.add(chaveN(3));
  s.log.push(...tela.log.slice(antes));
  const r = juntar(arquivo, tela, s);
  assert.deepEqual(r.ctes.map(c => c.numero).sort(), [2, 3]);
  assert.deepEqual(r.lixeira.map(l => l.cte.numero), [1]);
  assert.deepEqual(r.log.map(l => l.quem), ["Ana", "Bia", "Caio", "Caio"]);
  assert.equal(r.salvoEm, arquivo.salvoEm);
});

test("juntar aplica correção local sobre o arquivo", () => {
  const arquivo = novaBase();
  incluir(arquivo, campos({ chave: chaveN(1), numero: 1 }), "Ana", AGORA);
  const tela = clone(arquivo), s = novaSessao();
  corrigir(tela, chaveN(1), campos({ quantidade: 70 }), "Bia", AGORA); s.alterados.add(chaveN(1));
  cadastrarCnpj(tela, "07668709000109", "ATMA", "Bia", AGORA); s.cadastro.set("07668709000109", "ATMA");
  const r = juntar(arquivo, tela, s);
  assert.equal(r.ctes.length, 1);
  assert.equal(r.ctes[0].precoTonelada, 125);
  assert.deepEqual(r.cnpjs, [{ cnpj: "07668709000109", nome: "ATMA" }]);
});

test("resumoConflito conta o que mudou", () => {
  const arquivo = novaBase();
  incluir(arquivo, campos({ chave: chaveN(2), numero: 2 }), "Bia", AGORA);
  arquivo.salvoEm = "2026-10-28T11:00:00.000Z"; arquivo.salvoPor = "Bia";
  const tela = novaBase(), s = novaSessao();
  incluir(tela, campos({ chave: chaveN(3), numero: 3 }), "Caio", AGORA); s.alterados.add(chaveN(3));
  const txt = resumoConflito(arquivo, tela, s);
  assert.match(txt, /Bia/);
  assert.match(txt, /1 CT-e que você não tem na tela/);
  assert.match(txt, /1 alteração/);
});
