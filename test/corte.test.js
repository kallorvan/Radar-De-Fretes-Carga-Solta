// Base v3 e data de corte: CT-e antes do corte ficam na base, mas fora da análise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { novaBase, incluir, migrarBase, noCorte, ctesNoCorte, definirCorte, CORTE_PADRAO } from "../src/base.js";
import { filtrar, excecoes } from "../src/agregacao.js";
import { pendentesDeClassificacao } from "../src/classificacao.js";
import { lerDadosJs, montarDadosJs, novaSessao, sessaoVazia, juntar } from "../src/arquivo.js";
import * as A from "../src/acoes.js";
import { campos, chaveN } from "./ajuda.js";

const AGORA = "2026-10-28T12:00:00.000Z";

/* Um CT-e de julho sem classificação e um de agosto classificado. */
function baseJulhoAgosto() {
  const d = novaBase();
  incluir(d, campos({ chave: chaveN(1), numero: 1, emissao: "2026-07-31", produto: null, unidade: null }), "Ana", AGORA, "importacao", { exigirClassificacao: false });
  incluir(d, campos({ chave: chaveN(2), numero: 2, emissao: "2026-08-01" }), "Ana", AGORA);
  return d;
}

test("base nova é v3 com corte em 01/08/2026", () => {
  assert.equal(CORTE_PADRAO, "2026-08-01");
  assert.equal(novaBase().versao, 3);
  assert.equal(novaBase().corte, "2026-08-01");
});

test("migrar v2 → v3 acrescenta o corte padrão, mas mantém um corte null já gravado", () => {
  const v2 = { ...novaBase(), versao: 2 };
  delete v2.corte;
  const r = migrarBase(v2);
  assert.equal(r.versao, 3);
  assert.equal(r.corte, "2026-08-01");
  assert.equal(migrarBase({ ...novaBase(), corte: null }).corte, null);
});

test("noCorte: a data do corte entra; sem corte, tudo entra", () => {
  const d = novaBase();
  assert.equal(noCorte(d, { emissao: "2026-08-01" }), true);
  assert.equal(noCorte(d, { emissao: "2026-07-31" }), false);
  d.corte = null;
  assert.equal(noCorte(d, { emissao: "2026-01-01" }), true);
});

test("filtrar aplica o corte; Lançamentos pede sem corte", () => {
  const d = baseJulhoAgosto();
  assert.deepEqual(filtrar(d, {}).map(c => c.numero), [2]);
  assert.equal(filtrar(d, {}, { aplicarCorte: false }).length, 2);
  assert.equal(ctesNoCorte(d).length, 1);
});

test("exceções e classificação ignoram CT-e antes do corte", () => {
  const d = baseJulhoAgosto();
  assert.equal(excecoes(d).filter(e => e.tipo === "a-classificar").length, 0);
  assert.equal(pendentesDeClassificacao(d).length, 0);
  d.corte = null;
  assert.equal(excecoes(d).filter(e => e.tipo === "a-classificar").length, 1);
  assert.equal(pendentesDeClassificacao(d).length, 1);
});

test("definirCorte muda, apaga e recusa data inválida, com registro", () => {
  const d = novaBase();
  assert.equal(definirCorte(d, "2026-09-01", "Ana", AGORA).ok, true);
  assert.equal(d.corte, "2026-09-01");
  assert.equal(d.log.at(-1).acao, "corte");
  assert.equal(definirCorte(d, "", "Ana", AGORA).ok, true);
  assert.equal(d.corte, null);
  assert.equal(definirCorte(d, "31/08/2026", "Ana", AGORA).ok, false);
  assert.equal(d.corte, null);
});

test("arquivo grava com a marca v3 e lê a v2 migrando", () => {
  const d = novaBase(); d.salvoEm = AGORA;
  const txt = montarDadosJs(d);
  assert.ok(txt.includes("window.RADAR_CS3="));
  const v2 = { ...novaBase(), versao: 2 }; delete v2.corte;
  const lido = lerDadosJs("window.RADAR_CS2=" + JSON.stringify(v2) + ";");
  assert.equal(lido.versao, 3);
  assert.equal(lido.corte, "2026-08-01");
});

test("juntar leva o corte mudado nesta página; sem mudança, fica o do arquivo", () => {
  const arquivo = { ...novaBase(), corte: "2026-07-01" }, tela = novaBase();
  const s = novaSessao();
  assert.equal(juntar(arquivo, tela, s).corte, "2026-07-01");
  A.definirCorte(tela, s, "2026-09-01", "Ana", AGORA);
  assert.equal(s.config.get("corte"), "2026-09-01");
  assert.equal(sessaoVazia({ ...novaSessao(), config: new Map([["corte", null]]) }), false);
  assert.equal(juntar(arquivo, tela, s).corte, "2026-09-01");
});

test("a mesma data de corte não entra na sessão", () => {
  const d = novaBase(), s = novaSessao();
  A.definirCorte(d, s, "2026-08-01", "Ana", AGORA);
  assert.equal(s.config.size, 0);
  assert.equal(s.log.length, 0);
});
