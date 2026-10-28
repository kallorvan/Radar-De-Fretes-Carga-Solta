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

test("assinatura Dínamo | Tóliman no topo com 44 px e no rodapé em branco", async () => {
  const { page, ctx } = await abrir(browser);
  await page.waitForSelector("#conteudo .sec-head");
  const topo = page.locator(".logos-cor img");
  assert.equal(await topo.count(), 1);
  assert.equal(await topo.getAttribute("alt"), "Grupo Dínamo e Tóliman Transportes");
  assert.equal(Math.round((await topo.boundingBox()).height), 44);
  assert.equal(await page.locator(".logos-branco img").count(), 1);
  await ctx.close();
});
