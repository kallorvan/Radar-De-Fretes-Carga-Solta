// Importação da planilha Radar_Fretes_Concorrentes (abas BASE CARGA SOLTA 2026 e BASE DE DADOS CNPJ)
// e exportação no mesmo layout. O SheetJS (XLSX) é recebido como argumento.

import { normalizarCnpj, numeroBR, arred2 } from "./calculos.js";
import { validarCampos, incluir, cadastrarCnpj, nomeDoCnpj, registrar, unidadeDe, produtoDe, precosDaTarifa } from "./base.js";
import { semeiaProdutosPadrao } from "./classificacao.js";

export const ABA_BASE = "BASE CARGA SOLTA 2026";
export const ABA_CNPJ = "BASE DE DADOS CNPJ";
export const TOLERANCIA = 0.05;

const COL = {
  chave: "CHAVE DE ACESSO", numero: "N° CT-E", emissao: "EMISSÃO CT-E",
  cnpjTransportador: "CNPJ DO TRANSPORTADOR", transportador: "TRANSPORTADOR",
  cnpjCliente: "CNPJ DO CLIENTE", cliente: "CLIENTE", origem: "CIDADE ORIGEM", destino: "CIDADE DESTINO",
  itinerario: "COD. ITINERÁRIO", valorAssegurado: "VALOR ASSEGURADO", taxaSeguro: "TAXA DO SEGURO",
  valorSeguro: "VALOR DO SEGURO", valorFrete: "VALOR DO FRETE", adicionais: "ADICIONAIS", quantidade: "QT. SACAS",
  precoSaca: "PREÇO POR SACAS", tarifa: "TARIFA DO FRETE", vpo: "VPO", observacoes: "OBSERVAÇÕES",
};
const COL_NOVAS = { produto: "PRODUTO", unidade: "UNIDADE", pesoKg: "PESO (KG)", precoTonelada: "PREÇO POR TONELADA" };
const chaveCab = s => String(s ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const semAcento = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
/* Nome da planilha ("Café", "saca 60 kg", "BAG") → id da lista, comparando sem acento; desconhecido = null. */
const acharNaLista = (lista, valor) => {
  const v = semAcento(valor);
  return v ? lista.find(x => semAcento(x.id) === v || semAcento(x.nome) === v)?.id ?? null : null;
};

/* Data da planilha (série do Excel, Date ou "dd/mm/aaaa") → "aaaa-mm-dd". */
function dataISO(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5);
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) return isNaN(v) ? "" : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : "";
}

export function lerPlanilha(XLSX, dados) {
  const wb = XLSX.read(new Uint8Array(dados), { type: "array", cellDates: false });
  const nomeAba = alvo => wb.SheetNames.find(n => chaveCab(n) === alvo);
  const base = nomeAba(ABA_BASE);
  if (!base) return { linhas: [], cnpjs: [], erro: `A planilha não tem a aba ${ABA_BASE}.` };
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[base], { defval: null, raw: true, blankrows: true })
    .map(l => Object.fromEntries(Object.entries(l).map(([k, v]) => [chaveCab(k), v])));
  const abaCnpj = nomeAba(ABA_CNPJ);
  const cnpjs = abaCnpj ? XLSX.utils.sheet_to_json(wb.Sheets[abaCnpj], { header: 1, defval: null, raw: true })
    .slice(1).map(([cnpj, nome]) => ({ cnpj: normalizarCnpj(cnpj), nome: String(nome ?? "").trim() }))
    .filter(c => c.cnpj.length === 14 && c.nome) : [];
  return { linhas, cnpjs };
}

const vazia = l => Object.values(l).every(v => v == null || String(v).trim() === "");

export function normalizarLinha(d, linhaBruta, numLinha) {
  const l = Object.fromEntries(Object.entries(linhaBruta).map(([k, v]) => [chaveCab(k), v]));
  const g = k => k === "quantidade" ? l["QUANTIDADE"] ?? l["QT. SACAS"] : l[COL[k] ?? COL_NOVAS[k]];
  const produto = acharNaLista(d.produtos, g("produto")), unidade = acharNaLista(d.unidades, g("unidade"));
  // o seguro vem do CT-e; planilha antiga sem o valor: assegurado × taxa
  const assegurado = numeroBR(g("valorAssegurado")), taxa = numeroBR(g("taxaSeguro"));
  const valorSeguro = numeroBR(g("valorSeguro")) ?? (assegurado && taxa ? arred2(assegurado * taxa) : 0);
  const quantidade = numeroBR(g("quantidade")), pesoLido = numeroBR(g("pesoKg")), u = unidadeDe(d, unidade);
  // o peso da planilha só conta como "do CT-e" quando difere do calculado pela unidade
  const pesoInformado = pesoLido > 0 && !(u?.kg > 0 && quantidade > 0 && Math.abs(pesoLido - quantidade * u.kg) < 0.5);
  const campos = {
    chave: String(g("chave") ?? "").replace(/\D/g, ""), numero: g("numero"), emissao: dataISO(g("emissao")),
    cnpjTransportador: normalizarCnpj(g("cnpjTransportador")), cnpjCliente: normalizarCnpj(g("cnpjCliente")),
    origem: g("origem") ?? "", destino: g("destino") ?? "", itinerario: g("itinerario") ?? "",
    valorAssegurado: assegurado, valorSeguro,
    valorFrete: numeroBR(g("valorFrete")), adicionais: numeroBR(g("adicionais")), quantidade,
    produto, unidade, pesoKg: pesoInformado ? pesoLido : null, pesoInformado,
    vpo: String(g("vpo") ?? "").trim().toUpperCase() === "SIM",
    observacoes: g("observacoes") ?? "",
  };
  const v = validarCampos(d, campos, { exigirClassificacao: false });
  if (!v.ok) return { ok: false, numLinha, motivo: Object.values(v.erros).join(" ") };
  return {
    ok: true, numLinha, campos: v.campos,
    planilha: { tarifa: numeroBR(g("tarifa")), precoSaca: numeroBR(g("precoSaca")) },
    nomes: { transportador: String(g("transportador") ?? "").trim(), cliente: String(g("cliente") ?? "").trim() },
  };
}

export function aplicarImportacao(d, resultado, quem, agora) {
  const logAntes = d.log.slice();
  const r = { incluidos: 0, pulados: 0, rejeitados: [], cadastrados: 0, divergentes: 0, aClassificar: 0 };
  const cadastra = (cnpj, nome) => {
    if (cnpj && nome && !nomeDoCnpj(d, cnpj) && cadastrarCnpj(d, cnpj, nome, quem, agora).ok) r.cadastrados++;
  };
  for (const c of resultado.cnpjs || []) cadastra(c.cnpj, c.nome);
  (resultado.linhas || []).forEach((bruta, i) => {
    if (vazia(bruta)) return;
    const n = normalizarLinha(d, bruta, i + 2);
    if (!n.ok) { r.rejeitados.push({ numLinha: n.numLinha, motivo: n.motivo }); return; }
    cadastra(n.campos.cnpjTransportador, n.nomes.transportador);
    cadastra(n.campos.cnpjCliente, n.nomes.cliente);
    // sem produto/unidade válidos (ou big bag sem peso) entra mesmo assim, para classificar depois
    const classificado = !Object.keys(validarCampos(d, n.campos).erros).length;
    const inc = incluir(d, n.campos, quem, agora, "importacao", { exigirClassificacao: false });
    if (!inc.ok) { r.pulados++; return; }
    r.incluidos++;
    if (!classificado) {   // fica só o produto, se ele for conhecido; unidade e peso voltam na classificação
      Object.assign(inc.cte, { unidade: null, pesoKg: null, pesoInformado: false, precoTonelada: null, precoSaca: null });
      r.aClassificar++;
    }
    const calc = { tarifa: inc.cte.tarifa };   // o seguro é o da planilha: não há o que conferir
    const ehSaca = unidadeDe(d, inc.cte.unidade)?.saca;
    const conferir = { ...calc, ...(ehSaca ? { precoSaca: inc.cte.precoSaca } : {}) };
    const difere = Object.keys(conferir).some(k => n.planilha[k] != null && conferir[k] != null &&
      Math.abs(conferir[k] - n.planilha[k]) > TOLERANCIA);
    if (difere) {
      const planilha = {};
      for (const k of ["tarifa"]) if (n.planilha[k] != null) { planilha[k] = n.planilha[k]; inc.cte[k] = n.planilha[k]; }
      if (n.planilha.precoSaca != null) planilha.precoSaca = n.planilha.precoSaca;
      inc.cte.divergencia = { calculado: { ...calc, precoSaca: inc.cte.precoSaca }, planilha };
      precosDaTarifa(d, inc.cte);
      r.divergentes++;
    }
  });
  semeiaProdutosPadrao(d);
  // um registro só para a importação inteira
  d.log.splice(0, d.log.length, ...logAntes);
  registrar(d, "importar", quem, agora, "",
    `${r.incluidos} incluídos, ${r.pulados} já existiam, ${r.rejeitados.length} rejeitados, ${r.cadastrados} CNPJ cadastrados` +
    (r.divergentes ? `, ${r.divergentes} com cálculo divergente` : "") + (r.aClassificar ? `, ${r.aClassificar} a classificar` : ""));
  return r;
}

/* A base no mesmo layout da planilha (abas BASE CARGA SOLTA 2026 e BASE DE DADOS CNPJ). */
export function exportarXlsx(d, XLSX) {
  const COLS = [...Object.values(COL).map(c => c === "N° CT-E" ? "N° CT-e" : c === "EMISSÃO CT-E" ? "EMISSÃO CT-e" : c), ...Object.values(COL_NOVAS)];
  const serie = iso => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5;
  const linhas = [...d.ctes].sort((a, b) => a.emissao.localeCompare(b.emissao) || a.numero - b.numero).map(c => [
    c.chave, c.numero, serie(c.emissao), c.cnpjTransportador, nomeDoCnpj(d, c.cnpjTransportador) || "",
    c.cnpjCliente, nomeDoCnpj(d, c.cnpjCliente) || "", c.origem, c.destino, c.itinerario || null,
    c.valorAssegurado, c.taxaSeguro, c.valorSeguro, c.valorFrete, c.adicionais, c.quantidade, c.precoSaca, c.tarifa,
    c.vpo ? "SIM" : null, c.observacoes || null,
    produtoDe(d, c.produto)?.nome ?? null, unidadeDe(d, c.unidade)?.nome ?? null, c.pesoKg ?? null, c.precoTonelada ?? null,
  ]);
  const base = XLSX.utils.aoa_to_sheet([COLS, ...linhas]);
  for (let i = 0; i < linhas.length; i++) { const cel = base[XLSX.utils.encode_cell({ r: i + 1, c: 2 })]; if (cel) cel.z = "dd/mm/yyyy"; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, base, ABA_BASE);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["CNPJ", "TRANSPORTADOR/CLIENTE"], ...d.cnpjs.map(c => [c.cnpj, c.nome])]), ABA_CNPJ);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer;
}
