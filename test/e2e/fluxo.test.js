import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, abrir } from "./ajuda.js";
import { baseExemplo } from "../fixtures/base-exemplo.js";
import { gerarPlanilha, linhaPadrao } from "../fixtures/planilha.js";
import { montarDadosJs } from "../../src/arquivo.js";

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

/* A pasta falsa dos testes de unidade, injetada na página como window.__pasta. */
const FAKE = readFileSync(new URL("../fakes/pasta-falsa.js", import.meta.url), "utf8").replace(/^export /gm, "");
const lerPasta = page => page.evaluate(() => {
  const t = window.__pasta.arquivos.get("radar-carga-solta-dados.js");
  return { dados: JSON.parse(t.slice(t.indexOf("window.RADAR_CS=") + 16).trim().replace(/;$/, "")), backups: window.__pasta.pastas.get("backups")?.arquivos.size || 0 };
});
const esperarGravado = (page, fn) => page.waitForFunction(fn, null, { timeout: 8000 });

test("fluxo completo com pasta simulada", async () => {
  const dados = baseExemplo();
  const { page, ctx, erros } = await abrir(browser, {
    dados, hash: "#dados", quem: "Ana",
    antes: p => p.addInitScript(({ fake, texto }) => {
      eval(fake + "; window.__pasta = new PastaFalsa('Radar Carga Solta');");
      window.__pasta.arquivos.set("radar-carga-solta-dados.js", texto);
      window.showDirectoryPicker = async () => window.__pasta;
    }, { fake: FAKE, texto: montarDadosJs(dados) }),
  });
  await page.click("[data-conectar]");
  await page.waitForFunction(() => /Conectado à pasta/.test(document.body.textContent));

  // importar
  const buf = Buffer.from(gerarPlanilha([linhaPadrao(901), linhaPadrao(902), linhaPadrao(903)]));
  await page.setInputFiles("#arq-planilha", { name: "Radar.xlsx", mimeType: "application/octet-stream", buffer: buf });
  await esperarGravado(page, () => window.__pasta.arquivos.get("radar-carga-solta-dados.js").includes('"numero":903'));
  assert.equal((await lerPasta(page)).dados.ctes.length, 10);
  assert.equal((await lerPasta(page)).dados.versao, 2);

  // classificar o que veio da planilha
  await page.waitForSelector("#classificar tbody tr");
  assert.equal(await page.locator("#classificar tbody tr").count(), 3);
  await page.click("#aplicar-classificacao");
  await esperarGravado(page, () => window.__pasta.arquivos.get("radar-carga-solta-dados.js").includes('"acao":"classificar"'));
  const pc = await lerPasta(page);
  assert.deepEqual(pc.dados.ctes.filter(c => c.numero > 900).map(c => [c.produto, c.unidade, c.precoTonelada]), [["ACUCAR", "TON", 175], ["ACUCAR", "TON", 175], ["ACUCAR", "TON", 175]]);

  // lançar, corrigir, excluir, restaurar
  await page.click("#abas button[data-aba=lancamentos]");
  await page.waitForSelector("#form-cte");
  const v = { chave: "35260105780969000146570010000999991000120718", emissao: "2026-05-04", cnpjTransportador: "11.111.111/0001-00",
    cnpjCliente: "44.209.336/0035-83", origem: "A", destino: "B", valorFrete: "8.750,00", quantidade: "50" };
  for (const [k, x] of Object.entries(v)) await page.fill(`#form-cte [name=${k}]`, x);
  await page.selectOption("#form-cte [name=produto]", "ACUCAR");
  await page.selectOption("#form-cte [name=unidade]", "TON");
  await page.click("#form-cte button[type=submit]");
  await esperarGravado(page, () => window.__pasta.arquivos.get("radar-carga-solta-dados.js").includes('"numero":99999'));
  await page.fill("#busca", "99999");
  await page.click("#tab-base [data-corrigir]");
  await page.fill("#form-cte [name=quantidade]", "70");
  await page.click("#form-cte button[type=submit]");
  await page.fill("#busca", "99999");
  await page.click("#tab-base [data-excluir]");
  await page.click("#dlg-confirma-ok");
  await page.click("#abas button[data-aba=dados]");
  await page.click("#tab-lixeira [data-restaurar]");
  await esperarGravado(page, () => {
    const t = window.__pasta.arquivos.get("radar-carga-solta-dados.js");
    return t.includes('"acao":"restaurar"') && document.querySelector("#estado-gravacao").textContent.includes("Tudo salvo");
  });
  const p1 = await lerPasta(page);
  assert.equal(p1.dados.ctes.length, 11);
  assert.equal(p1.dados.ctes.find(c => c.numero === 99999).precoTonelada, 125);
  assert.deepEqual(p1.dados.log.slice(-8).map(l => l.acao), ["importar", "classificar", "classificar", "classificar", "incluir", "corrigir", "excluir", "restaurar"]);
  assert.equal(p1.dados.salvoPor, "Ana");
  assert.ok(p1.backups >= 1);

  // outra pessoa grava; esta página altera e encontra o conflito
  await page.evaluate(() => {
    const p = window.__pasta, t = p.arquivos.get("radar-carga-solta-dados.js");
    const d = JSON.parse(t.slice(t.indexOf("window.RADAR_CS=") + 16).trim().replace(/;$/, ""));
    const outro = { ...d.ctes[0], chave: "9".repeat(44), numero: 777, criadoPor: "Bia" };
    d.ctes.push(outro); d.salvoEm = new Date(Date.now() + 1000).toISOString(); d.salvoPor = "Bia";
    p.arquivos.set("radar-carga-solta-dados.js", "window.RADAR_CS=" + JSON.stringify(d) + ";");
  });
  await page.click("#abas button[data-aba=lancamentos]");
  await page.fill("#busca", "99999");
  await page.click("#tab-base [data-excluir]");
  await page.click("#dlg-confirma-ok");
  await page.waitForSelector("#aviso-fixo.conflito", { timeout: 8000 });
  assert.match(await page.locator("#aviso-fixo").textContent(), /Bia gravou/);
  await page.click("#aviso-fixo [data-acao=juntar]");
  await esperarGravado(page, () => document.querySelector("#estado-gravacao").textContent.includes("Tudo salvo"));
  const p2 = await lerPasta(page);
  assert.ok(p2.dados.ctes.some(c => c.numero === 777), "lançamento da Bia preservado");
  assert.ok(!p2.dados.ctes.some(c => c.numero === 99999), "exclusão desta página aplicada");
  assert.ok(p2.dados.lixeira.some(l => l.cte.numero === 99999));
  assert.ok(await page.evaluate(() => window.RADAR_APP.dados.ctes.some(c => c.numero === 777)), "a tela mostra o lançamento da Bia");
  assert.deepEqual(erros, []);
  await ctx.close();
});
