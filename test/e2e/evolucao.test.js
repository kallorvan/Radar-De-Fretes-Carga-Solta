import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo, baseCafeEAcucar } from "../fixtures/base-exemplo.js";
import { novaBase } from "../../src/base.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test("evolução mostra mediana da rota", async () => {
  const { page, erros, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#evolucao?rota=A%20%E2%86%92%20B" });
  await page.waitForSelector(".bignum");
  assert.equal(await page.locator(".bignum").textContent(), "R$ 190,00");
  assert.match(await page.locator(".hero h1").textContent(), /A → B/);
  assert.equal(await page.locator(".grafico circle.cte").count(), 6, "um ponto por CT-e da rota");
  assert.equal(await page.locator(".grafico path.mediana").count(), 1);
  assert.match(await page.locator(".legenda-gradiente").textContent(), /mais barato R\$ 160,00.*mais caro R\$ 190,00/);
  assert.match(await page.locator(".split").textContent(), /11,8%/);   // 190 / 170 − 1
  assert.equal(await page.locator("#tab-transp tbody tr").count(), 3);
  await page.locator(".grafico circle.cte").first().hover();
  assert.match(await page.locator("#tip").textContent(), /CT-e \d+/);
  await page.screenshot({ path: "test-results/evolucao-1280.png", fullPage: true });
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("trocar a métrica e o filtro atualiza o endereço", async () => {
  const { page, ctx } = await abrir(browser, { dados: baseExemplo() });
  await page.waitForSelector(".bignum");
  assert.match(await page.locator(".hero h1").textContent(), /Preço por tonelada/i);
  assert.equal(await page.locator(".modes button[data-metrica]").count(), 3);
  await page.click(".modes button[data-metrica=tarifa]");
  await page.waitForFunction(() => location.hash.includes("metrica=tarifa"));
  await page.waitForFunction(() => /Tarifa/i.test(document.querySelector(".hero h1").textContent));
  await page.selectOption("#f-rota", "A → B");
  await page.waitForFunction(() => location.hash.includes("rota="));
  await page.waitForFunction(() => /A → B/.test(document.querySelector(".hero h1 em").textContent));
  assert.equal(await page.locator(".bignum").textContent(), "R$ 9.500,00");
  await ctx.close();
});

test("sem rota escolhida pede para escolher e lista exceções", async () => {
  const { page, ctx } = await abrir(browser, { dados: baseExemplo() });
  await page.waitForSelector(".bignum");
  assert.match(await page.locator("#tab-transp").textContent(), /Escolha uma rota/);
  assert.match(await page.locator("#excecoes").textContent(), /Exceções a tratar|Nenhuma exceção/);
  await ctx.close();
});

test("base vazia mostra o caminho para lançar ou importar", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: novaBase() });
  await page.waitForSelector(".vazio");
  assert.match(await page.locator(".vazio").first().textContent(), /Nenhum CT-e lançado/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("rota com café e açúcar mostra o aviso e o filtro resolve", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseCafeEAcucar(), hash: "#evolucao?rota=A%20%E2%86%92%20B" });
  await page.waitForSelector(".bignum");
  assert.match(await page.locator("#aviso-produtos").textContent(), /Café e Açúcar|Açúcar e Café/);
  await page.selectOption("#f-produto", "CAFE");
  await page.waitForFunction(() => location.hash.includes("produto=CAFE"));
  await page.waitForFunction(() => !document.querySelector("#aviso-produtos"));
  assert.equal(await page.locator(".bignum").textContent(), "R$ 535,60");
  assert.match(await page.locator(".kpis").textContent(), /Toneladas/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("mediana do mês desliga e clicar num ponto abre o CT-e", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseExemplo(), hash: "#evolucao?rota=A%20%E2%86%92%20B", gravavel: true, quem: "Ana" });
  await page.waitForSelector(".grafico path.mediana");
  await page.click("[data-mediana='0']");
  await page.waitForFunction(() => location.hash.includes("mediana=0"));
  assert.equal(await page.locator(".grafico path.mediana").count(), 0);
  const chave = await page.locator(".grafico circle.cte").last().getAttribute("data-chave");
  await page.locator(".grafico circle.cte").last().click();
  await page.waitForSelector("#form-cte.editando");
  const numero = await page.evaluate(k => window.RADAR_APP.dados.ctes.find(c => c.chave === k).numero, chave);
  assert.match(await page.locator("#form-cte .card-head").textContent(), new RegExp(`Corrigindo o CT-e Nº ${numero}`));
  assert.deepEqual(erros, []);
  await ctx.close();
});
