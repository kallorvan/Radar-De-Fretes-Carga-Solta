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

test("exceção de CNPJ abre o cadastro já buscando o CNPJ", async () => {
  const { page, ctx } = await abrirEvolucao();
  await page.click('.exc[data-tipo="sem-cadastro"] [data-abrir-cnpj]');
  await page.waitForSelector("#busca-cnpj");
  assert.equal(await page.locator("#busca-cnpj").inputValue(), "77777777000100");
  await ctx.close();
});

test("CT-e a classificar leva à classificação", async () => {
  const { page, ctx } = await abrirEvolucao();
  await page.click('.exc[data-tipo="a-classificar"] [data-ir-classificar]');
  await page.waitForSelector("#classificar");
  assert.match(await page.evaluate(() => location.hash), /^#dados/);
  await ctx.close();
});

