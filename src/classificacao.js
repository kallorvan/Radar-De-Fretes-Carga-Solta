// Sugestão de produto e unidade para CT-e sem classificação (o histórico da planilha, por exemplo).
// Produto: o produto padrão do cliente. Unidade: até 100 é tonelada; acima, saca do produto.

import { calcularCte, normalizarCnpj } from "./calculos.js";
import { unidadeDe, nomeDoCnpj, ctesNoCorte } from "./base.js";
import { sugerirProdutoCliente } from "./produtos-clientes.js";

export { sugerirProdutoCliente };

export const LIMITE_TONELADA = 100;
const SACA_DO_PRODUTO = { CAFE: "SC60", ACUCAR: "SC50" };

/* Preenche o produto padrão dos CNPJ que nunca tiveram um (sem registrar no histórico: é uma sugestão inicial).
   null é "nenhum" escolhido pela pessoa e fica como está. */
export function semeiaProdutosPadrao(d) {
  let n = 0;
  for (const c of d.cnpjs) {
    if (c.produtoPadrao !== undefined) continue;
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

export const pendentesDeClassificacao = d => ctesNoCorte(d).filter(c => !c.produto || !c.unidade);
