// Calculadora dos campos de valor do lançamento, no mesmo modelo do Radar de Fretes Container (v61): a conta é
// lida por um interpretador próprio (nunca eval). Aceita + − × ÷ (ou * / x), parênteses, sinal, % e números em
// pt-BR: vírgula decimal e ponto de milhar ("1.234,56"); sem vírgula, ponto seguido de grupos de 3 dígitos é
// milhar ("1.500" = 1500), senão é decimal ("1.5"). "a + b%" = a mais b% de a; "a × b%" = b% de a. "R$" é ignorado.

import { arred2 } from "./calculos.js";

function numero(t) {
  let s = t;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error("número inválido: " + t);
  return parseFloat(s);
}

/* A conta: { valor } ou { erro } com o motivo ("conta incompleta", "divisão por zero"…); vazia dá { valor: null }. */
export function lerConta(expr) {
  const s = String(expr ?? "").replace(/R\$/gi, "").replace(/[x×]/gi, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/\s+/g, "");
  if (!s) return { valor: null };
  const tk = s.match(/\d[\d.,]*|[.,]\d[\d.,]*|[-+*/()%]|./g) || [];
  let i = 0;
  const ve = () => tk[i];
  const fator = () => {
    const t = tk[i++];
    let r;
    if (t === "-") { const f = fator(); return { v: -f.v, pct: f.pct }; }
    if (t === "+") return fator();
    if (t === "(") { r = { v: soma(), pct: false }; if (tk[i++] !== ")") throw new Error("falta fechar o parêntese"); }
    else if (t != null && /^[\d.,]/.test(t)) r = { v: numero(t), pct: false };
    else throw new Error("conta incompleta");
    if (ve() === "%") { i++; r = { v: r.v / 100, pct: true }; }
    return r;
  };
  const termo = () => {
    let a = fator();
    while (ve() === "*" || ve() === "/") {
      const op = tk[i++], b = fator();
      a = { v: op === "*" ? a.v * b.v : a.v / b.v, pct: false };
    }
    return a;
  };
  const soma = () => {
    let a = termo().v;
    while (ve() === "+" || ve() === "-") {
      const op = tk[i++], b = termo();
      const v = b.pct ? a * b.v : b.v;
      a = op === "+" ? a + v : a - v;
    }
    return a;
  };
  try {
    const v = soma();
    if (i < tk.length) throw new Error(tk[i] === ")" ? "parêntese sobrando" : "conta incompleta");
    if (!Number.isFinite(v)) throw new Error("divisão por zero");
    return { valor: Math.round(v * 1e9) / 1e9 };
  } catch (e) { return { erro: e.message }; }
}

/* Resultado da conta, ou null se ela estiver vazia, incompleta, inválida ou dividir por zero. */
export const avaliarConta = texto => lerConta(texto).valor ?? null;

/* Como o resultado entra no campo: até 2 casas, com vírgula ("300,5", "520"). */
export const valorParaCampo = v => String(arred2(v)).replace(".", ",");
