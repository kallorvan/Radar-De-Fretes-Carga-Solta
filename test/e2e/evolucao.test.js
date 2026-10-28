import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo } from "../fixtures/base-exemplo.js";
import { novaBase } from "../../src/base.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test("evolução mostra mediana da rota", async () => {
  const { page, erros, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#evolucao?rota=A%20%E2%86%92%20B" });
  await page.waitForSelector(".bignum");
  assert.equal(await page.locator(".bignum").textContent(), "R$ 190,00");
  assert.match(await page.locator(".hero h1").textContent(), /A → B/);
  assert.equal(await page.locator(".grafico path.serie").count(), 3);
  assert.match(await page.locator(".split").textContent(), /11,8%/);   // 190 / 170 − 1
  assert.equal(await page.locator("#tab-transp tbody tr").count(), 3);
  await page.locator(".grafico circle.ponto").first().hover();
  assert.match(await page.locator("#tip").textContent(), /CT-e/);
  await page.screenshot({ path: "test-results/evolucao-1280.png", fullPage: true });
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("trocar a métrica e o filtro atualiza o endereço", async () => {
  const { page, ctx } = await abrir(browser, { dados: baseExemplo() });
  await page.waitForSelector(".bignum");
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
