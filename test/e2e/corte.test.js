// Data de corte: CT-e antes dela ficam na base, mas fora da Evolução; ajustável em Dados.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir } from "./ajuda.js";
import { novaBase, incluir, cadastrarCnpj } from "../../src/base.js";
import { campos, chaveN } from "../ajuda.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const AGORA = "2026-10-28T12:00:00.000Z";
function baseJulhoAgosto() {
  const d = novaBase();
  cadastrarCnpj(d, "05780969000146", "JF PEREIRA", "Ana", AGORA);
  cadastrarCnpj(d, "44209336003583", "USINA ALTA MOGIANA", "Ana", AGORA);
  [["2026-07-20", 1], ["2026-08-01", 2], ["2026-08-15", 3], ["2026-09-03", 4]].forEach(([emissao, n]) =>
    incluir(d, campos({ chave: chaveN(n), numero: n, emissao }), "Ana", AGORA));
  return d;
}
const kpiCtes = page => page.locator(".kpi").first().locator("b").textContent();

test("Evolução deixa fora o CT-e antes do corte e avisa; a base mostra todos", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseJulhoAgosto(), hash: "#evolucao", gravavel: true, quem: "Ana" });
  await page.waitForSelector(".kpi");
  assert.equal(await kpiCtes(page), "3");
  assert.match(await page.locator("#aviso-corte").textContent(), /1 CT-e emitido antes de 01\/08\/2026 fora da análise/);
  await page.click("#abas button[data-aba=lancamentos]");
  await page.waitForFunction(() => document.querySelectorAll("#tab-base tbody tr").length === 4);
  assert.match(await page.locator("#tab-base tbody").textContent(), /antes do corte/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("mudar e apagar a data de corte em Dados muda a Evolução", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseJulhoAgosto(), hash: "#dados", gravavel: true, quem: "Ana" });
  await page.fill("#corte", "2026-07-01");
  await page.click("[data-salvar-corte]");
  await page.click("#abas button[data-aba=evolucao]");
  await page.waitForSelector(".kpi");
  assert.equal(await kpiCtes(page), "4");
  assert.equal(await page.locator("#aviso-corte").count(), 0);
  await page.click("#abas button[data-aba=dados]");
  await page.fill("#corte", "2026-09-01");
  await page.click("[data-salvar-corte]");
  await page.click("#abas button[data-aba=evolucao]");
  await page.waitForSelector(".kpi");
  assert.equal(await kpiCtes(page), "1");
  await page.click("#abas button[data-aba=dados]");
  await page.fill("#corte", "");
  await page.click("[data-salvar-corte]");
  await page.click("#abas button[data-aba=evolucao]");
  await page.waitForSelector(".kpi");
  assert.equal(await kpiCtes(page), "4");
  assert.equal(await page.evaluate(() => window.RADAR_APP.dados.corte), null);
  assert.deepEqual(erros, []);
  await ctx.close();
});
