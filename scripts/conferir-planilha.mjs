// Confere a importação contra uma planilha real (uso local; a planilha não vai para o repositório).
// Uso: node scripts/conferir-planilha.mjs caminho/Radar_Fretes_Concorrentes.xlsm
import { readFileSync } from "node:fs";
import XLSX from "xlsx";
import { novaBase, classificar, grupoDoCnpj, ctesNoCorte } from "../src/base.js";
import { CIDADES_AMBIGUAS } from "../src/dados-itinerarios.js";
import { excecoes } from "../src/agregacao.js";
import { sugerirClassificacao, pendentesDeClassificacao } from "../src/classificacao.js";
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
console.log("meses", meses.join(" "), "· a classificar na importação:", r.aClassificar);
const div = d.ctes.filter(c => c.divergencia), noCorte = ctesNoCorte(d);
console.log(JSON.stringify({ comItinerario: d.ctes.filter(c => c.itinerario).length, semItinerario: d.ctes.filter(c => !c.itinerario).length,
  cnpjDiferenteDaChave: div.filter(c => "cnpjTransportador" in c.divergencia.planilha).length,
  itinerarioDivergente: div.filter(c => "itinerario" in c.divergencia.planilha).length,
  tarifaDivergente: div.filter(c => "tarifa" in c.divergencia.planilha).length,
  corte: d.corte, foraPeloCorte: d.ctes.length - noCorte.length, noCorte: noCorte.length }));
const semCod = {};
for (const c of noCorte) if (!c.itinerario) { const k = `${c.origem} → ${c.destino}`; semCod[k] = (semCod[k] || 0) + 1; }
console.log("rotas sem itinerário no corte:", JSON.stringify(semCod));
const amb = d.ctes.filter(c => CIDADES_AMBIGUAS[c.origem] || CIDADES_AMBIGUAS[c.destino]).length;
console.log("CT-e com cidade homônima (sem código):", amb);
for (const c of div) if (!("tarifa" in c.divergencia.planilha)) console.log("diverge", c.numero, JSON.stringify(c.divergencia));
// aplica as sugestões da regra, como o botão "Aplicar marcados" faria
let aplicadas = 0;
for (const c of pendentesDeClassificacao(d)) {
  const s = sugerirClassificacao(d, c);
  if (s.produto && s.unidade && classificar(d, c.chave, s, "conferência", new Date().toISOString()).ok) aplicadas++;
}
const pend = pendentesDeClassificacao(d);
const fora = excecoes(d).filter(e => e.tipo === "preco-fora");
const porTipo = {};
for (const e of excecoes(d)) porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1;
console.log(JSON.stringify({ sugestoesAplicadas: aplicadas, pendentes: pend.length, precoFora: fora.length, excecoesNoCorte: porTipo }));
const porCliente = {};
for (const c of pend) { const n = grupoDoCnpj(d, c.cnpjCliente).nome; porCliente[n] = (porCliente[n] || 0) + 1; }
console.log("pendentes por cliente:", JSON.stringify(porCliente));
for (const e of fora) console.log("fora", e.cte.numero, grupoDoCnpj(d, e.cte.cnpjCliente).nome, e.cte.origem, "→", e.cte.destino, e.cte.quantidade, e.cte.unidade, e.cte.precoTonelada);
