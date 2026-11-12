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
  // favicon do design system: o símbolo Dínamo (mark-red, mark-yellow, plum) sobre navy, como no Radar Container
  const icone = decodeURIComponent((html.match(/<link rel="icon" type="image\/svg\+xml" href='data:image\/svg\+xml,([^']+)'>/) || [])[1] || "");
  for (const cor of ["#112346", "#D50032", "#FFD34D", "#8E5AA8"]) assert.ok(icone.includes(cor), cor);
  assert.ok(!html.includes("/*CSS*/") && !html.includes("/*JS*/") && !html.includes("{{"));
  const app = html.slice(html.indexOf('<script id="app">'));
  assert.equal((app.match(/<\/script/g) || []).length, 1);
});
