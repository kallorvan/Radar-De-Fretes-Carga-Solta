// Confere a importação contra uma planilha real (uso local; a planilha não vai para o repositório).
// Uso: node scripts/conferir-planilha.mjs caminho/Radar_Fretes_Concorrentes.xlsm
import { readFileSync } from "node:fs";
import XLSX from "xlsx";
import { novaBase } from "../src/base.js";
import { lerPlanilha, aplicarImportacao } from "../src/importacao.js";

const arq = process.argv[2];
if (!arq) { console.error("Informe o caminho da planilha."); process.exit(2); }
const buf = readFileSync(arq);
const res = lerPlanilha(XLSX, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
if (res.erro) { console.error(res.erro); process.exit(1); }
const d = novaBase();
const r = aplicarImportacao(d, res, "conferência", new Date().toISOString());
console.log(JSON.stringify({ incluidos: r.incluidos, pulados: r.pulados, rejeitados: r.rejeitados.length,
  divergentes: r.divergentes, cadastrados: r.cadastrados, cnpjsNaAba: res.cnpjs.length }));
for (const x of r.rejeitados) console.log("rejeitada", x.numLinha, x.motivo);
const meses = [...new Set(d.ctes.map(c => c.emissao.slice(0, 7)))].sort();
console.log("meses", meses.join(" "));
