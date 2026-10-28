// Regras do CT-e de carga solta: fórmulas da planilha, CNPJ, chave de acesso e chaves de agrupamento.

import { CODIGOS_CIDADE } from "./dados-itinerarios.js";

export const arred2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

export const soDigitos = v => String(v ?? "").replace(/\D/g, "");

/* Aceita número JS, "1.234,56" (pt-BR) e "1234.56". Vazio ou inválido = null. */
export function numeroBR(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim().replace(/^R\$\s*/, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");   // "8.750" é milhar, não decimal
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const arred6 = n => Math.round((n + Number.EPSILON) * 1e6) / 1e6;

/* Fórmulas da aba BASE CARGA SOLTA 2026, mais peso e R$/t, arredondando cada passo.
   O CT-e traz o valor assegurado e o valor do seguro; a taxa é só conferência (vazia sem assegurado).
   unidade = { kg, saca } da lista de unidades; o peso informado (do CT-e) vale sobre o calculado. */
export function calcularCte({ valorAssegurado, valorSeguro: seguro, valorFrete, adicionais, quantidade, unidade = null, pesoKg = null, pesoInformado = false }) {
  const valorSeguro = arred2(seguro || 0);
  const taxaSeguro = valorAssegurado > 0 ? arred6(valorSeguro / valorAssegurado) : null;
  const tarifa = arred2((valorFrete || 0) - valorSeguro - (adicionais || 0));
  const qtd = quantidade > 0 ? quantidade : null;
  const peso = pesoInformado ? (pesoKg > 0 ? pesoKg : null)
    : qtd && unidade?.kg > 0 ? arred2(qtd * unidade.kg) : (pesoKg > 0 ? pesoKg : null);
  const precoTonelada = peso ? arred2(tarifa / (peso / 1000)) : null;
  const precoSaca = qtd && unidade?.saca ? arred2(tarifa / qtd) : null;
  return { taxaSeguro, valorSeguro, tarifa, pesoKg: peso, precoTonelada, precoSaca };
}

/* A planilha guarda CNPJ como número em algumas abas: os zeros à esquerda voltam aqui. */
export function normalizarCnpj(v) {
  const d = soDigitos(v);
  return d ? d.padStart(14, "0") : "";
}
export const raizCnpj = cnpj => normalizarCnpj(cnpj).slice(0, 8);
export const ehMatriz = cnpj => normalizarCnpj(cnpj).slice(8, 12) === "0001";

export const chaveValida = chave => /^\d{44}$/.test(String(chave ?? ""));
/* Número do CT-e: posições 26–34 da chave (modelo 57). */
export function numeroDaChave(chave) {
  const d = soDigitos(chave);
  return d.length === 44 ? Number(d.slice(25, 34)) : null;
}

/* CNPJ do emitente (o transportador): posições 7–20 da chave. */
export function cnpjDaChave(chave) {
  const d = soDigitos(chave);
  return d.length === 44 ? d.slice(6, 20) : "";
}

export const normalizarCidade = s => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toUpperCase().trim().replace(/\s+/g, " ");

export const rotaDe = c => `${normalizarCidade(c.origem)} → ${normalizarCidade(c.destino)}`;
export const mesDe = iso => String(iso ?? "").slice(0, 7);

/* Cód. itinerário do cadastro do Rodopar: código da cidade + código do porto (ou o contrário).
   Cidade fora das abas LINHA SANTOS / LINHA GUARUJÁ é itinerário que a Tóliman não faz: fica em branco. */
export const PORTOS = { SANTOS: "SAN", GUARUJA: "GJA" };
export function codigoItinerario(origem, destino) {
  const o = normalizarCidade(origem), d = normalizarCidade(destino);
  if (PORTOS[d] && CODIGOS_CIDADE[o]) return CODIGOS_CIDADE[o] + PORTOS[d];
  if (PORTOS[o] && CODIGOS_CIDADE[d]) return PORTOS[o] + CODIGOS_CIDADE[d];
  return "";
}
