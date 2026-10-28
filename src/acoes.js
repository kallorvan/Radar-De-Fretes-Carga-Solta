// As alterações feitas pela tela: aplicam a regra da base e anotam na sessão o que esta página mudou,
// que é o que vai por cima do arquivo quando for preciso juntar.

import * as B from "./base.js";
import { aplicarImportacao } from "./importacao.js";

function comLog(d, s, fn) {
  const antes = d.log.slice();
  const r = fn();
  // o log pode ter sido cortado no início (máximo de 500): conta o que é novo pelo fim
  let novos = 0;
  while (novos < d.log.length && !antes.includes(d.log[d.log.length - 1 - novos])) novos++;
  if (novos) s.log.push(...d.log.slice(-novos));
  return r;
}

const tocar = (s, chave) => { if (s.toques) s.toques.set(chave, (s.toques.get(chave) || 0) + 1); };

export function incluir(d, s, campos, quem, agora) {
  const r = comLog(d, s, () => B.incluir(d, campos, quem, agora));
  if (r.ok) { s.alterados.add(r.cte.chave); tocar(s, r.cte.chave); }
  return r;
}
export function corrigir(d, s, chave, campos, quem, agora) {
  const r = comLog(d, s, () => B.corrigir(d, chave, campos, quem, agora));
  if (r.ok) { s.alterados.add(chave); tocar(s, chave); }
  return r;
}
export function excluir(d, s, chave, quem, agora) {
  const r = comLog(d, s, () => B.excluir(d, chave, quem, agora));
  if (r.ok) { s.alterados.delete(chave); s.restaurados.delete(chave); s.excluidos.add(chave); tocar(s, chave); }
  return r;
}
export function restaurar(d, s, chave, quem, agora) {
  const r = comLog(d, s, () => B.restaurar(d, chave, quem, agora));
  if (r.ok) { s.excluidos.delete(chave); s.restaurados.add(chave); tocar(s, chave); }
  return r;
}
/* Só os campos mexidos: na junção, o nome de um lado e o produto padrão do outro convivem. */
const anotarCnpj = (s, cnpj, campos) => s.cadastro.set(cnpj, { ...(s.cadastro.get(cnpj) || {}), ...campos });

export function cadastrar(d, s, cnpj, nome, quem, agora) {
  const r = comLog(d, s, () => B.cadastrarCnpj(d, cnpj, nome, quem, agora));
  if (r.ok) anotarCnpj(s, r.cnpj, { nome: r.nome });
  return r;
}
export function definirProdutoPadrao(d, s, cnpj, produto, quem, agora) {
  const r = comLog(d, s, () => B.definirProdutoPadrao(d, cnpj, produto, quem, agora));
  if (r.ok) anotarCnpj(s, r.cnpj, { produtoPadrao: r.produtoPadrao });
  return r;
}
export function classificar(d, s, chave, classe, quem, agora) {
  const r = comLog(d, s, () => B.classificar(d, chave, classe, quem, agora));
  if (r.ok) { s.alterados.add(chave); tocar(s, chave); }
  return r;
}
export function cadastrarProduto(d, s, produto, quem, agora, opcoes) {
  const r = comLog(d, s, () => B.cadastrarProduto(d, produto, quem, agora, opcoes));
  if (r.ok) s.listas.set("produto:" + r.id, structuredClone(r.produto));
  return r;
}
export function cadastrarUnidade(d, s, unidade, quem, agora, opcoes) {
  const r = comLog(d, s, () => B.cadastrarUnidade(d, unidade, quem, agora, opcoes));
  if (r.ok) s.listas.set("unidade:" + r.id, structuredClone(r.unidade));
  return r;
}
export function importar(d, s, resultado, quem, agora) {
  const chaves = new Set(d.ctes.map(c => c.chave));
  const cnpjs = new Map(d.cnpjs.map(c => [c.cnpj, { ...c }]));
  const r = comLog(d, s, () => aplicarImportacao(d, resultado, quem, agora));
  for (const c of d.ctes) if (!chaves.has(c.chave)) { s.alterados.add(c.chave); tocar(s, c.chave); }
  for (const c of d.cnpjs) {
    const antes = cnpjs.get(c.cnpj) || {}, mudou = {};
    for (const k of ["nome", "produtoPadrao"]) if (k in c && c[k] !== antes[k]) mudou[k] = c[k];
    if (Object.keys(mudou).length) anotarCnpj(s, c.cnpj, mudou);
  }
  return r;
}
