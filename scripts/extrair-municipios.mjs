// Gera src/dados-municipios.js a partir da aba MUNICÍPIOS da planilha Radar_Fretes_Concorrentes (uma coluna, sem UF).
// Uso: node scripts/extrair-municipios.mjs caminho/Radar_Fretes_Concorrentes.xlsm
import { readFileSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";
import { normalizarCidade } from "../src/calculos.js";

const arq = process.argv[2];
if (!arq) { console.error("Informe o caminho da planilha."); process.exit(2); }
const wb = XLSX.read(readFileSync(arq), { type: "buffer" });
const aba = wb.SheetNames.find(n => normalizarCidade(n) === "MUNICIPIOS");
if (!aba) { console.error("A planilha não tem a aba MUNICÍPIOS."); process.exit(1); }
const nomes = new Set();
for (const [nome] of XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: "" }).slice(1)) {
  const n = normalizarCidade(nome);
  if (n && n !== "MUNICIPIOS") nomes.add(n);
}
const lista = [...nomes].sort();
writeFileSync(new URL("../src/dados-municipios.js", import.meta.url),
  "// Gerado por scripts/extrair-municipios.mjs a partir da aba MUNICÍPIOS da planilha Radar_Fretes_Concorrentes.\n" +
  "// Nomes sem acento e em maiúsculas, como o painel grava as cidades; homônimos de UF diferentes aparecem uma vez.\n" +
  `export const MUNICIPIOS = ${JSON.stringify(lista)};\n`);
console.log(`${lista.length} municípios`);
