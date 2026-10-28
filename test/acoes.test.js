import { test } from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { novaBase } from "../src/base.js";
import { novaSessao } from "../src/arquivo.js";
import { lerPlanilha } from "../src/importacao.js";
import * as A from "../src/acoes.js";
import { campos, CHAVE } from "./ajuda.js";
import { gerarPlanilha, linhaPadrao } from "./fixtures/planilha.js";

const AGORA = "2026-10-28T12:00:00.000Z";

test("acoes registram a sessão e o log da sessão", () => {
  const d = novaBase(), s = novaSessao();
  assert.equal(A.incluir(d, s, campos(), "Ana", AGORA).ok, true);
  assert.deepEqual([...s.alterados], [CHAVE]);
  assert.equal(s.log.length, 1);
  A.excluir(d, s, CHAVE, "Ana", AGORA);
  assert.deepEqual([...s.excluidos], [CHAVE]);
  assert.equal(s.alterados.size, 0);
  A.restaurar(d, s, CHAVE, "Ana", AGORA);
  assert.deepEqual([...s.restaurados], [CHAVE]);
  assert.equal(s.excluidos.size, 0);
  A.corrigir(d, s, CHAVE, campos({ quantidade: 70 }), "Ana", AGORA);
  assert.ok(s.alterados.has(CHAVE));
  A.cadastrar(d, s, "07668709000109", "Atma", "Ana", AGORA);
  assert.equal(s.cadastro.get("07668709000109"), "ATMA");
  assert.equal(s.log.length, 5);
});

test("acao com falha não mexe na sessão", () => {
  const d = novaBase(), s = novaSessao();
  assert.equal(A.incluir(d, s, campos({ quantidade: 0 }), "Ana", AGORA).ok, false);
  assert.equal(s.alterados.size + s.log.length, 0);
});

test("importar registra todas as chaves e cadastros", () => {
  const d = novaBase(), s = novaSessao();
  const r = A.importar(d, s, lerPlanilha(XLSX, gerarPlanilha([linhaPadrao(1), linhaPadrao(2)])), "Ana", AGORA);
  assert.equal(r.incluidos, 2);
  assert.equal(s.alterados.size, 2);
  assert.equal(s.cadastro.size, 2);
  assert.equal(s.log.length, 1);
});
