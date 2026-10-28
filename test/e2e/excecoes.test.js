// "Exceções a tratar" levam direto ao registro para corrigir.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo, T1 } from "../fixtures/base-exemplo.js";
import { incluir } from "../../src/base.js";
import { campos, chaveN } from "../ajuda.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const AGORA = "2026-10-28T12:00:00.000Z";
/* Base de exemplo + 1 CT-e com R$/t fora da faixa (Nº 900), 1 a classificar (Nº 901) e 1 cliente sem cadastro (Nº 902). */
function baseComExcecoes() {
  const d = baseExemplo();
  const lanca = (n, extra, opc) => incluir(d, campos({ chave: chaveN(n), numero: n, origem: "A", destino: "B", cnpjTransportador: T1, emissao: "2026-04-10", ...extra }), "Ana", AGORA, "formulario", opc);
  lanca(900, { valorFrete: 90000 });
  lanca(901, { produto: null, unidade: null }, { exigirClassificacao: false });
  lanca(902, { cnpjCliente: "77777777000100" });
  return d;
}
const abrirEvolucao = () => abrir(browser, { dados: baseComExcecoes(), hash: "#evolucao", gravavel: true, quem: "Ana" });

test("exceção de CT-e abre a correção dele na base", async () => {
  const { page, ctx, erros } = await abrirEvolucao();
  await page.click('.exc[data-tipo="preco-fora"] [data-abrir-cte]');
  await page.waitForSelector("#form-cte.editando");
  assert.match(await page.locator("#form-cte .card-head").textContent(), /Corrigindo o CT-e Nº 900/);
  assert.match(await page.evaluate(() => location.hash), /^#lancamentos/);
  assert.equal(await page.locator("#busca").inputValue(), "900");
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("CT-e a classificar leva à classificação", async () => {
  const { page, ctx } = await abrirEvolucao();
  await page.click('.exc[data-tipo="a-classificar"] [data-ir-classificar]');
  await page.waitForSelector("#classificar");
  assert.match(await page.evaluate(() => location.hash), /^#dados/);
  await ctx.close();
});


test("CNPJ sem cadastro abre o Incluir CNPJ já preenchido, com o cursor no nome", async () => {
  const { page, ctx } = await abrirEvolucao();
  await page.click('.exc[data-tipo="sem-cadastro"] [data-abrir-cnpj]');
  await page.waitForSelector("#form-cnpj.destaque");
  assert.equal(await page.locator("#form-cnpj [name=cnpj]").inputValue(), "77.777.777/0001-00");
  assert.equal(await page.evaluate(() => document.activeElement?.name), "nome");
  assert.ok(await page.locator("#tab-cnpj tbody tr").count() > 1, "a lista não é filtrada");
  await ctx.close();
});

test("CNPJ já cadastrado: a linha dele fica destacada na lista inteira", async () => {
  const { page, ctx } = await abrirEvolucao();
  await page.waitForSelector("#excecoes");
  await page.evaluate(() => window.RADAR_APP.abrirCnpj("11111111000100"));
  await page.waitForSelector("#tab-cnpj tr.destaque");
  assert.match(await page.locator("#tab-cnpj tr.destaque").textContent(), /11\.111\.111\/0001-00/);
  assert.ok(await page.locator("#tab-cnpj tbody tr").count() > 1);
  await ctx.close();
});

test("divergência antiga de seguro aparece com o nome do campo", async () => {
  const d = baseComExcecoes();
  d.ctes[0].divergencia = { calculado: { valorSeguro: 193.07, tarifa: 8750 }, planilha: { valorSeguro: 193, tarifa: 8750.07 } };
  const { page, ctx } = await abrir(browser, { dados: d, hash: "#evolucao" });
  await page.waitForSelector('.exc[data-tipo="diverge-planilha"]');
  const txt = await page.locator('.exc[data-tipo="diverge-planilha"] tbody').first().textContent();
  assert.match(txt, /Seguro: planilha R\$ 193,00/);
  assert.doesNotMatch(txt, /valorSeguro/);
  await ctx.close();
});
