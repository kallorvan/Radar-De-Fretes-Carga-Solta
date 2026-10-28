// A base em memória: CT-e, cadastro de CNPJ, lixeira e histórico.
// Toda alteração passa por aqui e deixa registro de quem fez e quando.

import { calcularCte, arred2, arred6, cnpjDaChave, codigoItinerario, normalizarCnpj, chaveValida, normalizarCidade, raizCnpj, ehMatriz, soDigitos, numeroBR } from "./calculos.js";
import { fmtCnpj } from "./formato.js";
import { sugerirProdutoCliente } from "./produtos-clientes.js";

export const MAX_LOG = 500;

export const UNIDADES_INICIAIS = [
  { id: "SC60", nome: "Saca 60 kg", kg: 60, saca: true },
  { id: "SC50", nome: "Saca 50 kg", kg: 50, saca: true },
  { id: "TON", nome: "Tonelada", kg: 1000, saca: false },
  { id: "BAG", nome: "Big bag", kg: null, saca: false },
];
export const PRODUTOS_INICIAIS = [{ id: "CAFE", nome: "Café" }, { id: "ACUCAR", nome: "Açúcar" }];

export const CORTE_PADRAO = "2026-08-01";

export const novaBase = () => ({
  versao: 3, corte: CORTE_PADRAO, salvoEm: null, salvoPor: null, ctes: [], cnpjs: [], lixeira: [], log: [],
  produtos: structuredClone(PRODUTOS_INICIAIS), unidades: structuredClone(UNIDADES_INICIAIS),
});

/* Base gravada pelo painel antigo (v1, só "sacas") → v2. Pura: devolve uma cópia; v2 sem pendências volta igual. */
export function migrarBase(d) {
  const r = structuredClone(d);
  r.produtos ||= structuredClone(PRODUTOS_INICIAIS);
  r.unidades ||= structuredClone(UNIDADES_INICIAIS);
  r.cnpjs ||= []; r.lixeira ||= []; r.log ||= []; r.ctes ||= [];
  if ((d.versao || 1) < 2) {
    const migra = c => {
      const { sacas, ...resto } = c;
      return { ...resto, quantidade: sacas ?? resto.quantidade ?? null, produto: null, unidade: null, pesoKg: null,
        pesoInformado: false, precoTonelada: null, precoSaca: null };
    };
    r.ctes = r.ctes.map(migra);
    r.lixeira = r.lixeira.map(l => ({ ...l, cte: migra(l.cte) }));
    // sem produto padrão a classificação começaria vazia: a sugestão pelo nome é a mesma da importação
    for (const c of r.cnpjs) if (c.produtoPadrao === undefined) { const p = sugerirProdutoCliente(c.nome); if (p) c.produtoPadrao = p; }
    r.versao = 2;
  }
  /* CT-e com "sacas" numa base v2: lançado ou corrigido por um painel antigo ainda aberto. A quantidade
     mais nova é a de "sacas"; peso e preços são refeitos a partir da tarifa que ele gravou. */
  const normaliza = c => {
    if (!("sacas" in c)) return c;
    const { sacas, ...resto } = c, u = unidadeDe(r, resto.unidade);
    const n = { produto: null, unidade: null, pesoKg: null, pesoInformado: false, precoTonelada: null, ...resto, quantidade: sacas ?? resto.quantidade ?? null };
    if (!n.pesoInformado) n.pesoKg = u?.kg > 0 && n.quantidade > 0 ? Math.round(n.quantidade * u.kg * 100) / 100 : null;
    return precosDaTarifa(r, n);
  };
  r.ctes = r.ctes.map(normaliza);
  r.lixeira = r.lixeira.map(l => ({ ...l, cte: normaliza(l.cte) }));
  if ((r.versao || 1) < 3) {
    if (r.corte === undefined) r.corte = CORTE_PADRAO;
    // o seguro passa a ser o informado no CT-e; a taxa vira conferência
    // a taxa digitada fica quando ela reproduz o seguro guardado (sem perder casas); senão sai do seguro
    const taxaV3 = c => !(c.valorAssegurado > 0) ? null
      : c.taxaSeguro > 0 && arred2(c.valorAssegurado * c.taxaSeguro) === arred2(c.valorSeguro || 0) ? c.taxaSeguro
      : arred6((c.valorSeguro || 0) / c.valorAssegurado);
    const v3 = c => ({ ...c, taxaSeguro: taxaV3(c) });
    r.ctes = r.ctes.map(v3);
    r.lixeira = r.lixeira.map(l => ({ ...l, cte: v3(l.cte) }));
    r.versao = 3;
  }
  // itinerário em branco que a tabela do Rodopar (atualizada a cada versão do painel) já sabe montar
  const comItinerario = c => c.itinerario ? c : { ...c, itinerario: codigoItinerario(c.origem, c.destino) };
  r.ctes = r.ctes.map(comItinerario);
  r.lixeira = r.lixeira.map(l => ({ ...l, cte: comItinerario(l.cte) }));
  return r;
}

/* CT-e antes da data de corte ficam na base, mas fora da análise (sem CT-e em mãos para classificar). */
export const noCorte = (d, cte) => !d.corte || String(cte.emissao) >= d.corte;
export const ctesNoCorte = d => d.ctes.filter(c => noCorte(d, c));

export function definirCorte(d, valor, quem, agora) {
  const v = valor ? String(valor) : null;
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false };
  if (v === (d.corte ?? null)) return { ok: true, corte: v, mudou: false };
  d.corte = v;
  registrar(d, "corte", quem, agora, "", v ? `data de corte ${v.split("-").reverse().join("/")}` : "sem data de corte");
  return { ok: true, corte: v, mudou: true };
}

export const unidadeDe = (d, id) => (d.unidades || []).find(u => u.id === id) || null;
export const produtoDe = (d, id) => (d.produtos || []).find(p => p.id === id) || null;

const NUMERICOS = ["valorAssegurado", "valorSeguro", "valorFrete", "adicionais", "quantidade", "pesoKg"];

/* Campos como chegam do formulário ou da planilha → tipos da base. */
function normalizar(c) {
  const chave = soDigitos(c.chave);
  const n = {
    chave,
    numero: c.numero === "" || c.numero == null ? null : Number(soDigitos(c.numero)) || null,
    emissao: String(c.emissao ?? "").slice(0, 10),
    cnpjTransportador: normalizarCnpj(c.cnpjTransportador) || cnpjDaChave(chave),   // o transportador é o emitente da chave
    cnpjCliente: normalizarCnpj(c.cnpjCliente),
    origem: normalizarCidade(c.origem),
    destino: normalizarCidade(c.destino),
    itinerario: codigoItinerario(c.origem, c.destino),
    produto: c.produto ? String(c.produto) : null,
    unidade: c.unidade ? String(c.unidade) : null,
    pesoInformado: Boolean(c.pesoInformado),
    vpo: Boolean(c.vpo),
    observacoes: String(c.observacoes ?? "").trim(),
  };
  for (const k of NUMERICOS) n[k] = numeroBR(c[k]);
  for (const k of ["valorAssegurado", "valorSeguro", "adicionais"]) if (n[k] == null) n[k] = 0;
  return n;
}

const ERRO_PESO = "Informe o peso total do CT-e (kg).";
/* Produto, unidade e peso: o que torna o preço comparável. */
function errosClassificacao(d, c) {
  const erros = {}, u = unidadeDe(d, c.unidade);
  if (!produtoDe(d, c.produto)) erros.produto = "Escolha o produto.";
  if (!u) erros.unidade = "Escolha a unidade.";
  else if ((c.pesoInformado || !(u.kg > 0)) && !(c.pesoKg > 0)) erros.pesoKg = ERRO_PESO;
  else if (!c.pesoInformado && u.kg > 0 && !(c.quantidade > 0)) erros.quantidade = "Informe a quantidade.";
  return erros;
}
const calcular = (d, c) => calcularCte({ ...c, unidade: unidadeDe(d, c.unidade), pesoInformado: c.pesoInformado || !(unidadeDe(d, c.unidade)?.kg > 0) });

export function validarCampos(d, campos, { exigirClassificacao = true } = {}) {
  const c = normalizar(campos);
  const erros = {};
  if (!chaveValida(c.chave)) erros.chave = "Chave de acesso precisa ter 44 dígitos.";
  if (!c.numero) erros.numero = "Informe o número do CT-e.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.emissao)) erros.emissao = "Informe a data de emissão.";
  // CNPJ vazio que sairia de uma chave inválida: o erro é só o da chave
  const daChave = !normalizarCnpj(campos.cnpjTransportador);
  if (c.cnpjTransportador.length !== 14) { if (!daChave || chaveValida(c.chave)) erros.cnpjTransportador = "CNPJ do transportador precisa ter 14 dígitos."; }
  else if (chaveValida(c.chave) && c.cnpjTransportador !== cnpjDaChave(c.chave)) erros.cnpjTransportador = "O CNPJ do transportador não bate com a chave de acesso.";
  if (c.cnpjCliente.length !== 14) erros.cnpjCliente = "CNPJ do cliente precisa ter 14 dígitos.";
  if (!c.origem) erros.origem = "Informe a cidade de origem.";
  if (!c.destino) erros.destino = "Informe a cidade de destino.";
  if (!(c.valorFrete > 0)) erros.valorFrete = "Informe o valor do frete.";
  if (!(c.quantidade > 0)) erros.quantidade = "Informe a quantidade.";
  if (exigirClassificacao) Object.assign(erros, errosClassificacao(d, c));
  return { ok: Object.keys(erros).length === 0, erros, campos: c };
}

export function registrar(d, acao, quem, agora, chave, resumo) {
  d.log.push({ quando: agora, quem, acao, chave: chave || "", resumo: resumo || "" });
  if (d.log.length > MAX_LOG) d.log.splice(0, d.log.length - MAX_LOG);
}

const acharCte = (d, chave) => d.ctes.find(c => c.chave === chave);
const acharLixo = (d, chave) => d.lixeira.find(l => l.cte.chave === chave);
const resumoCte = c => `CT-e ${c.numero} · ${c.origem} → ${c.destino}`;

export function incluir(d, campos, quem, agora, origemLancamento = "formulario", { exigirClassificacao = true } = {}) {
  const v = validarCampos(d, campos, { exigirClassificacao });
  if (!v.ok) return { ok: false, erros: v.erros };
  const existente = acharCte(d, v.campos.chave);
  if (existente) return { ok: false, existente };
  const lixo = acharLixo(d, v.campos.chave);
  if (lixo) return { ok: false, existente: lixo.cte, naLixeira: true };
  const cte = {
    ...v.campos, ...calcular(d, v.campos),
    criadoPor: quem, criadoEm: agora, alteradoPor: null, alteradoEm: null, origemLancamento,
  };
  d.ctes.push(cte);
  registrar(d, "incluir", quem, agora, cte.chave, resumoCte(cte));
  return { ok: true, cte };
}

export function corrigir(d, chave, campos, quem, agora) {
  const atual = acharCte(d, chave);
  if (!atual) return { ok: false, erros: { chave: "CT-e não encontrado na base." } };
  const v = validarCampos(d, { ...campos, chave });
  if (!v.ok) return { ok: false, erros: v.erros };
  // mesma rota e a regra sem código (homônima, base antiga): o itinerário guardado continua valendo
  if (!v.campos.itinerario && v.campos.origem === atual.origem && v.campos.destino === atual.destino) v.campos.itinerario = atual.itinerario || "";
  Object.assign(atual, v.campos, calcular(d, v.campos), { alteradoPor: quem, alteradoEm: agora });
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

/* Produto, unidade e peso de um CT-e já lançado (importado sem classificação, por exemplo). */
export function classificar(d, chave, { produto, unidade, pesoKg = null, pesoInformado = false }, quem, agora) {
  const cte = acharCte(d, chave);
  if (!cte) return { ok: false, erros: { chave: "CT-e não encontrado na base." } };
  const c = { ...cte, produto, unidade, pesoKg: numeroBR(pesoKg), pesoInformado: Boolean(pesoInformado) };
  const erros = errosClassificacao(d, c);
  if (Object.keys(erros).length) return { ok: false, erros };
  const antes = { valorSeguro: cte.valorSeguro, tarifa: cte.tarifa };
  Object.assign(cte, { produto, unidade, pesoInformado: c.pesoInformado, pesoKg: c.pesoKg }, calcular(d, c), { alteradoPor: quem, alteradoEm: agora });
  // na divergência de tarifa vale o número da planilha (CNPJ ou itinerário divergente não mexem na conta)
  if (cte.divergencia?.planilha && "tarifa" in cte.divergencia.planilha) { Object.assign(cte, antes); precosDaTarifa(d, cte); }
  registrar(d, "classificar", quem, agora, chave, `${resumoCte(cte)} · ${produtoDe(d, produto).nome} · ${unidadeDe(d, unidade).nome}`);
  return { ok: true, cte };
}

const idDoNome = nome => String(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/* novo: inclusão pelo formulário; recusa id ou nome que já existe (senão "BAG" viraria outro Big bag). */
const jaExiste = (lista, id, nome) => lista.some(x => x.id === id || idDoNome(x.nome) === idDoNome(nome));

export function cadastrarProduto(d, { id, nome }, quem, agora, { novo = false } = {}) {
  const limpo = String(nome ?? "").trim().replace(/\s+/g, " ");
  const pid = id || idDoNome(limpo);
  if (!limpo || !pid) return { ok: false, erro: "Informe o nome do produto." };
  if (novo && jaExiste(d.produtos, pid, limpo)) return { ok: false, erro: "Já existe um produto com esse nome." };
  const atual = produtoDe(d, pid);
  if (atual) atual.nome = limpo; else d.produtos.push({ id: pid, nome: limpo });
  registrar(d, "produto", quem, agora, "", `${pid} = ${limpo}`);
  return { ok: true, id: pid, produto: produtoDe(d, pid) };
}

export function cadastrarUnidade(d, { id, nome, kg, saca }, quem, agora, { novo = false } = {}) {
  const limpo = String(nome ?? "").trim().replace(/\s+/g, " ");
  const uid = id || idDoNome(limpo);
  const peso = kg === "" || kg == null ? null : numeroBR(kg);
  if (!limpo || !uid) return { ok: false, erro: "Informe o nome da unidade." };
  if (novo && jaExiste(d.unidades, uid, limpo)) return { ok: false, erro: "Já existe uma unidade com esse nome." };
  if (peso != null && !(peso > 0)) return { ok: false, erro: "O peso da unidade precisa ser maior que zero." };
  const atual = unidadeDe(d, uid);
  const emUso = [...d.ctes, ...d.lixeira.map(l => l.cte)].some(c => c.unidade === uid);
  if (atual && emUso && (atual.kg !== peso || atual.saca !== Boolean(saca))) return { ok: false, erro: "Unidade em uso: crie outra para um peso diferente." };
  if (atual) Object.assign(atual, { nome: limpo, kg: peso, saca: Boolean(saca) });
  else d.unidades.push({ id: uid, nome: limpo, kg: peso, saca: Boolean(saca) });
  registrar(d, "unidade", quem, agora, "", `${uid} = ${limpo}${peso ? ` (${peso} kg)` : ""}`);
  return { ok: true, id: uid, unidade: unidadeDe(d, uid) };
}

export function definirProdutoPadrao(d, cnpj, produto, quem, agora) {
  const n = normalizarCnpj(cnpj), c = d.cnpjs.find(x => x.cnpj === n);
  if (!c || (produto && !produtoDe(d, produto))) return { ok: false };
  c.produtoPadrao = produto || null;
  registrar(d, "cadastro", quem, agora, "", `${fmtCnpj(n)} · produto padrão ${produto ? produtoDe(d, produto).nome : "nenhum"}`);
  return { ok: true, cnpj: n, nome: c.nome, produtoPadrao: c.produtoPadrao };
}

/* Preços a partir da tarifa que está no CT-e (a da planilha, quando ela diverge da conta). */
export function precosDaTarifa(d, cte) {
  const u = unidadeDe(d, cte.unidade), r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  cte.precoTonelada = cte.pesoKg > 0 ? r2(cte.tarifa / (cte.pesoKg / 1000)) : null;
  cte.precoSaca = u?.saca && cte.quantidade > 0 ? r2(cte.tarifa / cte.quantidade) : null;
  return cte;
}
