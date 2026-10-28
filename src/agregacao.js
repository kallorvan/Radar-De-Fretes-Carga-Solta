// Leituras da base: recortes, medianas mensais, rotas, transportadores e exceções.
// Mês sem CT-e não vira zero: fica ausente, e as variações comparam com o último mês com dados.

import { rotaDe, mesDe, raizCnpj, normalizarCnpj } from "./calculos.js";
import { grupoDoCnpj, nomeDoCnpj, produtoDe } from "./base.js";

export const FAIXA_EXCECAO = 3;        // fora de [mediana/3, mediana×3]
export const MIN_ROTA_EXCECAO = 3;     // CT-e com R$/t no grupo rota + produto para avaliar a faixa

/* "tonelada" (padrão), "saca" (só CT-e em unidade de saca) ou "tarifa". */
export const valorMetrica = (c, metrica) => {
  const v = metrica === "tarifa" ? c.tarifa : metrica === "saca" ? c.precoSaca : c.precoTonelada;
  return v == null || !Number.isFinite(v) ? null : v;
};

export const produtosDaRota = (d, rota) =>
  [...new Set(d.ctes.filter(c => rotaDe(c) === rota && c.produto).map(c => c.produto))].sort();

export function mediana(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mesesEntre(ini, fim) {
  const out = [];
  let [a, m] = ini.split("-").map(Number);
  const [af, mf] = fim.split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; a++; }
  }
  return out;
}

export function filtrar(d, f = {}) {
  return d.ctes.filter(c =>
    (!f.rota || rotaDe(c) === f.rota) &&
    (!f.transportador || raizCnpj(c.cnpjTransportador) === f.transportador) &&
    (!f.cliente || raizCnpj(c.cnpjCliente) === f.cliente) &&
    (!f.itinerario || c.itinerario === f.itinerario) &&
    (!f.produto || c.produto === f.produto) &&
    (!f.mesIni || mesDe(c.emissao) >= f.mesIni) &&
    (!f.mesFim || mesDe(c.emissao) <= f.mesFim));
}

/* { [mes]: [valores] } só com os CT-e que têm a métrica */
function porMes(ctes, metrica) {
  const m = {};
  for (const c of ctes) {
    const v = valorMetrica(c, metrica);
    if (v != null) (m[mesDe(c.emissao)] ||= []).push(v);
  }
  return m;
}
const medianasPorMes = (ctes, metrica) =>
  Object.fromEntries(Object.entries(porMes(ctes, metrica)).map(([k, v]) => [k, mediana(v)]));

/* último mês com dados, o anterior com dados e a variação entre eles */
function ultimoEAnterior(medianas) {
  const meses = Object.keys(medianas).sort();
  const ultimoMes = meses.at(-1) ?? null, mesAnterior = meses.at(-2) ?? null;
  const valor = ultimoMes ? medianas[ultimoMes] : null;
  const ant = mesAnterior ? medianas[mesAnterior] : null;
  return { ultimoMes, valor, mesAnterior, variacao: ant ? valor / ant - 1 : null };
}

export function serieMensal(d, ctes, metrica) {
  const grupos = new Map();
  for (const c of ctes) {
    const v = valorMetrica(c, metrica);
    if (v == null) continue;
    const g = grupoDoCnpj(d, c.cnpjTransportador);
    if (!grupos.has(g.raiz)) grupos.set(g.raiz, { raiz: g.raiz, nome: g.nome, n: 0, vals: {} });
    const s = grupos.get(g.raiz);
    s.n++;
    (s.vals[mesDe(c.emissao)] ||= []).push(v);
  }
  const todos = [...grupos.values()].flatMap(s => Object.keys(s.vals)).sort();
  const meses = todos.length ? mesesEntre(todos[0], todos.at(-1)) : [];
  const series = [...grupos.values()]
    .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt-BR"))
    .map(({ raiz, nome, n, vals }) => ({
      raiz, nome, n,
      pontos: Object.fromEntries(Object.entries(vals).map(([m, v]) =>
        [m, { mediana: mediana(v), min: Math.min(...v), max: Math.max(...v), n: v.length }])),
    }));
  return { meses, series };
}

export function resumoGeral(ctes, metrica) {
  return {
    ...ultimoEAnterior(medianasPorMes(ctes, metrica)),
    nCtes: ctes.length,
    pesoT: Math.round(ctes.reduce((s, c) => s + (c.pesoKg || 0), 0) / 10) / 100,
    nTransportadores: new Set(ctes.map(c => raizCnpj(c.cnpjTransportador))).size,
    nRotas: new Set(ctes.map(rotaDe)).size,
  };
}

export function resumoRotas(d, metrica) {
  const rotas = new Map();
  for (const c of d.ctes) {
    const r = rotaDe(c);
    if (!rotas.has(r)) rotas.set(r, []);
    rotas.get(r).push(c);
  }
  return [...rotas].map(([rota, ctes]) => {
    const med = medianasPorMes(ctes, metrica);
    const { ultimoMes, valor, variacao } = ultimoEAnterior(med);
    return {
      rota, nCtes: ctes.length,
      nTransportadores: new Set(ctes.map(c => raizCnpj(c.cnpjTransportador))).size,
      ultimoMes, valor, variacao, porMes: med,
    };
  }).sort((a, b) => b.nCtes - a.nCtes || a.rota.localeCompare(b.rota, "pt-BR"));
}

export function transportadoresNaRota(d, ctes, metrica) {
  const grupos = new Map();
  for (const c of ctes) {
    const g = grupoDoCnpj(d, c.cnpjTransportador);
    if (!grupos.has(g.raiz)) grupos.set(g.raiz, { ...g, ctes: [] });
    grupos.get(g.raiz).ctes.push(c);
  }
  return [...grupos.values()].map(({ raiz, nome, ctes: cs }) => {
    const comValor = cs.filter(c => valorMetrica(c, metrica) != null)
      .sort((a, b) => a.emissao.localeCompare(b.emissao));
    const ult = comValor.at(-1);
    const med = medianasPorMes(cs, metrica);
    const meses = Object.keys(med).sort();
    return {
      raiz, nome, nCtes: cs.length,
      ultimo: ult ? { valor: valorMetrica(ult, metrica), emissao: ult.emissao } : null,
      mediana: mediana(comValor.map(c => valorMetrica(c, metrica))),
      variacao: meses.length > 1 ? med[meses.at(-1)] / med[meses[0]] - 1 : null,
    };
  }).sort((a, b) => b.nCtes - a.nCtes || a.nome.localeCompare(b.nome, "pt-BR"));
}

/* Registros que pedem atenção. Todos continuam valendo nos totais. */
export function excecoes(d) {
  const out = [];
  const grupos = new Map();   // rota + produto: café e açúcar na mesma rota têm preços diferentes
  for (const c of d.ctes) {
    if (!c.produto || !c.unidade || !(c.pesoKg > 0) || c.precoTonelada == null) {
      out.push({ tipo: "a-classificar", cte: c, detalhe: "Sem produto, unidade ou peso: fica fora do R$/t e conta na tarifa." });
      continue;
    }
    const k = rotaDe(c) + " · " + c.produto;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(c);
  }
  for (const [, cs] of grupos) {
    if (cs.length < MIN_ROTA_EXCECAO) continue;
    const m = mediana(cs.map(c => c.precoTonelada));
    const nome = produtoDe(d, cs[0].produto)?.nome || cs[0].produto;
    for (const c of cs) if (c.precoTonelada > m * FAIXA_EXCECAO || c.precoTonelada < m / FAIXA_EXCECAO)
      out.push({ tipo: "preco-fora", cte: c, detalhe: `R$/t fora da faixa de ${nome} na rota (mediana ${m.toFixed(2).replace(".", ",")}).` });
  }
  const semNome = new Set();
  for (const c of d.ctes) for (const cnpj of [c.cnpjTransportador, c.cnpjCliente])
    if (!nomeDoCnpj(d, cnpj)) semNome.add(normalizarCnpj(cnpj));
  for (const cnpj of semNome) out.push({ tipo: "sem-cadastro", cnpj, detalhe: "CNPJ sem nome no cadastro." });
  for (const c of d.ctes) if (c.divergencia)
    out.push({ tipo: "diverge-planilha", cte: c, detalhe: "Na importação, o cálculo não bateu com a planilha; vale o número da planilha." });
  return out;
}
