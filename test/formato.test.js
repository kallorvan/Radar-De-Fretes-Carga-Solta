import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtNum, fmtMoeda, fmtPct, fmtCnpj, fmtData, fmtMes, fmtMesLongo, fmtQuando, esc } from "../src/formato.js";

test("números e moeda em pt-BR", () => {
  assert.equal(fmtNum(7237), "7.237");
  assert.equal(fmtNum(43.071, 2), "43,07");
  assert.equal(fmtMoeda(1234.5), "R$ 1.234,50");
  assert.equal(fmtMoeda(-12), "-R$ 12,00");
  assert.equal(fmtMoeda(null), "—");
});
test("percentual com sinal opcional", () => {
  assert.equal(fmtPct(0.184), "18,4%");
  assert.equal(fmtPct(null), "—");
});
test("cnpj, data e mês", () => {
  assert.equal(fmtCnpj("07668709000109"), "07.668.709/0001-09");
  assert.equal(fmtData("2026-01-10"), "10/01/2026");
  assert.equal(fmtMes("2026-01"), "jan/26");
  assert.equal(fmtMesLongo("2026-07"), "Julho de 2026");
  assert.match(fmtQuando("2026-10-28T14:03:11.000Z"), /^28\/10\/2026 \d\d:03$/);
});
test("esc escapa < > & \"", () => assert.equal(esc(`<b a="1">&`), "&lt;b a=&quot;1&quot;&gt;&amp;"));
