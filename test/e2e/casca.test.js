import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir, semRolagemHorizontal } from "./ajuda.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test("casca abre, troca de aba e não tem erro", async () => {
  const { page, erros, ctx } = await abrir(browser);
  await page.waitForSelector("#conteudo .sec-head");
  assert.equal(await page.locator("#abas button[aria-selected=true]").textContent(), "Evolução");
  await page.click("#abas button[data-aba=rotas]");
  await page.waitForFunction(() => location.hash === "#rotas");
  assert.match(await page.locator("#conteudo h2").textContent(), /Rotas/);
  assert.match(await page.locator("#estado-gravacao").textContent(), /Pasta não conectada|Somente consulta/);
  assert.equal(await semRolagemHorizontal(page), true);
  await page.screenshot({ path: "test-results/casca.png", fullPage: true });
  assert.deepEqual(erros, []);
  await ctx.close();
});
