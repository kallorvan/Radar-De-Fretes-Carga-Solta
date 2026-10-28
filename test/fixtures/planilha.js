// Gera planilhas fictícias com o mesmo layout da Radar_Fretes_Concorrentes (abas de carga solta e CNPJ).
import XLSX from "xlsx";

export const CABECALHO = ["CHAVE DE ACESSO", "N° CT-e", "EMISSÃO CT-e", "CNPJ DO TRANSPORTADOR", "TRANSPORTADOR",
  "CNPJ DO CLIENTE", "CLIENTE", "CIDADE ORIGEM", "CIDADE DESTINO", "COD. ITINERÁRIO", "VALOR ASSEGURADO",
  "TAXA DO SEGURO", "VALOR DO SEGURO", "VALOR DO FRETE", "ADICIONAIS", "QT. SACAS", "PREÇO POR SACAS",
  "TARIFA DO FRETE", "VPO", "OBSERVAÇÕES"];

/* linha: objeto com as chaves do CABECALHO (as ausentes ficam vazias) */
export const linhaPadrao = (n, extra = {}) => {
  const l = {
  "CHAVE DE ACESSO": "352601057809690001465700100" + String(n).padStart(8, "0") + "100012071",
  "N° CT-e": n, "EMISSÃO CT-e": new Date(Date.UTC(2026, 0, 10)),
  "CNPJ DO TRANSPORTADOR": "05.780.969/0001-46", "TRANSPORTADOR": "JF PEREIRA TRANSPORTES",
  "CNPJ DO CLIENTE": "44.209.336/0035-83", "CLIENTE": "USINA ALTA MOGIANA",
  "CIDADE ORIGEM": "SAO JOAQUIM DA BARRA", "CIDADE DESTINO": "SANTOS", "COD. ITINERÁRIO": null,
  "VALOR ASSEGURADO": 119322.29, "TAXA DO SEGURO": 0, "VALOR DO SEGURO": 0, "VALOR DO FRETE": 8750,
  "ADICIONAIS": 0, "QT. SACAS": 50, "PREÇO POR SACAS": 175, "TARIFA DO FRETE": 8750, "VPO": null, "OBSERVAÇÕES": null,
  ...extra,
  };
  // a chave leva o CNPJ do transportador (posições 7 a 20), salvo quando o teste traz a sua
  if (!("CHAVE DE ACESSO" in extra) && l["CNPJ DO TRANSPORTADOR"])
    l["CHAVE DE ACESSO"] = l["CHAVE DE ACESSO"].slice(0, 6) + String(l["CNPJ DO TRANSPORTADOR"]).replace(/\D/g, "").padStart(14, "0") + l["CHAVE DE ACESSO"].slice(20);
  return l;
};

export function gerarPlanilha(linhas, cnpjs = [[5780969000146, "JF PEREIRA TRANSPORTES E SERVIÇOS LTDA"]], { semAbaBase = false } = {}) {
  const wb = XLSX.utils.book_new();
  if (!semAbaBase) {
    // colunas além das da planilha atual (PRODUTO, QUANTIDADE…) vão no fim; "QT. SACAS": undefined tira a coluna
    const extras = [...new Set(linhas.flatMap(Object.keys))].filter(h => !CABECALHO.includes(h));
    const cab = [...CABECALHO.filter(h => !linhas.length || linhas.some(l => l[h] !== undefined)), ...extras];
    const aoa = [cab, ...linhas.map(l => cab.map(h => l[h] ?? null))];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "BASE CARGA SOLTA 2026");
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["CNPJ", "TRANSPORTADOR/CLIENTE"], ...cnpjs]), "BASE DE DADOS CNPJ");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer;
}
