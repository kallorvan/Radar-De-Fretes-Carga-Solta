import { test } from "node:test";
import assert from "node:assert/strict";
import { novaBase, incluir, excluir, corrigir, cadastrarCnpj, cadastrarProduto, cadastrarUnidade, definirProdutoPadrao } from "../src/base.js";
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
  cadastrarCnpj(tela, "07668709000109", "ATMA", "Bia", AGORA); s.cadastro.set("07668709000109", { cnpj: "07668709000109", nome: "ATMA" });
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

test("lerDadosJs devolve a base migrada", () => {
  const txt = MARCA + JSON.stringify({ versao: 1, ctes: [{ chave: "a", sacas: 10 }], cnpjs: [], lixeira: [], log: [] }) + ";";
  const d = lerDadosJs(txt);
  assert.equal(d.versao, 2);
  assert.equal(d.ctes[0].quantidade, 10);
  assert.equal(d.unidades.length, 4);
});

test("juntar com arquivo v1 migra antes", () => {
  const v1 = { versao: 1, salvoEm: "x", ctes: [{ chave: "z", numero: 9, sacas: 30 }], cnpjs: [], lixeira: [], log: [] };
  const tela = novaBase(), s = novaSessao();
  incluir(tela, campos({ chave: chaveN(1), numero: 1 }), "Ana", AGORA); s.alterados.add(chaveN(1));
  const r = juntar(v1, tela, s);
  assert.equal(r.versao, 2);
  assert.equal(r.ctes.find(c => c.numero === 9).quantidade, 30);
  assert.equal(r.ctes.find(c => c.numero === 1).produto, "ACUCAR");
});

test("juntar une produtos e unidades", () => {
  const arquivo = novaBase();
  cadastrarProduto(arquivo, { nome: "Milho" }, "Bia", AGORA);                 // da outra pessoa
  const tela = novaBase(), s = novaSessao();
  const p = cadastrarProduto(tela, { nome: "Soja" }, "Ana", AGORA); s.listas.set("produto:" + p.id, p.produto);
  const u = cadastrarUnidade(tela, { nome: "Fardo 200 kg", kg: 200, saca: false }, "Ana", AGORA); s.listas.set("unidade:" + u.id, u.unidade);
  const r = juntar(arquivo, tela, s);
  assert.deepEqual(r.produtos.map(x => x.id).sort(), ["ACUCAR", "CAFE", "MILHO", "SOJA"]);
  assert.ok(r.unidades.some(x => x.id === "FARDO200KG" && x.kg === 200));
});

test("juntar preserva o produto padrão do arquivo e aplica o da tela", () => {
  const arquivo = novaBase();
  cadastrarCnpj(arquivo, "11111111000100", "EISA", "Bia", AGORA);
  cadastrarCnpj(arquivo, "22222222000100", "USINA", "Bia", AGORA);
  definirProdutoPadrao(arquivo, "11111111000100", "CAFE", "Bia", AGORA);
  const tela = structuredClone(arquivo), s = novaSessao();
  const r0 = definirProdutoPadrao(tela, "22222222000100", "ACUCAR", "Ana", AGORA);
  s.cadastro.set(r0.cnpj, structuredClone(tela.cnpjs.find(c => c.cnpj === r0.cnpj)));
  const r = juntar(arquivo, tela, s);
  assert.equal(r.cnpjs.find(c => c.cnpj === "11111111000100").produtoPadrao, "CAFE");
  assert.equal(r.cnpjs.find(c => c.cnpj === "22222222000100").produtoPadrao, "ACUCAR");
});
