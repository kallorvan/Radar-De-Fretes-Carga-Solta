// Formatação pt-BR para a tela. Valor ausente vira "—".

const NADA = "—";
const fmtCache = new Map();
const nf = (min, max) => {
  const k = min + ":" + max;
  if (!fmtCache.has(k)) fmtCache.set(k, new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max }));
  return fmtCache.get(k);
};
const vazio = n => n == null || !Number.isFinite(n);

export const fmtNum = (n, casas = 0) => vazio(n) ? NADA : nf(casas, casas).format(n);
export const fmtMoeda = n => vazio(n) ? NADA : (n < 0 ? "-" : "") + "R$ " + nf(2, 2).format(Math.abs(n));
export const fmtPct = (n, casas = 1) => vazio(n) ? NADA : nf(casas, casas).format(n * 100) + "%";

export function fmtCnpj(cnpj) {
  const d = String(cnpj ?? "").replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;
}
export function fmtData(iso) {
  const [a, m, d] = String(iso ?? "").slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : NADA;
}
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function fmtMes(aaaaMm) {
  const [a, m] = String(aaaaMm ?? "").split("-");
  return m ? `${MESES[+m - 1].slice(0, 3)}/${a.slice(2)}` : NADA;
}
export function fmtMesLongo(aaaaMm) {
  const [a, m] = String(aaaaMm ?? "").split("-");
  if (!m) return NADA;
  const nome = MESES[+m - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`;
}
const dois = n => String(n).padStart(2, "0");
export function fmtQuando(iso) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return "";
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export const esc = s => String(s ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
