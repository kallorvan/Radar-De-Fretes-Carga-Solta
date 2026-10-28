// referencia/toliman-paineis/tokens.json → build/tokens.css (variáveis CSS do Tóliman Painéis).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const t = JSON.parse(readFileSync(new URL("../referencia/toliman-paineis/tokens.json", import.meta.url), "utf8"));
const linhas = [];
for (const fam of ["color", "spacing", "radius", "shadow", "size"])
  for (const tok of t[fam]?.tokens || []) linhas.push(`  --${tok.name}:${typeof tok.value === "object" ? tok.value.light : tok.value};`);
for (const [k, v] of Object.entries(t.type.families)) linhas.push(`  --font-${k}:${v};`);
mkdirSync(new URL("../build/", import.meta.url), { recursive: true });
writeFileSync(new URL("../build/tokens.css", import.meta.url), `/* ${t.name} — gerado de tokens.json */\n:root{\n${linhas.join("\n")}\n}\n`);
