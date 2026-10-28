import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo, baseV1ParaClassificar } from "../fixtures/base-exemplo.js";
import { gerarPlanilha, linhaPadrao } from "../fixtures/planilha.js";
import { excluir } from "../../src/base.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });
const opc = { gravavel: true, quem: "Ana" };

test("importa planilha e mostra o resumo", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseExemplo(), hash: "#dados", ...opc });
  await page.waitForSelector("#arq-planilha", { state: "attached" });
  const buf = Buffer.from(gerarPlanilha([linhaPadrao(901), linhaPadrao(902), linhaPadrao(903), linhaPadrao(904, { "QT. SACAS": null })]));
  await page.setInputFiles("#arq-planilha", { name: "Radar.xlsx", mimeType: "application/octet-stream", buffer: buf });
  await page.waitForSelector(".resumo-imp");
  const txt = await page.locator(".resumo-imp").textContent();
  assert.match(txt, /3 CT-e incluídos/);
  assert.match(txt, /1 rejeitados/);
  assert.match(txt, /Informe a quantidade/);
  assert.equal(await page.evaluate(() => window.RADAR_APP.dados.ctes.length), 10);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("restaura da lixeira uma vez só", async () => {
  const d = baseExemplo(); excluir(d, d.ctes[0].chave, "Bia", "2026-10-28T12:00:00.000Z");
  const { page, ctx } = await abrir(browser, { dados: d, hash: "#dados", ...opc });
  for (const aba of ["rotas", "dados", "evolucao", "dados"]) { await page.click(`#abas button[data-aba=${aba}]`); await page.waitForSelector("#conteudo .sec-head"); }
  assert.match(await page.locator("#tab-lixeira").textContent(), /Bia/);
  await page.evaluate(() => { const orig = window.RADAR_APP.alterar; window.__chamadas = 0; window.RADAR_APP.alterar = (...a) => { window.__chamadas++; return orig(...a); }; });
  await page.click("#tab-lixeira [data-restaurar]");
  await page.waitForFunction(() => window.RADAR_APP.dados.lixeira.length === 0);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__chamadas), 1);
  assert.match(await page.locator("#tab-log").textContent(), /Restaurou/);
  await ctx.close();
});

test("cadastro renomeia e o nome muda na Evolução", async () => {
  const { page, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#cadastro", ...opc });
  await page.waitForSelector("input.nome-cnpj");
  const inp = page.locator('input.nome-cnpj[data-cnpj="11111111000100"]');
  await inp.fill("Transportes Um Renomeada");
  await inp.press("Tab");
  await page.waitForFunction(() => window.RADAR_APP.dados.cnpjs.find(c => c.cnpj === "11111111000100").nome === "TRANSPORTES UM RENOMEADA");
  await page.click("#abas button[data-aba=evolucao]");
  await page.waitForSelector("select[data-f=transportador]");
  assert.match(await page.locator("select[data-f=transportador]").textContent(), /TRANSPORTES UM RENOMEADA/);
  await ctx.close();
});

test("aberto por http é somente leitura", async () => {
  const { dir, ctx: c0 } = await abrir(browser, { dados: baseExemplo() });
  await c0.close();
  const srv = http.createServer((req, res) => {
    const nome = req.url.split("?")[0] === "/" ? "index.html" : decodeURIComponent(req.url.slice(1).split("?")[0]);
    try { res.end(readFileSync(join(dir, nome))); } catch (e) { res.statusCode = 404; res.end(); }
  }).listen(0);
  const porta = srv.address().port;
  const ctx = await browser.newContext(); ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  await page.route(/cdnjs|fonts\./, r => r.abort());
  await page.goto(`http://127.0.0.1:${porta}/#lancamentos`);
  await page.waitForSelector("#tab-base");
  assert.match(await page.locator("#estado-gravacao").textContent(), /Somente consulta/);
  assert.equal(await page.locator("#form-cte").count(), 0);
  assert.equal(await page.locator("#tab-base [data-excluir]").first().isVisible(), false);
  await ctx.close(); srv.close();
});

test("cadastra produto e unidade novos e eles aparecem no formulário", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseExemplo(), hash: "#cadastro", ...opc });
  await page.waitForSelector("#form-produto");
  await page.fill("#form-produto [name=nome]", "Soja");
  await page.click("#form-produto button[type=submit]");
  await page.waitForFunction(() => window.RADAR_APP.dados.produtos.some(p => p.id === "SOJA"));
  await page.fill("#form-unidade [name=nome]", "Fardo 200 kg");
  await page.fill("#form-unidade [name=kg]", "200");
  await page.click("#form-unidade button[type=submit]");
  await page.waitForFunction(() => window.RADAR_APP.dados.unidades.some(u => u.id === "FARDO200KG"));
  // kg de unidade em uso não se edita
  assert.equal(await page.locator('#tab-unidades input[data-kg="TON"]').isDisabled(), true);
  await page.click("#abas button[data-aba=lancamentos]");
  await page.waitForSelector("#form-cte");
  assert.match(await page.locator("#form-cte [name=produto]").textContent(), /Soja/);
  assert.match(await page.locator("#form-cte [name=unidade]").textContent(), /Fardo 200 kg/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("produto padrão no cadastro de CNPJ", async () => {
  const { page, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#cadastro", ...opc });
  await page.waitForSelector('select.produto-padrao[data-cnpj="44209336003583"]');
  await page.selectOption('select.produto-padrao[data-cnpj="44209336003583"]', "ACUCAR");
  await page.waitForFunction(() => window.RADAR_APP.dados.cnpjs.find(c => c.cnpj === "44209336003583").produtoPadrao === "ACUCAR");
  await ctx.close();
});

test("classificar aplica as sugestões marcadas", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseV1ParaClassificar(), hash: "#dados", ...opc });
  await page.waitForSelector("#classificar tbody tr");
  assert.equal(await page.locator("#classificar tbody tr").count(), 4);
  assert.equal(await page.locator("#classificar input[data-marcar]:checked").count(), 3);
  assert.match(await page.locator("#classificar").textContent(), /sem produto padrão/);
  // trocar a unidade de uma linha recalcula o R$/t mostrado
  await page.selectOption('#classificar select[data-unidade="' + (await page.locator("#classificar tbody tr").nth(0).getAttribute("data-chave")) + '"]', "SC50");
  await page.waitForFunction(() => document.querySelector("#classificar tbody tr").textContent.includes("3.500,00"));
  await page.selectOption('#classificar select[data-unidade="' + (await page.locator("#classificar tbody tr").nth(0).getAttribute("data-chave")) + '"]', "TON");
  await page.click("#aplicar-classificacao");
  await page.waitForFunction(() => window.RADAR_APP.dados.ctes.filter(c => c.produto && c.unidade).length === 3);
  const r = await page.evaluate(() => window.RADAR_APP.dados.ctes.map(c => [c.numero, c.produto, c.unidade, c.precoTonelada]));
  assert.deepEqual(r, [[201, "ACUCAR", "TON", 175], [202, "ACUCAR", "SC50", 178], [203, "CAFE", "SC60", 535.6], [204, null, null, null]]);
  assert.equal(await page.locator("#classificar tbody tr").count(), 1);
  assert.equal(await page.evaluate(() => window.RADAR_APP.dados.log.filter(l => l.acao === "classificar").length), 3);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("produto padrão definido no Cadastro atualiza a sugestão em Classificar", async () => {
  const { page, ctx } = await abrir(browser, { dados: baseV1ParaClassificar(), hash: "#dados", ...opc });
  await page.waitForSelector("#classificar tbody tr");
  const linha = () => page.locator("#classificar tbody tr").filter({ hasText: "COLOMBARI" });
  assert.match(await linha().textContent(), /sem produto padrão/);
  await page.click("#abas button[data-aba=cadastro]");
  await page.selectOption('select.produto-padrao[data-cnpj="66666666000100"]', "ACUCAR");
  await page.waitForFunction(() => window.RADAR_APP.dados.cnpjs.find(c => c.cnpj === "66666666000100").produtoPadrao === "ACUCAR");
  await page.click("#abas button[data-aba=dados]");
  await page.waitForSelector("#classificar tbody tr");
  assert.equal(await linha().locator("select[data-produto]").inputValue(), "ACUCAR");
  assert.equal(await linha().locator("input[data-marcar]").isChecked(), true);
  await ctx.close();
});
