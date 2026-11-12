import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir, semRolagemHorizontal } from "./ajuda.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test("casca abre, troca de aba e não tem erro", async () => {
  const { page, erros, ctx } = await abrir(browser);
  await page.waitForSelector("#conteudo .card");
  assert.equal(await page.locator("#abas button[aria-selected=true]").textContent(), "Evolução");
  await page.click("#abas button[data-aba=rotas]");
  await page.waitForFunction(() => location.hash === "#rotas");
  assert.match(await page.locator("#conteudo .card h3").first().textContent(), /por rota/);
  assert.match(await page.locator("#estado-gravacao").textContent(), /Pasta não conectada|Somente consulta/);
  assert.equal(await semRolagemHorizontal(page), true);
  await page.screenshot({ path: "test-results/casca.png", fullPage: true });
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("menu lateral como o do Radar Container: assinatura branca, abas em coluna e o conteúdo ao lado", async () => {
  const { page, ctx } = await abrir(browser);
  await page.waitForSelector("#conteudo .card");
  const logo = page.locator(".lateral .logos-branco img");
  assert.equal(await logo.count(), 1);
  assert.equal(await logo.getAttribute("alt"), "Grupo Dínamo e Tóliman Transportes");
  const menu = await page.locator("#topo").boundingBox();
  assert.equal(Math.round(menu.x), 0);
  assert.equal(Math.round(menu.width), 258);
  assert.equal(Math.round(menu.height), 900, "o menu ocupa a altura da tela");
  // as abas ficam uma embaixo da outra
  const ys = await page.$$eval("#abas button", bs => bs.map(b => Math.round(b.getBoundingClientRect().y)));
  assert.ok(ys.every((y, i) => i === 0 || y > ys[i - 1]), ys.join());
  assert.ok((await page.locator("#conteudo .card").first().boundingBox()).x >= 258, "o conteúdo começa depois do menu");
  // o quadro de gravação fica no pé do menu
  const salvar = await page.locator("#estado-gravacao").boundingBox();
  assert.ok(salvar.y + salvar.height > 700, String(salvar.y));
  await ctx.close();
});

test("menu fixo: rolar a página não move o menu nem faz a página pular no fim", async () => {
  const { baseExemplo } = await import("../fixtures/base-exemplo.js");
  const { page, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#evolucao" });
  await page.waitForSelector(".kpi");
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  assert.equal(Math.round((await page.locator("#topo").boundingBox()).y), 0);
  const ys = [];
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(60); ys.push(await page.evaluate(() => scrollY)); }
  assert.equal(new Set(ys).size, 1, ys.join());
  await ctx.close();
});

test("Evolução: o recorte fica no menu lateral, abaixo do botão Evolução, e some nas outras telas", async () => {
  const { baseExemplo } = await import("../fixtures/base-exemplo.js");
  const { page, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#evolucao" });
  await page.waitForSelector("#filtros-lat select[data-f=rota]");
  const evol = await page.locator("#abas button[data-aba=evolucao]").boundingBox();
  const filtros = await page.locator("#filtros-lat").boundingBox();
  const rotas = await page.locator("#abas button[data-aba=rotas]").boundingBox();
  assert.ok(filtros.y > evol.y && filtros.y < rotas.y, `${evol.y} ${filtros.y} ${rotas.y}`);
  await page.click("#abas button[data-aba=rotas]");
  await page.waitForSelector("#tab-rotas tbody tr");
  assert.equal(await page.locator("#filtros-lat").isHidden(), true);
  await ctx.close();
});

test("Evolução: clicar no botão com ela aberta recolhe o recorte; clicar de novo abre", async () => {
  const { baseExemplo } = await import("../fixtures/base-exemplo.js");
  const { page, ctx, erros } = await abrir(browser, { dados: baseExemplo(), hash: "#evolucao" });
  const botao = page.locator("#abas button[data-aba=evolucao]");
  await page.waitForSelector("#filtros-lat select[data-f=rota]");
  assert.equal(await botao.getAttribute("aria-expanded"), "true");
  await botao.click();
  await page.waitForFunction(() => document.querySelector("#filtros-lat").hidden);
  assert.equal(await botao.getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => location.hash), "#evolucao", "continua na Evolução");
  await botao.click();
  await page.waitForSelector("#filtros-lat select[data-f=rota]");
  // recolhido, mudar de tela e voltar: o recorte abre de novo
  await botao.click();
  await page.waitForFunction(() => document.querySelector("#filtros-lat").hidden);
  await page.click("#abas button[data-aba=rotas]");
  await page.waitForSelector("#tab-rotas tbody tr");
  await botao.click();
  await page.waitForSelector("#filtros-lat select[data-f=rota]");
  assert.deepEqual(erros, []);
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

test("aba Base de CT-e separada dos Lançamentos, entre Rotas e Lançamentos no menu", async () => {
  const { baseExemplo } = await import("../fixtures/base-exemplo.js");
  const { page, ctx, erros } = await abrir(browser, { dados: baseExemplo(), hash: "#lancamentos", gravavel: true, quem: "Ana" });
  await page.waitForSelector("#form-cte");
  assert.equal(await page.locator("#tab-base").count(), 0, "a base não fica mais embaixo do formulário");
  const ordem = await page.$$eval("#abas button", bs => bs.sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y).map(b => b.textContent.trim()));
  assert.deepEqual(ordem, ["Evolução", "Rotas", "Base de CT-e", "Lançamentos", "Cadastro", "Dados"]);
  await page.click("[data-ir-base]");
  await page.waitForSelector("#tab-base tbody tr");
  assert.equal(await page.evaluate(() => location.hash), "#base");
  assert.equal(await page.locator("#form-cte").count(), 0, "o formulário fica só em Lançamentos");
  assert.deepEqual(erros, []);
  await ctx.close();
});
