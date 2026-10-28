// Gera src/dados-itinerarios.js a partir do relatório de itinerários do Rodopar (itinerarios.xlsx).
// Uso: node scripts/extrair-itinerarios.mjs caminho/itinerarios.xlsx
// Cada itinerário tem código de 6 letras = 3 da cidade de origem + 3 da de destino, e as cidades com UF ("MACHADO/MG").
// Daí sai o código de cada cidade (o mais usado, se alguma linha divergir). Cidade com o mesmo nome em mais de
// uma UF (o CT-e não guarda a UF) fica com a UF de mais itinerários cadastrados (no empate, a UF mais usada no
// relatório); as outras vão listadas no arquivo.
import { readFileSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";
import { normalizarCidade } from "../src/calculos.js";

const arq = process.argv[2];
if (!arq) { console.error("Informe o caminho do relatório de itinerários."); process.exit(2); }
const wb = XLSX.read(readFileSync(arq), { type: "buffer" });
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });

const usos = {};   // "MACHADO/MG" → { MCH: 250 }
let itinerarios = 0;
for (const [codigo, inicio, fim] of linhas) {
  const c = String(codigo).trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) continue;   // cabeçalhos repetidos e linhas de grupo
  itinerarios++;
  for (const [ponto, trecho] of [[inicio, c.slice(0, 3)], [fim, c.slice(3)]]) {
    const [cidade, uf = ""] = String(ponto).split("/").map(s => normalizarCidade(s));
    if (!cidade) continue;
    const k = `${cidade}/${uf}`;
    (usos[k] ||= {})[trecho] = (usos[k][trecho] || 0) + 1;
  }
}

const porNome = {};
for (const [k, cods] of Object.entries(usos)) {
  const [cidade, uf] = k.split("/");
  const [codigo] = Object.entries(cods).sort((a, b) => b[1] - a[1])[0];
  const n = Object.values(cods).reduce((s, x) => s + x, 0);
  (porNome[cidade] ||= []).push({ uf, codigo, itinerarios: n });
}
// empate entre homônimas: vale a UF com mais itinerários no relatório inteiro (onde a Tóliman mais roda)
const pesoUf = {};
for (const ufs of Object.values(porNome)) for (const x of ufs) pesoUf[x.uf] = (pesoUf[x.uf] || 0) + x.itinerarios;
const codigos = {}, homonimas = {};
for (const [cidade, ufs] of Object.entries(porNome)) {
  ufs.sort((a, b) => b.itinerarios - a.itinerarios || (pesoUf[b.uf] || 0) - (pesoUf[a.uf] || 0) || a.uf.localeCompare(b.uf));
  codigos[cidade] = ufs[0].codigo;
  if (ufs.length > 1) homonimas[cidade] = ufs;
}

const corpo = Object.keys(codigos).sort().map(c => `  ${JSON.stringify(c)}: ${JSON.stringify(codigos[c])},`);
writeFileSync(new URL("../src/dados-itinerarios.js", import.meta.url),
  "// Gerado por scripts/extrair-itinerarios.mjs a partir do relatório de itinerários do Rodopar.\n" +
  "// Não edite à mão: quando o Rodopar ganhar cidade, rode o script de novo com o relatório atualizado e monte o painel.\n" +
  `// ${itinerarios} itinerários, ${corpo.length} cidades.\n` +
  "export const CODIGOS_CIDADE = {\n" + corpo.join("\n") + "\n};\n" +
  "// Mesmo nome em mais de uma UF: vale a primeira da lista (a de mais itinerários cadastrados).\n" +
  "export const CIDADES_HOMONIMAS = " + JSON.stringify(homonimas) + ";\n");
console.log(`${itinerarios} itinerários, ${corpo.length} cidades; homônimas: ` +
  (Object.entries(homonimas).map(([c, u]) => `${c} (${u.map(x => `${x.uf} ${x.codigo} ${x.itinerarios}`).join(" · ")})`).join("; ") || "nenhuma"));
