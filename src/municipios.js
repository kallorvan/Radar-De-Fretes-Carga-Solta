// Municípios do Brasil para sugerir na digitação da origem e do destino (lista em dados-municipios.js),
// mais as cidades que já estão na base. A comparação ignora acento e maiúsculas, como normalizarCidade.

import { MUNICIPIOS } from "./dados-municipios.js";
import { normalizarCidade } from "./calculos.js";

const LISTA = new Set(MUNICIPIOS);

/* Cidades de um campo ("origem" | "destino") por quantidade de CT-e; empate em ordem alfabética. */
export function cidadesMaisUsadas(ctes, campo, limite = 8) {
  return [...contarUsos(ctes, campo)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limite).map(([c]) => c);
}
export function contarUsos(ctes, campo) {
  const m = new Map();
  for (const c of ctes) { const n = normalizarCidade(c[campo]); if (n) m.set(n, (m.get(n) || 0) + 1); }
  return m;
}

/* Primeiro as cidades já lançadas (usos: cidade → quantidade), das mais usadas para as menos; depois os municípios
   que começam com o texto e, por fim, os que têm uma palavra começando com ele ("joaquim" → SAO JOAQUIM…). */
export function sugerirCidades(texto, { extras = [], usos = new Map(), limite = 8 } = {}) {
  const q = normalizarCidade(texto);
  if (q.length < 2) return [];
  const casa = c => c.startsWith(q) || c.includes(" " + q);
  const daBase = [...usos].filter(([c]) => casa(c)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  const ja = new Set(daBase), inicio = [], meio = [];
  for (const c of new Set([...extras.map(normalizarCidade).filter(Boolean), ...MUNICIPIOS])) {
    if (ja.has(c)) continue;
    if (c.startsWith(q)) inicio.push(c);
    else if (c.includes(" " + q)) meio.push(c);
  }
  return [...daBase, ...inicio.sort(), ...meio.sort()].slice(0, limite);
}

/* Município da lista ou cidade já usada na base; vazio não conta como desconhecido. */
export function cidadeConhecida(nome, extras = []) {
  const n = normalizarCidade(nome);
  return !n || LISTA.has(n) || extras.some(x => normalizarCidade(x) === n);
}
