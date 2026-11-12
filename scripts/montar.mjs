// Junta código, estilo e logos num único dist/index.html (o painel é aberto direto da pasta, file://).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";

const raiz = new URL("../", import.meta.url);
const ler = p => readFileSync(new URL(p, raiz), "utf8");
const png = p => "data:image/png;base64," + readFileSync(new URL(p, raiz)).toString("base64");

const js = (await build({
  entryPoints: [new URL("src/app.js", raiz).pathname], bundle: true, format: "iife",
  target: "es2020", minify: false, write: false, charset: "utf8", legalComments: "none",
})).outputFiles[0].text;

const css = [ler("build/tokens.css"), ler("referencia/toliman-paineis/bundle.css"), ler("src/estilo/app.css")].join("\n");

const html = ler("src/index.template.html")
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => js.split("</script").join("<\\/script"))
  // assinatura Dínamo | Tóliman gerada por scripts/montar-logos.py
  .replace("{{LOGOS_BRANCO}}", png("referencia/toliman-paineis/logos-lateral.png"))
  // favicon do design system Tóliman (artefato Layout Base: favicon.svg, favicon-32.png, apple-touch-icon.png)
  .replace("{{FAVICON_SVG}}", "data:image/svg+xml;base64," + readFileSync(new URL("referencia/toliman-paineis/favicon.svg", raiz)).toString("base64"))
  .replace("{{FAVICON_32}}", png("referencia/toliman-paineis/favicon-32.png"))
  .replace("{{APPLE_TOUCH}}", png("referencia/toliman-paineis/apple-touch-icon.png"));

mkdirSync(new URL("dist/", raiz), { recursive: true });
writeFileSync(new URL("dist/index.html", raiz), html);
console.log(`dist/index.html · ${(html.length / 1024).toFixed(0)} KB`);
