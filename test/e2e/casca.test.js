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

test("cabeçalho não muda de altura ao rolar (sem tremer no fim da página)", async () => {
  const { baseExemplo } = await import("../fixtures/base-exemplo.js");
  const { page, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#evolucao" });
  await page.waitForSelector(".kpi");
  const alturaTopo = () => page.evaluate(() => document.querySelector("#topo").getBoundingClientRect().height);
  const antes = await alturaTopo();
  const docAntes = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(() => scrollTo(0, 40));
  await page.waitForFunction(() => document.querySelector("#topo").classList.contains("scrolled"));
  assert.equal(await alturaTopo(), antes);
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), docAntes);
  // no fim da página a rolagem fica parada (antes, encolher e crescer o cabeçalho fazia a página pular)
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const ys = [];
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(60); ys.push(await page.evaluate(() => scrollY)); }
  assert.equal(new Set(ys).size, 1, ys.join());
  await ctx.close();
});

test("Enter no campo de nome confirma o nome", async () => {
  const { page, ctx } = await abrir(browser, { hash: "#dados", gravavel: true });
  await page.click("[data-nome]");
  await page.waitForSelector("#dlg-nome[open]");
  await page.fill("#dlg-nome [name=nome]", "Teste Enter");
  await page.press("#dlg-nome [name=nome]", "Enter");
  await page.waitForFunction(() => window.RADAR_APP.quem === "Teste Enter");
  await ctx.close();
});
