import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("montar gera dist/index.html num arquivo só", () => {
  execSync("npm run montar --silent", { stdio: "pipe" });
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Radar de Fretes · Carga Solta<\/title>/);
  assert.match(html, /--accent:\s*#e4536c/);
  assert.match(html, /<script src="radar-carga-solta-dados\.js"><\/script>/);
  assert.match(html, /cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/0\.18\.5\/xlsx\.full\.min\.js/);
  // a assinatura Dínamo | Tóliman é uma imagem só, em branco no menu lateral azul-marinho
  assert.equal((html.match(/<img src="data:image\/png;base64,/g) || []).length, 1);
  assert.match(html, /<img[^>]+alt="Grupo Dínamo e Tóliman Transportes"/);
  // favicon do design system Tóliman (Layout Base): SVG com as três faixas, PNG de 32 px e o ícone de 180 px
  const svg = Buffer.from((html.match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,([^"]+)">/) || [])[1] || "", "base64").toString();
  for (const cor of ["#D84864", "#F0CE88", "#A881AE"]) assert.ok(svg.includes(cor), cor);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="data:image\/png;base64,/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="data:image\/png;base64,/);
  assert.ok(!html.includes("/*CSS*/") && !html.includes("/*JS*/") && !html.includes("{{"));
  const app = html.slice(html.indexOf('<script id="app">'));
  assert.equal((app.match(/<\/script/g) || []).length, 1);
});
