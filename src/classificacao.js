// Sugestão de produto e unidade para CT-e sem classificação (o histórico da planilha, por exemplo).
// Produto: o produto padrão do cliente. Unidade: até 100 é tonelada; acima, saca do produto.

import { calcularCte, normalizarCnpj } from "./calculos.js";
import { unidadeDe, nomeDoCnpj } from "./base.js";

export const LIMITE_TONELADA = 100;
const SACA_DO_PRODUTO = { CAFE: "SC60", ACUCAR: "SC50" };
const CLIENTES = {
  CAFE: ["EISA", "STONEX", "OLAM", "LOUIS DREYFUS", "SUCAFINA", "EXPOCACER", "UNICAFE", "COFCO", "RS TRADE", "NOVO RUMO", "ALTO CAFEZAL"],
  ACUCAR: ["USINA", "ACUCAR", "COPLASA", "CENTRAL ENERGETICA", "BIOENERGETICA", "COLOMBO AGROINDUSTRIA", "NARDINI"],
};
const semAcento = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export function sugerirProdutoCliente(nome) {
  const n = semAcento(nome);
  for (const [produto, chaves] of Object.entries(CLIENTES)) if (chaves.some(k => n.includes(k))) return produto;
  return null;
}

/* Preenche o produto padrão dos CNPJ que ainda não têm (sem registrar no histórico: é uma sugestão inicial). */
export function semeiaProdutosPadrao(d) {
  let n = 0;
  for (const c of d.cnpjs) {
    if (c.produtoPadrao !== undefined && c.produtoPadrao !== null) continue;
    const p = sugerirProdutoCliente(c.nome);
    if (p) { c.produtoPadrao = p; n++; }
  }
  return n;
}

export function sugerirClassificacao(d, cte) {
  const cli = d.cnpjs.find(c => c.cnpj === normalizarCnpj(cte.cnpjCliente));
  const produto = cte.produto || cli?.produtoPadrao || null;
  if (!produto) return { produto: null, unidade: null, pesoKg: null, precoTonelada: null,
    motivo: `cliente ${cli ? nomeDoCnpj(d, cli.cnpj) : "sem cadastro"} sem produto padrão` };
  const ton = cte.quantidade <= LIMITE_TONELADA;
  const unidade = cte.unidade || (ton ? "TON" : SACA_DO_PRODUTO[produto] || null);
  const u = unidadeDe(d, unidade);
  const calc = u ? calcularCte({ ...cte, unidade: u }) : { pesoKg: null, precoTonelada: null };
  return {
    produto, unidade, pesoKg: calc.pesoKg, precoTonelada: calc.precoTonelada,
    motivo: `${cte.produto ? "produto do CT-e" : "produto padrão do cliente"}; ` +
      (cte.unidade ? "unidade do CT-e" : `${cte.quantidade} ${ton ? "≤" : ">"} ${LIMITE_TONELADA} → ${u ? u.nome.toLowerCase() : "sem saca para o produto"}`),
  };
}

export const pendentesDeClassificacao = d => d.ctes.filter(c => !c.produto || !c.unidade);
