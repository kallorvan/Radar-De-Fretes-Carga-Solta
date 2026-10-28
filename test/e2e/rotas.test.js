import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo } from "../fixtures/base-exemplo.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test("rotas lista por CT-e e abre evolução filtrada", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseExemplo(), hash: "#rotas" });
  await page.waitForSelector("#tab-rotas tbody tr");
  const linhas = page.locator("#tab-rotas tbody tr");
  assert.equal(await linhas.count(), 2);
  assert.match(await linhas.first().textContent(), /A → B/);
  assert.match(await linhas.first().textContent(), /R\$ 190,00/);
  assert.equal(await linhas.first().locator("svg.mini").count(), 1);
  await linhas.first().click();
  await page.waitForFunction(() => location.hash.startsWith("#evolucao?rota="));
  assert.match(await page.locator(".hero h1 em").textContent(), /A → B/);
  assert.deepEqual(erros, []);
  await ctx.close();
});
