// Gera src/dados-itinerarios.js a partir das abas LINHA SANTOS e LINHA GUARUJÁ (cadastro do Rodopar).
// Uso: node scripts/extrair-itinerarios.mjs caminho/Radar_Fretes_Concorrentes.xlsm
// Lê só as colunas A (cidade) e B (código de 3 letras); o bloco da direita das abas é ignorado.
// Cidade com dois códigos (homônimas de estados diferentes; as abas não trazem a UF) fica sem código.
import { readFileSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";
import { normalizarCidade } from "../src/calculos.js";

const arq = process.argv[2];
if (!arq) { console.error("Informe o caminho da planilha."); process.exit(2); }
const wb = XLSX.read(readFileSync(arq), { type: "buffer" });
const ABAS = ["LINHA SANTOS", "LINHA GUARUJA"];
const codigos = {}, ambiguas = {};
for (const alvo of ABAS) {
  const nome = wb.SheetNames.find(n => normalizarCidade(n) === alvo);
  if (!nome) { console.error(`A planilha não tem a aba ${alvo}.`); process.exit(1); }
  for (const [cidade, codigo] of XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: "" }).slice(1)) {
    const c = normalizarCidade(cidade), k = String(codigo).trim().toUpperCase();
    if (!c || !/^[A-Z]{3}$/.test(k)) continue;
    (ambiguas[c] ||= new Set()).add(k);
    codigos[c] = k;
  }
}
for (const [c, ks] of Object.entries(ambiguas)) if (ks.size > 1) { delete codigos[c]; ambiguas[c] = [...ks].sort(); } else delete ambiguas[c];
const linhas = Object.keys(codigos).sort().map(c => `  ${JSON.stringify(c)}: ${JSON.stringify(codigos[c])},`);
writeFileSync(new URL("../src/dados-itinerarios.js", import.meta.url),
  "// Gerado por scripts/extrair-itinerarios.mjs a partir das abas LINHA SANTOS e LINHA GUARUJÁ (cadastro do Rodopar).\n" +
  "// Não edite à mão: quando o Rodopar ganhar cidade, rode o script de novo com a planilha atualizada e monte o painel.\n" +
  "export const CODIGOS_CIDADE = {\n" + linhas.join("\n") + "\n};\n" +
  "// Mesmo nome com dois códigos (estados diferentes): sem a UF não dá para escolher, o itinerário fica em branco.\n" +
  "export const CIDADES_AMBIGUAS = " + JSON.stringify(ambiguas) + ";\n");
console.log(`${linhas.length} cidades; sem código por ter dois: ${Object.keys(ambiguas).join(", ") || "nenhuma"}`);
