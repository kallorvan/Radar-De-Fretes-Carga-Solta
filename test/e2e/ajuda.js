// Abre o painel montado no Chromium: copia dist/index.html para uma pasta temporária (file://),
// com o arquivo de dados ao lado, e serve o SheetJS do node_modules em vez do cdnjs.
import { createRequire } from "node:module";
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { montarDadosJs } from "../../src/arquivo.js";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");
const XLSX_JS = readFileSync(new URL("../../node_modules/xlsx/dist/xlsx.full.min.js", import.meta.url), "utf8");
const DIST = new URL("../../dist/index.html", import.meta.url).pathname;

export async function abrir(browser, { dados = null, hash = "", largura = 1280, altura = 900, tema = "light", antes = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "radar-cs-"));
  copyFileSync(DIST, join(dir, "index.html"));
  if (dados) writeFileSync(join(dir, "radar-carga-solta-dados.js"), montarDadosJs(dados));
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, colorScheme: tema, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", e => erros.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND|fonts\.googleapis|fonts\.gstatic|net::/.test(m.text())) erros.push(m.text()); });
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ body: XLSX_JS, contentType: "text/javascript" }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (antes) await antes(page, dir);
  await page.goto("file://" + join(dir, "index.html") + hash);
  return { page, ctx, dir, erros };
}

export const semRolagemHorizontal = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
