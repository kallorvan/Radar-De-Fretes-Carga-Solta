// Calculadora dos campos Adicionais e Quantidade: a conta digitada é lida por um interpretador próprio
// (nunca eval). Aceita + - * / × ÷, parênteses, sinal e números em pt-BR ("1.234,56", "80,50"); "R$" é ignorado.

import { numeroBR, arred2 } from "./calculos.js";

/* Peças da conta: números ("1.080", "80,50") e símbolos; qualquer outra coisa invalida a conta. */
function pecas(texto) {
  const s = String(texto ?? "").replace(/R\$/gi, " ").replace(/×|x/gi, "*").replace(/÷|:/g, "/");
  const out = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if ("+-*/()".includes(c)) {
      if (c === "*" && s[i + 1] === "*") return null;   // potência não é aceita
      out.push(c); i++; continue;
    }
    const m = s.slice(i).match(/^\d[\d.,]*/);
    if (!m) return null;
    const n = numeroBR(m[0]);
    if (n == null || (m[0].match(/,/g) || []).length > 1) return null;
    out.push(n); i += m[0].length;
  }
  return out;
}

/* Resultado da conta, ou null se ela estiver incompleta, inválida ou dividir por zero. */
export function avaliarConta(texto) {
  const p = pecas(texto);
  if (!p || !p.length) return null;
  let i = 0;
  const erro = () => { throw new Error("conta"); };
  const fator = () => {
    const t = p[i++];
    if (t === "-") return -fator();
    if (t === "+") return fator();
    if (t === "(") { const v = soma(); if (p[i++] !== ")") erro(); return v; }
    return typeof t === "number" ? t : erro();
  };
  const produto = () => {
    let v = fator();
    while (p[i] === "*" || p[i] === "/") {
      const op = p[i++], b = fator();
      if (op === "/" && b === 0) erro();
      v = op === "*" ? v * b : v / b;
    }
    return v;
  };
  const soma = () => {
    let v = produto();
    while (p[i] === "+" || p[i] === "-") { const op = p[i++]; const b = produto(); v = op === "+" ? v + b : v - b; }
    return v;
  };
  try {
    const v = soma();
    return i === p.length && Number.isFinite(v) ? Math.round(v * 1e9) / 1e9 : null;
  } catch (e) { return null; }
}

/* Como o resultado entra no campo: até 2 casas, com vírgula ("300,5", "520"). */
export const valorParaCampo = v => String(arred2(v)).replace(".", ",");
