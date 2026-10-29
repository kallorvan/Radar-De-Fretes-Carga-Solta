// Base de Lançamentos: seleção e exclusão em massa, e o botão que abre o PDF do CT-e.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo } from "../fixtures/base-exemplo.js";
import { montarDadosJs } from "../../src/arquivo.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test("selecionar dois, excluir selecionados com confirmação", async () => {
  const { page, ctx, erros } = await abrir(browser, { dados: baseExemplo(), hash: "#lancamentos", gravavel: true, quem: "Ana" });
  await page.waitForSelector("#tab-base tbody tr");
  const excluir = page.locator("[data-excluir-selecionados]");
  assert.equal(await excluir.isDisabled(), true);
  await page.locator("#tab-base input[data-sel]").nth(0).check();
  await page.locator("#tab-base input[data-sel]").nth(1).check();
  assert.match(await excluir.textContent(), /Excluir selecionados \(2\)/);
  await excluir.click();
  await page.waitForSelector("#dlg-confirma[open]");
  assert.match(await page.locator("#dlg-confirma-titulo").textContent(), /Excluir 2 CT-e/);
  await page.click("#dlg-confirma-ok");
  await page.waitForFunction(() => window.RADAR_APP.dados.lixeira.length === 2);
  assert.equal(await page.evaluate(() => window.RADAR_APP.dados.ctes.length), 5);
  assert.equal(await page.locator("#tab-base input[data-sel]:checked").count(), 0);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("selecionar todos marca só os CT-e da busca", async () => {
  const { page, ctx } = await abrir(browser, { dados: baseExemplo(), hash: "#lancamentos", gravavel: true, quem: "Ana" });
  await page.fill("#busca", "1");
  await page.waitForFunction(() => document.querySelectorAll("#tab-base tbody tr").length === 1);
  await page.check("#sel-todos");
  assert.match(await page.locator("[data-excluir-selecionados]").textContent(), /\(1\)/);
  await page.fill("#busca", "");
  await page.waitForFunction(() => document.querySelectorAll("#tab-base tbody tr").length === 7);
  assert.equal(await page.locator("#tab-base input[data-sel]:checked").count(), 1, "a seleção continua ao limpar a busca");
  await ctx.close();
});

/* A pasta falsa na página, com a subpasta de PDFs; window.open registra o que foi aberto. */
const FAKE = readFileSync(new URL("../fakes/pasta-falsa.js", import.meta.url), "utf8").replace(/^export /gm, "");
test("Abrir PDF: acha o PDF do CT-e na pasta e abre; sem PDF fica apagado", async () => {
  const dados = baseExemplo();
  const { page, ctx, erros } = await abrir(browser, {
    dados, hash: "#dados", quem: "Ana",
    antes: p => p.addInitScript(({ fake, texto }) => {
      eval(fake + "; window.__pasta = new PastaFalsa('Radar Carga Solta'); window.__pdfs = new PastaFalsa('PDFs Carga Solta');");
      window.__pasta.arquivos.set("radar-carga-solta-dados.js", texto);
      const pdfs = window.__pdfs;
      pdfs.arquivos.set("CTE 1 - Transportes Um.pdf", "%PDF-1.4");
      pdfs.arquivos.set("CTE 5 - Tres.pdf", "%PDF-1.4");
      window.__pasta.pastas.set("PDFs Carga Solta", pdfs);
      window.showDirectoryPicker = async () => window.__pasta;
      window.__abertos = []; window.open = url => { window.__abertos.push(url); return null; };
    }, { fake: FAKE, texto: montarDadosJs(dados) }),
  });
  await page.click("[data-conectar]");
  await page.waitForFunction(() => /Conectado à pasta/.test(document.body.textContent));
  await page.click("#abas button[data-aba=lancamentos]");
  await page.waitForSelector('#tab-base [data-pdf]:not([disabled])');
  assert.equal(await page.locator("#tab-base [data-pdf]:not([disabled])").count(), 2);
  const sem = page.locator(`#tab-base [data-pdf="${dados.ctes[1].chave}"]`);
  assert.equal(await sem.isDisabled(), true);
  assert.match(await sem.getAttribute("title"), /PDF não encontrado/);
  await page.click(`#tab-base [data-pdf="${dados.ctes[0].chave}"]`);
  await page.waitForFunction(() => window.__abertos.length === 1);
  assert.match(await page.evaluate(() => window.__abertos[0]), /^blob:/);
  // PDF novo na pasta: "Atualizar PDFs" encontra
  await page.evaluate(() => window.__pasta.pastas.get("PDFs Carga Solta").arquivos.set("CTE 2 - Transportes Um.pdf", "%PDF"));
  await page.click("[data-atualizar-pdfs]");
  await page.waitForFunction(() => document.querySelectorAll("#tab-base [data-pdf]:not([disabled])").length === 3);
  assert.deepEqual(erros, []);
  await ctx.close();
});
