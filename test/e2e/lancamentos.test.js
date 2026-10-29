import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo } from "../fixtures/base-exemplo.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const CHAVE_NOVA = "35260511111111000100570010000999991000120718";   // transportador 11.111.111/0001-00
async function preencher(page, extra = {}) {
  const v = {
    chave: CHAVE_NOVA, emissao: "2026-05-04", cnpjCliente: "44.209.336/0035-83",
    origem: "A", destino: "B", valorAssegurado: "100.000,00", valorSeguro: "0", valorFrete: "8.750,00", adicionais: "0",
    produto: "ACUCAR", unidade: "TON", quantidade: "50", ...extra,
  };
  // o CNPJ do transportador sai da chave: um CNPJ pedido no teste vai para dentro dela
  if (v.cnpjTransportador) { v.chave = v.chave.slice(0, 6) + v.cnpjTransportador.replace(/\D/g, "") + v.chave.slice(20); delete v.cnpjTransportador; }
  for (const [k, x] of Object.entries(v)) {
    const el = page.locator(`#form-cte [name=${k}]`);
    if (await el.evaluate(e => e.tagName === "SELECT")) await el.selectOption(x); else await el.fill(x);
    await el.dispatchEvent("change");
  }
}
const abrirLanc = (extra = {}) => abrir(browser, { dados: baseExemplo(), hash: "#lancamentos", gravavel: true, quem: "Ana", ...extra });

test("lança CT-e e calcula preço por saca", async () => {
  const { page, ctx, erros } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page);
  assert.equal(await page.locator("#form-cte output[name=precoTonelada]").textContent(), "R$ 175,00");
  assert.equal(await page.locator("#form-cte output[name=precoSaca]").textContent(), "—");
  assert.equal(await page.locator("#form-cte [name=pesoKg]").inputValue(), "50.000");
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
  await preencher(page, { quantidade: "" });
  await page.click("#form-cte button[type=submit]");
  await page.waitForSelector("#form-cte [name=quantidade][aria-invalid=true]");
  assert.match(await page.locator("#form-cte").textContent(), /Informe a quantidade/);
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
  assert.equal(await page.locator("#form-cte [name=produto]").inputValue(), "ACUCAR");
  await page.fill("#form-cte [name=quantidade]", "60");
  await page.click("#form-cte button[type=submit]");
  await page.waitForSelector("#form-cte:not(.editando)");
  const preco = await page.evaluate(() => window.RADAR_APP.dados.ctes.find(c => c.numero === 4).precoTonelada);
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

test("lança café em sacas de 60 kg e açúcar em toneladas", async () => {
  const { page, ctx, erros } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page, { produto: "CAFE", unidade: "SC60", quantidade: "540", valorFrete: "17.353,56" });
  assert.equal(await page.locator("#form-cte output[name=precoTonelada]").textContent(), "R$ 535,60");
  assert.equal(await page.locator("#form-cte output[name=precoSaca]").textContent(), "R$ 32,14");
  await page.click("#form-cte button[type=submit]");
  await page.waitForFunction(() => window.RADAR_APP.dados.ctes.some(c => c.numero === 99999 && c.produto === "CAFE"));
  await preencher(page, { chave: "35260511111111000100570010000888881000120718", produto: "ACUCAR", unidade: "TON", quantidade: "50", valorFrete: "8.750,00" });
  assert.equal(await page.locator("#form-cte output[name=precoTonelada]").textContent(), "R$ 175,00");
  await page.fill("#busca", "99999");
  await page.waitForFunction(() => document.querySelector("#tab-base tbody").textContent.includes("Café"));
  assert.match(await page.locator("#tab-base tbody").textContent(), /535,60/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("peso do CT-e sobrescreve o calculado", async () => {
  const { page, ctx } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page, { quantidade: "20", valorFrete: "10.000,00" });
  assert.equal(await page.locator("#form-cte [name=pesoKg]").isEditable(), false);
  await page.check("#form-cte [name=pesoInformado]");
  await page.fill("#form-cte [name=pesoKg]", "25.000");
  await page.locator("#form-cte [name=pesoKg]").dispatchEvent("change");
  assert.equal(await page.locator("#form-cte output[name=precoTonelada]").textContent(), "R$ 400,00");
  await page.click("#form-cte button[type=submit]");
  await page.waitForFunction(() => window.RADAR_APP.dados.ctes.find(c => c.numero === 99999)?.pesoInformado === true);
  // peso com decimais sobrevive à correção
  await page.evaluate(() => { const c = window.RADAR_APP.dados.ctes.find(x => x.numero === 99999); c.pesoKg = 1234.56; });
  await page.fill("#busca", "99999");
  await page.click("#tab-base [data-corrigir]");
  assert.equal(await page.locator("#form-cte [name=pesoKg]").inputValue(), "1.234,56");
  await ctx.close();
});

test("big bag exige peso", async () => {
  const { page, ctx } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page, { unidade: "BAG", quantidade: "30" });
  assert.equal(await page.locator("#form-cte [name=pesoInformado]").isChecked(), true);
  assert.equal(await page.locator("#form-cte [name=pesoInformado]").isDisabled(), true);
  await page.click("#form-cte button[type=submit]");
  await page.waitForSelector("#form-cte [name=pesoKg][aria-invalid=true]");
  assert.match(await page.locator("#form-cte").textContent(), /Informe o peso total do CT-e/);
  await ctx.close();
});

test("produto padrão do cliente preenche o produto", async () => {
  const d = baseExemplo();
  d.cnpjs.find(c => c.cnpj === "44209336003583").produtoPadrao = "ACUCAR";
  const { page, ctx } = await abrirLanc({ dados: d });
  await page.waitForSelector("#form-cte");
  await page.fill("#form-cte [name=cnpjCliente]", "44.209.336/0035-83");
  await page.locator("#form-cte [name=cnpjCliente]").dispatchEvent("change");
  assert.equal(await page.locator("#form-cte [name=produto]").inputValue(), "ACUCAR");
  await ctx.close();
});

test("o seguro informado calcula a taxa, travada", async () => {
  const { page, ctx, erros } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page, { valorAssegurado: "917.213,08", valorSeguro: "458,61", valorFrete: "9.208,61" });
  assert.equal(await page.locator("#form-cte output[name=taxaSeguro]").textContent(), "0,0500%");
  assert.equal(await page.locator("#form-cte output[name=tarifa]").textContent(), "R$ 8.750,00");
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("a chave preenche e trava o CNPJ do transportador; origem e destino montam o itinerário", async () => {
  const { page, ctx, erros } = await abrirLanc();
  await page.waitForSelector("#form-cte");
  await preencher(page, { origem: "Araras", destino: "Santos" });
  const cnpj = page.locator("#form-cte [name=cnpjTransportador]");
  assert.equal(await cnpj.inputValue(), "11.111.111/0001-00");
  assert.equal(await cnpj.evaluate(e => e.readOnly), true);
  const itin = page.locator("#form-cte [name=itinerario]");
  assert.equal(await itin.inputValue(), "ARRSAN");
  assert.equal(await itin.evaluate(e => e.readOnly), true);
  assert.match(await page.locator("#form-cte [data-nome=cnpjTransportador]").textContent(), /TRANSPORTES UM/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("corrigir CT-e cujo CNPJ guardado não bate com a chave avisa a troca de transportador", async () => {
  const d = baseExemplo();
  d.ctes[0].cnpjTransportador = "22222222000100";   // base antiga: CNPJ digitado diferente do emitente da chave
  const { page, ctx } = await abrir(browser, { dados: d, hash: "#lancamentos", gravavel: true, quem: "Ana" });
  await page.fill("#busca", String(d.ctes[0].numero));
  await page.click(`#tab-base [data-corrigir="${d.ctes[0].chave}"]`);
  await page.waitForSelector("#form-cte.editando");
  assert.match(await page.locator("#aviso-cnpj-chave").textContent(), /22\.222\.222\/0001-00.*não bate com a chave.*11\.111\.111\/0001-00/);
  await ctx.close();
});

test("CT-e na lixeira: o formulário oferece Lançar de novo e lança com os dados digitados", async () => {
  const d = baseExemplo();
  const alvo = d.ctes[0];
  const { excluir } = await import("../../src/base.js");
  excluir(d, alvo.chave, "Ana", "2026-10-28T12:00:00.000Z");
  const { page, ctx, erros } = await abrir(browser, { dados: d, hash: "#lancamentos", gravavel: true, quem: "Bia" });
  await page.waitForSelector("#form-cte");
  await preencher(page, { chave: alvo.chave, numero: String(alvo.numero), valorFrete: "9.000,00" });
  await page.click("#form-cte button[type=submit]");
  await page.waitForSelector("#form-msg [data-relancar]");
  assert.match(await page.locator("#form-msg").textContent(), /está na lixeira/);
  await page.click("#form-msg [data-relancar]");
  await page.waitForFunction(k => window.RADAR_APP.dados.ctes.some(c => c.chave === k), alvo.chave);
  const r = await page.evaluate(k => ({ lixo: window.RADAR_APP.dados.lixeira.length, c: window.RADAR_APP.dados.ctes.find(c => c.chave === k) }), alvo.chave);
  assert.equal(r.lixo, 0);
  assert.equal(r.c.tarifa, 9000);
  assert.equal(r.c.criadoPor, "Bia");
  assert.deepEqual(erros, []);
  await ctx.close();
});
