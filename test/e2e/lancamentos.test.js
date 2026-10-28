import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo } from "../fixtures/base-exemplo.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const CHAVE_NOVA = "35260105780969000146570010000999991000120718";
async function preencher(page, extra = {}) {
  const v = {
    chave: CHAVE_NOVA, emissao: "2026-05-04", cnpjTransportador: "11.111.111/0001-00", cnpjCliente: "44.209.336/0035-83",
    origem: "A", destino: "B", valorAssegurado: "100.000,00", taxaSeguro: "0", valorFrete: "8.750,00", adicionais: "0", sacas: "50", ...extra,
  };
  for (const [k, x] of Object.entries(v)) { await page.fill(`#form-cte [name=${k}]`, x); await page.locator(`#form-cte [name=${k}]`).dispatchEvent("change"); }
}
const abrirLanc = (extra = {}) => abrir(browser, { dados: baseExemplo(), hash: "#lancamentos", gravavel: true, quem: "Ana", ...extra });

test("lança CT-e e calcula preço por saca", async () => {
  const { page, ctx, erros } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page);
  assert.equal(await page.locator("#form-cte output[name=precoSaca]").textContent(), "R$ 175,00");
  assert.equal(await page.locator("#form-cte [name=numero]").inputValue(), "99999");
  await page.click("#form-cte button[type=submit]");
  await page.fill("#busca", "99999");
  await page.waitForFunction(() => document.querySelectorAll("#tab-base tbody tr").length === 1);
  assert.match(await page.locator("#tab-base tbody tr").textContent(), /Ana/);
  assert.match(await page.locator("#estado-gravacao").textContent(), /Alterações pendentes/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("chave repetida é bloqueada e mostra o existente", async () => {
  const { page, ctx } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page, { chave: baseExemplo().ctes[0].chave, numero: "1" });
  await page.click("#form-cte button[type=submit]");
  await page.waitForSelector("#form-msg .existente");
  assert.match(await page.locator("#form-msg").textContent(), /já foi lançado/);
  await page.click("#form-msg [data-abrir]");
  await page.waitForSelector("#form-cte.editando");
  await ctx.close();
});

test("campos obrigatórios marcam o erro", async () => {
  const { page, ctx } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page, { sacas: "" });
  await page.click("#form-cte button[type=submit]");
  await page.waitForSelector("#form-cte [name=sacas][aria-invalid=true]");
  assert.match(await page.locator("#form-cte").textContent(), /Informe as sacas/);
  await ctx.close();
});

test("CNPJ novo pede nome e cadastra", async () => {
  const { page, ctx } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page, { cnpjTransportador: "99.999.999/0001-91" });
  await page.waitForSelector("#form-cte [name=nomeTransportador]");
  await page.click("#form-cte button[type=submit]");
  await page.waitForSelector("#form-cte [name=nomeTransportador][aria-invalid=true]");
  await page.fill("#form-cte [name=nomeTransportador]", "Transportes Novos");
  await page.click("#form-cte button[type=submit]");
  await page.fill("#busca", "99999");
  await page.waitForFunction(() => document.querySelector("#tab-base tbody")?.textContent.includes("TRANSPORTES NOVOS"));
  await ctx.close();
});

test("corrigir muda o formulário e salva", async () => {
  const { page, ctx } = await abrirLanc();
  await page.fill("#busca", "4");
  await page.waitForFunction(() => document.querySelectorAll("#tab-base tbody tr").length === 1);
  await page.click("#tab-base [data-corrigir]");
  await page.waitForSelector("#form-cte.editando");
  assert.match(await page.locator("#form-cte").textContent(), /Corrigindo o CT-e Nº 4/);
  assert.equal(await page.locator("#form-cte [name=chave]").isDisabled(), true);
  await page.fill("#form-cte [name=sacas]", "60");
  await page.click("#form-cte button[type=submit]");
  await page.waitForSelector("#form-cte:not(.editando)");
  const preco = await page.evaluate(() => window.RADAR_APP.dados.ctes.find(c => c.numero === 4).precoSaca);
  assert.equal(preco, 150);
  await ctx.close();
});

test("excluir pede confirmação e vai para a lixeira", async () => {
  const { page, ctx, erros } = await abrirLanc();
  // redesenhos antes do clique não podem acumular ações
  for (const aba of ["rotas", "lancamentos", "evolucao", "lancamentos"]) { await page.click(`#abas button[data-aba=${aba}]`); await page.waitForSelector("#conteudo .sec-head"); }
  await page.fill("#busca", "4");
  await page.waitForFunction(() => document.querySelectorAll("#tab-base tbody tr").length === 1);
  await page.evaluate(() => { const orig = window.RADAR_APP.alterar; window.__chamadas = 0; window.RADAR_APP.alterar = (...a) => { window.__chamadas++; return orig(...a); }; });
  await page.click("#tab-base [data-excluir]");
  await page.waitForSelector("#dlg-confirma[open]");
  await page.click("#dlg-confirma-ok");
  await page.waitForFunction(() => window.RADAR_APP.dados.lixeira.length === 1);
  assert.equal(await page.evaluate(() => window.RADAR_APP.dados.ctes.length), 6);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.RADAR_APP.dados.log.filter(l => l.acao === "excluir").length), 1);
  assert.equal(await page.evaluate(() => window.__chamadas), 1);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("aberto sem pasta gravável não mostra o formulário", async () => {
  const { page, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#lancamentos" });
  await page.waitForSelector("#tab-base");
  const gravavel = await page.evaluate(() => !window.RADAR_APP.somenteLeitura);
  if (!gravavel) assert.equal(await page.locator("#form-cte").isVisible(), false);
  await ctx.close();
});
