// O arquivo de dados que mora na pasta compartilhada, ao lado do HTML, e a junção
// quando outra pessoa gravou depois que esta página abriu.

import { MAX_LOG, migrarBase } from "./base.js";
import { fmtQuando } from "./formato.js";

export const ARQ_DADOS = "radar-carga-solta-dados.js";
export const PASTA_BKP = "backups";
export const MAX_BKP = 60;
/* A marca muda a cada versão da base: um painel antigo ainda aberto (que procura a marca dele) recusa gravar
   — "ilegível, nada foi gravado" — em vez de apagar campos que ele não conhece. */
export const MARCA = "window.RADAR_CS3=";
const MARCAS_ANTIGAS = ["window.RADAR_CS2=", "window.RADAR_CS="];
const PREFIXO_BKP = "radar-carga-solta-dados ";

export function lerDadosJs(texto) {
  const t = String(texto ?? "");
  const marca = [MARCA, ...MARCAS_ANTIGAS].find(m => t.includes(m)) || MARCA, i = t.indexOf(marca);
  if (i < 0) return null;
  const corpo = t.slice(i + marca.length).trim().replace(/;\s*$/, "");
  try {
    const d = JSON.parse(corpo);
    if (!d || !Array.isArray(d.ctes)) return null;
    return migrarBase({ versao: 1, salvoEm: null, salvoPor: null, cnpjs: [], lixeira: [], log: [], ...d });
  } catch (e) { return null; }
}

/* "</" escapado: um texto digitado nunca fecha a tag <script> que carrega o arquivo. */
export function montarDadosJs(d) {
  const json = JSON.stringify(d).split("</").join("<\\/");
  return "/* Radar de Fretes · Carga Solta — arquivo de dados. Não edite à mão: lance e corrija pelo painel.\n" +
    "   Fica na mesma pasta do HTML do painel. Gravado em " + d.salvoEm + " */\n" + MARCA + json + ";\n";
}

const dois = n => String(n).padStart(2, "0");
export function nomeBackup(iso) {
  const d = iso && !isNaN(new Date(iso)) ? new Date(iso) : new Date();
  return `${PREFIXO_BKP}${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ` +
    `${dois(d.getHours())}h${dois(d.getMinutes())}m${dois(d.getSeconds())}s.js`;
}
export const ehBackup = nome => /^radar-carga-solta-dados \d{4}-\d{2}-\d{2} \d{2}h\d{2}m\d{2}s\.js$/.test(nome);
/* O nome ordena pela data: sai o que passar dos max mais novos. */
export const podar = (nomes, max = MAX_BKP) => nomes.filter(ehBackup).sort().slice(0, Math.max(0, nomes.filter(ehBackup).length - max));

/* O que esta página mudou desde a última gravação. */
/* toques: quantas vezes cada CT-e foi mexido nesta página; uma gravação só tira da sessão o que não mudou depois dela.
   cadastro: cnpj → registro do cadastro como está na tela; listas: "produto:ID" | "unidade:ID" → item da lista;
   config: campo da base → valor (a data de corte); apagados: chaves tiradas de vez da lixeira. */
export const novaSessao = () => ({ alterados: new Set(), excluidos: new Set(), restaurados: new Set(), apagados: new Set(), cadastro: new Map(), listas: new Map(), config: new Map(), log: [], toques: new Map() });
export const sessaoVazia = s => !s.alterados.size && !s.excluidos.size && !s.restaurados.size && !s.apagados?.size && !s.cadastro.size && !s.listas?.size && !s.config?.size && !s.log.length;

/* Parte do arquivo e aplica por cima só o que esta página mudou; cada CT-e tocado
   vai para onde está na tela (base ou lixeira). */
export function juntar(arquivo, tela, sessao) {
  const r = migrarBase(arquivo);
  const tocados = new Set([...sessao.alterados, ...sessao.excluidos, ...sessao.restaurados]);
  r.ctes = r.ctes.filter(c => !tocados.has(c.chave));
  r.lixeira = (r.lixeira || []).filter(l => !tocados.has(l.cte.chave));
  for (const chave of tocados) {
    const c = tela.ctes.find(x => x.chave === chave);
    if (c) { r.ctes.push(structuredClone(c)); continue; }
    const l = tela.lixeira.find(x => x.cte.chave === chave);
    if (l) r.lixeira.push(structuredClone(l));
  }
  // apagados de vez aqui: saem só da lixeira (um CT-e que outra pessoa restaurou continua na base)
  if (sessao.apagados?.size) r.lixeira = r.lixeira.filter(l => !sessao.apagados.has(l.cte.chave) || tocados.has(l.cte.chave));
  const cad = new Map((r.cnpjs || []).map(c => [c.cnpj, c]));
  for (const [cnpj, reg] of sessao.cadastro)
    cad.set(cnpj, { ...cad.get(cnpj), cnpj, ...(typeof reg === "string" ? { nome: reg } : structuredClone(reg)) });
  r.cnpjs = [...cad.values()];
  for (const [k, item] of sessao.listas || []) {
    const lista = k.startsWith("produto:") ? r.produtos : r.unidades;
    const i = lista.findIndex(x => x.id === item.id);
    if (i >= 0) lista[i] = structuredClone(item); else lista.push(structuredClone(item));
  }
  for (const [k, v] of sessao.config || []) r[k] = v;
  r.log = [...(r.log || []), ...sessao.log].slice(-MAX_LOG);
  return r;
}

export function resumoConflito(arquivo, tela, sessao) {
  const naTela = new Set([...tela.ctes.map(c => c.chave), ...tela.lixeira.map(l => l.cte.chave)]);
  const entram = arquivo.ctes.filter(c => !naTela.has(c.chave)).length;
  const porChave = new Map(tela.ctes.map(c => [c.chave, JSON.stringify(c)]));
  const mudaram = arquivo.ctes.filter(c => porChave.has(c.chave) && !sessao.alterados.has(c.chave) &&
    porChave.get(c.chave) !== JSON.stringify(c)).length;
  const noArquivo = new Set(arquivo.ctes.map(c => c.chave));
  const saem = tela.ctes.filter(c => !noArquivo.has(c.chave) && !sessao.alterados.has(c.chave) && !sessao.restaurados.has(c.chave)).length;
  const minhas = sessao.alterados.size + sessao.excluidos.size + sessao.restaurados.size + (sessao.apagados?.size || 0) + sessao.cadastro.size + (sessao.listas?.size || 0) + (sessao.config?.size || 0);
  const quem = (arquivo.salvoPor ? arquivo.salvoPor + " gravou" : "Alguém gravou") +
    (arquivo.salvoEm ? ` em ${fmtQuando(arquivo.salvoEm)}` : "");
  const partes = [];
  if (entram) partes.push(`${entram} CT-e que você não tem na tela`);
  if (mudaram) partes.push(`${mudaram} CT-e alterado${mudaram === 1 ? "" : "s"}`);
  if (saem) partes.push(`${saem} CT-e a menos`);
  return `${quem} depois que esta página abriu` + (partes.length ? `; o arquivo tem ${partes.join(", ")}.` : ".") +
    ` Juntar e salvar parte do arquivo e aplica por cima só o que você mudou aqui (${minhas} alteraç${minhas === 1 ? "ão" : "ões"}).` +
    ` O arquivo anterior fica guardado em ${PASTA_BKP}/.`;
}
