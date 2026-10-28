// Regras do CT-e de carga solta: fórmulas da planilha, CNPJ, chave de acesso e chaves de agrupamento.

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

/* Mesmas fórmulas da aba BASE CARGA SOLTA 2026, arredondando cada passo. */
export function calcularCte({ valorAssegurado, taxaSeguro, valorFrete, adicionais, sacas }) {
  const valorSeguro = arred2((valorAssegurado || 0) * (taxaSeguro || 0));
  const tarifa = arred2((valorFrete || 0) - valorSeguro - (adicionais || 0));
  const precoSaca = sacas > 0 ? arred2(tarifa / sacas) : null;
  return { valorSeguro, tarifa, precoSaca };
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

export const normalizarCidade = s => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toUpperCase().trim().replace(/\s+/g, " ");

export const rotaDe = c => `${normalizarCidade(c.origem)} → ${normalizarCidade(c.destino)}`;
export const mesDe = iso => String(iso ?? "").slice(0, 7);
