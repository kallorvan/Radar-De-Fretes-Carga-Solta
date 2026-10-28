// A base em memória: CT-e, cadastro de CNPJ, lixeira e histórico.
// Toda alteração passa por aqui e deixa registro de quem fez e quando.

import { calcularCte, normalizarCnpj, chaveValida, normalizarCidade, raizCnpj, ehMatriz, soDigitos, numeroBR } from "./calculos.js";
import { fmtCnpj } from "./formato.js";

export const MAX_LOG = 500;

export const novaBase = () => ({ versao: 1, salvoEm: null, salvoPor: null, ctes: [], cnpjs: [], lixeira: [], log: [] });

const NUMERICOS = ["valorAssegurado", "taxaSeguro", "valorFrete", "adicionais", "sacas"];

/* Campos como chegam do formulário ou da planilha → tipos da base. */
function normalizar(c) {
  const n = {
    chave: soDigitos(c.chave),
    numero: c.numero === "" || c.numero == null ? null : Number(soDigitos(c.numero)) || null,
    emissao: String(c.emissao ?? "").slice(0, 10),
    cnpjTransportador: normalizarCnpj(c.cnpjTransportador),
    cnpjCliente: normalizarCnpj(c.cnpjCliente),
    origem: normalizarCidade(c.origem),
    destino: normalizarCidade(c.destino),
    itinerario: String(c.itinerario ?? "").trim().toUpperCase(),
    vpo: Boolean(c.vpo),
    observacoes: String(c.observacoes ?? "").trim(),
  };
  for (const k of NUMERICOS) n[k] = numeroBR(c[k]);
  for (const k of ["valorAssegurado", "taxaSeguro", "adicionais"]) if (n[k] == null) n[k] = 0;
  return n;
}

export function validarCampos(campos) {
  const c = normalizar(campos);
  const erros = {};
  if (!chaveValida(c.chave)) erros.chave = "Chave de acesso precisa ter 44 dígitos.";
  if (!c.numero) erros.numero = "Informe o número do CT-e.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.emissao)) erros.emissao = "Informe a data de emissão.";
  if (c.cnpjTransportador.length !== 14) erros.cnpjTransportador = "CNPJ do transportador precisa ter 14 dígitos.";
  if (c.cnpjCliente.length !== 14) erros.cnpjCliente = "CNPJ do cliente precisa ter 14 dígitos.";
  if (!c.origem) erros.origem = "Informe a cidade de origem.";
  if (!c.destino) erros.destino = "Informe a cidade de destino.";
  if (!(c.valorFrete > 0)) erros.valorFrete = "Informe o valor do frete.";
  if (!(c.sacas > 0)) erros.sacas = "Informe as sacas.";
  return { ok: Object.keys(erros).length === 0, erros, campos: c };
}

export function registrar(d, acao, quem, agora, chave, resumo) {
  d.log.push({ quando: agora, quem, acao, chave: chave || "", resumo: resumo || "" });
  if (d.log.length > MAX_LOG) d.log.splice(0, d.log.length - MAX_LOG);
}

const acharCte = (d, chave) => d.ctes.find(c => c.chave === chave);
const acharLixo = (d, chave) => d.lixeira.find(l => l.cte.chave === chave);
const resumoCte = c => `CT-e ${c.numero} · ${c.origem} → ${c.destino}`;

export function incluir(d, campos, quem, agora, origemLancamento = "formulario") {
  const v = validarCampos(campos);
  if (!v.ok) return { ok: false, erros: v.erros };
  const existente = acharCte(d, v.campos.chave);
  if (existente) return { ok: false, existente };
  const lixo = acharLixo(d, v.campos.chave);
  if (lixo) return { ok: false, existente: lixo.cte, naLixeira: true };
  const cte = {
    ...v.campos, ...calcularCte(v.campos),
    criadoPor: quem, criadoEm: agora, alteradoPor: null, alteradoEm: null, origemLancamento,
  };
  d.ctes.push(cte);
  registrar(d, "incluir", quem, agora, cte.chave, resumoCte(cte));
  return { ok: true, cte };
}

export function corrigir(d, chave, campos, quem, agora) {
  const atual = acharCte(d, chave);
  if (!atual) return { ok: false, erros: { chave: "CT-e não encontrado na base." } };
  const v = validarCampos({ ...campos, chave });
  if (!v.ok) return { ok: false, erros: v.erros };
  Object.assign(atual, v.campos, calcularCte(v.campos), { alteradoPor: quem, alteradoEm: agora });
  delete atual.divergencia;   // o número agora é o calculado
  registrar(d, "corrigir", quem, agora, chave, resumoCte(atual));
  return { ok: true, cte: atual };
}

export function excluir(d, chave, quem, agora) {
  const i = d.ctes.findIndex(c => c.chave === chave);
  if (i < 0) return { ok: false };
  const [cte] = d.ctes.splice(i, 1);
  d.lixeira.push({ cte, excluidoPor: quem, excluidoEm: agora });
  registrar(d, "excluir", quem, agora, chave, resumoCte(cte));
  return { ok: true, cte };
}

export function restaurar(d, chave, quem, agora) {
  const i = d.lixeira.findIndex(l => l.cte.chave === chave);
  if (i < 0 || acharCte(d, chave)) return { ok: false };
  const [{ cte }] = d.lixeira.splice(i, 1);
  d.ctes.push(cte);
  registrar(d, "restaurar", quem, agora, chave, resumoCte(cte));
  return { ok: true, cte };
}

export function cadastrarCnpj(d, cnpj, nome, quem, agora) {
  const n = normalizarCnpj(cnpj);
  const limpo = String(nome ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (n.length !== 14 || !limpo) return { ok: false };
  const atual = d.cnpjs.find(c => c.cnpj === n);
  if (atual) {
    if (atual.nome === limpo) return { ok: true, cnpj: n, nome: limpo };
    atual.nome = limpo;
  } else d.cnpjs.push({ cnpj: n, nome: limpo });
  registrar(d, "cadastro", quem, agora, "", `${fmtCnpj(n)} = ${limpo}`);
  return { ok: true, cnpj: n, nome: limpo };
}

export function nomeDoCnpj(d, cnpj) {
  const n = normalizarCnpj(cnpj);
  return d.cnpjs.find(c => c.cnpj === n)?.nome ?? null;
}

/* Filiais juntas pela raiz; o nome vem da matriz, senão do menor CNPJ cadastrado. */
export function grupoDoCnpj(d, cnpj) {
  const raiz = raizCnpj(cnpj);
  const doGrupo = d.cnpjs.filter(c => c.cnpj.startsWith(raiz)).sort((a, b) => a.cnpj.localeCompare(b.cnpj));
  const escolhido = doGrupo.find(c => ehMatriz(c.cnpj)) || doGrupo[0];
  return { raiz, nome: escolhido ? escolhido.nome : "CNPJ " + fmtCnpj(normalizarCnpj(cnpj)) };
}
