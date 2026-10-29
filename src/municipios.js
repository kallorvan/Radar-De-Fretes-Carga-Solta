// Municípios do Brasil para sugerir na digitação da origem e do destino (lista em dados-municipios.js),
// mais as cidades que já estão na base. A comparação ignora acento e maiúsculas, como normalizarCidade.

import { MUNICIPIOS } from "./dados-municipios.js";
import { normalizarCidade } from "./calculos.js";

const LISTA = new Set(MUNICIPIOS);

/* Primeiro os que começam com o texto; depois os que têm uma palavra começando com ele ("joaquim" → SAO JOAQUIM…). */
export function sugerirCidades(texto, { extras = [], limite = 8 } = {}) {
  const q = normalizarCidade(texto);
  if (q.length < 2) return [];
  const todas = [...new Set([...extras.map(normalizarCidade).filter(Boolean), ...MUNICIPIOS])];
  const inicio = [], meio = [];
  for (const c of todas) {
    if (c.startsWith(q)) inicio.push(c);
    else if (c.includes(" " + q)) meio.push(c);
  }
  return [...inicio.sort(), ...meio.sort()].slice(0, limite);
}

/* Município da lista ou cidade já usada na base; vazio não conta como desconhecido. */
export function cidadeConhecida(nome, extras = []) {
  const n = normalizarCidade(nome);
  return !n || LISTA.has(n) || extras.some(x => normalizarCidade(x) === n);
}
