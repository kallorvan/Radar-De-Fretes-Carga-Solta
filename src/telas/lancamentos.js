// Lançamentos: o formulário do CT-e (taxa do seguro, tarifa, peso, R$/t e R$/saca calculados e travados) e a base.

import { validarCampos, nomeDoCnpj, grupoDoCnpj, unidadeDe, produtoDe, noCorte } from "../base.js";
import { calcularCte, numeroDaChave, cnpjDaChave, codigoItinerario, normalizarCidade, normalizarCnpj, numeroBR, rotaDe, soDigitos } from "../calculos.js";
import { filtrar } from "../agregacao.js";
import { listarPdfs, indexarPdfs, pdfDoCte, PASTA_PDFS } from "../pdfs.js";
import { sugerirCidades, cidadeConhecida } from "../municipios.js";
import { esc, fmtMoeda, fmtNum, fmtPct, fmtData, fmtCnpj, fmtQuando } from "../formato.js";
import { $, $$, secHead, tabelaOrdenavel, confirmar, aviso } from "../ui.js";

const POR_PAGINA = 100;
const estado = { editando: null, busca: "", limite: POR_PAGINA, rascunho: null, selecionados: new Set(),
  // índice dos PDFs da pasta conectada; relido ao trocar de pasta ou pelo botão "Atualizar PDFs"
  pdfs: { pasta: null, indice: null, total: 0, lendo: null } };

/* Vindo de uma exceção ou do gráfico: a base já buscando o CT-e e, quando dá para lançar, a correção aberta. */
export function abrirNaBase(cte, { editar = true } = {}) {
  Object.assign(estado, { editando: editar ? cte.chave : null, busca: String(cte.numero), limite: POR_PAGINA, rascunho: null });
}

const CAMPOS = [
  ["chave", "Chave de acesso", true, "w2", "text", "44 dígitos"],
  ["numero", "Nº CT-e", true, "", "text", ""],
  ["emissao", "Emissão", true, "", "date", ""],
  ["cnpjTransportador", "CNPJ do transportador", true, "", "text", "sai da chave de acesso"],
  ["cnpjCliente", "CNPJ do cliente", true, "", "text", "00.000.000/0000-00"],
  ["origem", "Cidade origem", true, "", "text", ""],
  ["destino", "Cidade destino", true, "", "text", ""],
  ["itinerario", "Cód. itinerário", false, "", "text", "cadastro do Rodopar"],
  ["valorAssegurado", "Valor assegurado", false, "", "text", ""],
  ["valorSeguro", "Valor do seguro", false, "", "text", ""],
  ["valorFrete", "Valor do frete", true, "", "text", ""],
  ["adicionais", "Adicionais", false, "", "text", ""],
];
const TRAVADOS = new Set(["cnpjTransportador", "itinerario"]);   // saem da chave e da rota
const NUM = new Set(["valorAssegurado", "valorSeguro", "valorFrete", "adicionais", "quantidade", "pesoKg"]);
const fmtCampo = (k, v) => v == null || v === "" ? "" :
  k === "cnpjTransportador" || k === "cnpjCliente" ? fmtCnpj(v) :
  k === "pesoKg" ? fmtNum(v, Number.isInteger(v) ? 0 : 2) :
  NUM.has(k) ? String(v).replace(".", ",") : String(v);
const opcoesLista = (lista, atual) => `<option value="">Escolha</option>` +
  lista.map(x => `<option value="${esc(x.id)}"${x.id === atual ? " selected" : ""}>${esc(x.nome)}</option>`).join("");

function lerForm(form) {
  const fd = new FormData(form), c = {};
  for (const [k] of CAMPOS) c[k] = fd.get(k) ?? "";
  if (estado.editando) c.chave = estado.editando;
  for (const k of ["produto", "unidade", "quantidade", "pesoKg"]) c[k] = fd.get(k) ?? "";
  // a caixa fica desabilitada (e fora do FormData) quando a unidade não tem peso: aí o peso é sempre o do CT-e
  c.pesoInformado = form.querySelector("[name=pesoInformado]").checked;
  c.vpo = fd.get("vpo") === "on";
  c.observacoes = fd.get("observacoes") ?? "";
  for (const k of NUM) c[k] = numeroBR(c[k]);
  c.nomeTransportador = (fd.get("nomeTransportador") ?? "").trim();
  c.nomeCliente = (fd.get("nomeCliente") ?? "").trim();
  return c;
}

function formHtml(App, cte) {
  const v = cte || estado.rascunho || {};
  return `<form id="form-cte" class="card${cte ? " editando" : ""}" novalidate data-escreve>
    <div class="card-head"><div><h3>${cte ? "Corrigir lançamento" : "Lançar CT-e"}</h3>
      <p class="hint">${cte ? `Corrigindo o CT-e Nº ${esc(cte.numero)}, lançado por ${esc(cte.criadoPor)} em ${fmtQuando(cte.criadoEm)}. A chave não muda.` :
        "Campos com * são obrigatórios. Taxa do seguro, tarifa, peso, R$/t e R$/saca são calculados."}</p></div></div>
    <div class="form-grid">
      ${CAMPOS.map(([k, rot, obrig, cls, tipo, ph]) => `<label class="campo ${cls}"><span>${rot}${obrig ? ' <i class="obrig">*</i>' : ""}</span>
        <input name="${k}" type="${tipo}" ${tipo === "text" && (NUM.has(k) || k === "numero") ? 'inputmode="decimal"' : ""} placeholder="${ph}"
          value="${esc(fmtCampo(k, v[k]))}" ${k === "chave" && cte ? "disabled" : ""} ${TRAVADOS.has(k) ? "readonly" : ""} ${k === "origem" || k === "destino" ? `role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sug-${k}"` : ""} autocomplete="off">
        ${k === "origem" || k === "destino" ? `<div class="sugestoes" id="sug-${k}" role="listbox" hidden></div><span class="nota aviso-cidade" data-cidade-aviso="${k}"></span>` : ""}
        ${k.startsWith("cnpj") ? `<span class="nota" data-nome="${k}"></span>` : ""}<span class="erro" data-erro="${k}"></span></label>`).join("")}
      <label class="campo"><span>Produto <i class="obrig">*</i></span><select name="produto">${opcoesLista(App.dados.produtos, v.produto)}</select><span class="erro" data-erro="produto"></span></label>
      <label class="campo"><span>Unidade <i class="obrig">*</i></span><select name="unidade">${opcoesLista(App.dados.unidades, v.unidade)}</select><span class="erro" data-erro="unidade"></span></label>
      <label class="campo"><span>Quantidade <i class="obrig">*</i></span><input name="quantidade" type="text" inputmode="decimal" value="${esc(fmtCampo("quantidade", v.quantidade))}" autocomplete="off"><span class="erro" data-erro="quantidade"></span></label>
      <div class="campo"><span>Peso total (kg)</span><input name="pesoKg" type="text" inputmode="decimal" value="${esc(fmtCampo("pesoKg", v.pesoKg))}" autocomplete="off" aria-label="Peso total (kg)">
        <label class="nota caixa"><input type="checkbox" name="pesoInformado" ${v.pesoInformado ? "checked" : ""}> Usar o peso do CT-e</label><span class="erro" data-erro="pesoKg"></span></div>
      <label class="campo"><span>Taxa do seguro</span><output name="taxaSeguro">—</output></label>
      <label class="campo"><span>Tarifa do frete</span><output name="tarifa">—</output></label>
      <label class="campo"><span>R$/t</span><output name="precoTonelada">—</output></label>
      <label class="campo"><span>R$/saca</span><output name="precoSaca">—</output></label>
      <label class="campo check"><input type="checkbox" name="vpo" ${v.vpo ? "checked" : ""}><span>VPO</span></label>
      <label class="campo w3"><span>Observações</span><input name="observacoes" value="${esc(v.observacoes || "")}" maxlength="300"></label>
    </div>
    ${cte && cte.cnpjTransportador !== cnpjDaChave(cte.chave) ? `<p class="aviso-campo" id="aviso-cnpj-chave">O CNPJ do transportador guardado neste CT-e (${fmtCnpj(cte.cnpjTransportador)}) não bate com a chave de acesso. Ao salvar a correção, vale o da chave: ${fmtCnpj(cnpjDaChave(cte.chave))}.</p>` : ""}
    <div id="form-msg"></div>
    <div class="botoes">${cte ? `${botaoPdf(cte, pdfDe(App, cte, new Map([[cte.numero, App.dados.ctes.filter(x => x.numero === cte.numero).length]]))).replace("btn mini", "btn")}
      <button class="btn" type="button" data-cancelar>Cancelar correção</button>` : `<button class="btn" type="button" data-limpar>Limpar</button>`}
      <button class="btn primario" type="submit">${cte ? "Salvar correção" : "Lançar CT-e"}</button></div>
  </form>`;
}

/* Recalcula os campos travados e mostra o nome de cada CNPJ (ou pede um, se for novo). */
function atualizarForm(form, App) {
  const chave = estado.editando || form.querySelector("[name=chave]").value;
  form.querySelector("[name=cnpjTransportador]").value = fmtCnpj(cnpjDaChave(chave)) || "";
  const origem = form.querySelector("[name=origem]").value, destino = form.querySelector("[name=destino]").value;
  const atual = estado.editando && App.dados.ctes.find(c => c.chave === estado.editando);
  const mesmaRota = atual && normalizarCidade(origem) === atual.origem && normalizarCidade(destino) === atual.destino;
  form.querySelector("[name=itinerario]").value = codigoItinerario(origem, destino) || (mesmaRota ? atual.itinerario || "" : "");
  const cliente = form.querySelector("[name=cnpjCliente]"), prod = form.querySelector("[name=produto]");
  const padrao = App.dados.cnpjs.find(x => x.cnpj === normalizarCnpj(cliente.value))?.produtoPadrao;
  if (!prod.value && padrao && produtoDe(App.dados, padrao)) prod.value = padrao;   // o produto de costume do cliente
  const u = unidadeDe(App.dados, form.querySelector("[name=unidade]").value);
  const caixa = form.querySelector("[name=pesoInformado]"), peso = form.querySelector("[name=pesoKg]");
  const semPesoPadrao = Boolean(u) && !(u.kg > 0);
  if (semPesoPadrao) caixa.checked = true;
  caixa.disabled = semPesoPadrao;
  peso.readOnly = !caixa.checked;
  const c = lerForm(form);
  const r = calcularCte({ ...c, unidade: u, pesoInformado: caixa.checked });
  if (!caixa.checked) peso.value = r.pesoKg != null ? fmtNum(r.pesoKg) : "";
  const ok = c.valorFrete != null;
  form.querySelector("output[name=taxaSeguro]").textContent = r.taxaSeguro != null ? fmtPct(r.taxaSeguro, 4) : "—";
  form.querySelector("output[name=tarifa]").textContent = ok ? fmtMoeda(r.tarifa) : "—";
  form.querySelector("output[name=precoTonelada]").textContent = ok && r.precoTonelada != null ? fmtMoeda(r.precoTonelada) : "—";
  form.querySelector("output[name=precoSaca]").textContent = ok && r.precoSaca != null ? fmtMoeda(r.precoSaca) : "—";
  for (const [campo, nomeCampo] of [["cnpjTransportador", "nomeTransportador"], ["cnpjCliente", "nomeCliente"]]) {
    const cnpj = normalizarCnpj(c[campo]), alvo = form.querySelector(`[data-nome=${campo}]`);
    const nome = cnpj.length === 14 ? nomeDoCnpj(App.dados, cnpj) : null;
    if (nome || cnpj.length !== 14) { alvo.textContent = nome || ""; continue; }
    if (!alvo.querySelector("input")) alvo.innerHTML = `CNPJ sem cadastro. <input name="${nomeCampo}" placeholder="Nome para o cadastro" maxlength="120">`;
  }
}

function mostrarErros(form, erros) {
  $$("[aria-invalid]", form).forEach(i => i.removeAttribute("aria-invalid"));
  $$("[data-erro]", form).forEach(e => { e.textContent = ""; });
  for (const [k, msg] of Object.entries(erros)) {
    form.querySelector(`[name=${k}]`)?.setAttribute("aria-invalid", "true");
    const alvo = form.querySelector(`[data-erro=${k}]`) || form.querySelector(`[data-nome=${k === "nomeTransportador" ? "cnpjTransportador" : "cnpjCliente"}]`);
    if (alvo) alvo.insertAdjacentHTML("beforeend", `<span class="erro">${esc(msg)}</span>`);
  }
  form.querySelector("[aria-invalid=true]")?.focus();
}

async function enviar(form, App, { relancar = false } = {}) {
  const c = lerForm(form), msg = $("#form-msg", form);
  msg.innerHTML = "";
  const v = validarCampos(App.dados, c), erros = { ...v.erros };
  if (!nomeDoCnpj(App.dados, c.cnpjTransportador) && v.campos.cnpjTransportador.length === 14 && !c.nomeTransportador) erros.nomeTransportador = "Informe o nome do transportador para o cadastro.";
  if (!nomeDoCnpj(App.dados, c.cnpjCliente) && v.campos.cnpjCliente.length === 14 && !c.nomeCliente) erros.nomeCliente = "Informe o nome do cliente para o cadastro.";
  if (Object.keys(erros).length) return mostrarErros(form, erros);
  const editando = estado.editando;
  const naBase = !editando && App.dados.ctes.find(x => x.chave === v.campos.chave);
  const lixo = !editando && !naBase && App.dados.lixeira.find(l => l.cte.chave === v.campos.chave);
  if (naBase) {
    msg.innerHTML = `<div class="exc existente"><span class="pill">Chave repetida</span><h4>Este CT-e já foi lançado</h4>
      <p class="exc-act">Nº ${esc(naBase.numero)} · emissão ${fmtData(naBase.emissao)} · ${esc(grupoDoCnpj(App.dados, naBase.cnpjTransportador).nome)} · lançado por ${esc(naBase.criadoPor)} em ${fmtQuando(naBase.criadoEm)}.</p>
      <button class="btn" type="button" data-abrir="${esc(naBase.chave)}">Abrir para corrigir</button></div>`;
    return;
  }
  if (lixo && !relancar) {
    msg.innerHTML = `<div class="exc existente"><span class="pill">Na lixeira</span><h4>Este CT-e está na lixeira</h4>
      <p class="exc-act">Nº ${esc(lixo.cte.numero)} · lançado por ${esc(lixo.cte.criadoPor)} em ${fmtQuando(lixo.cte.criadoEm)} e excluído por ${esc(lixo.excluidoPor)} em ${fmtQuando(lixo.excluidoEm)}.
      Lançar de novo tira o lançamento antigo da lixeira e grava este, com os dados digitados agora.</p>
      <button class="btn primario" type="button" data-relancar>Lançar de novo</button></div>`;
    return;
  }
  estado.rascunho = editando ? null : c;
  const r = await App.alterar((d, s, quem, agora) => {
    if (c.nomeTransportador) App.acoes.cadastrar(d, s, c.cnpjTransportador, c.nomeTransportador, quem, agora);
    if (c.nomeCliente) App.acoes.cadastrar(d, s, c.cnpjCliente, c.nomeCliente, quem, agora);
    return editando ? App.acoes.corrigir(d, s, editando, c, quem, agora)
      : lixo ? App.acoes.relancar(d, s, c, quem, agora) : App.acoes.incluir(d, s, c, quem, agora);
  });
  if (r?.ok) {
    estado.rascunho = null; estado.editando = null;
    aviso(`CT-e ${r.cte.numero} ${editando ? "corrigido" : "lançado"}.`);
    App.render();
  } else if (r?.erros) mostrarErros(form, r.erros);
}

function baseHtml() {
  return `<div class="card"><div class="card-head"><div><h3>Base de CT-e</h3><p class="hint" id="base-cont"></p></div>
    <label class="campo busca"><span>Buscar por número ou chave</span><input id="busca" type="search" value="${esc(estado.busca)}" autocomplete="off"></label></div>
    <div class="barra-base">
      <span data-escreve><label class="caixa"><input type="checkbox" id="sel-todos"> Selecionar todos</label>
        <button class="btn mini perigo" type="button" data-excluir-selecionados disabled>Excluir selecionados (0)</button></span>
      <span class="pdfs"><span class="hint" id="pdfs-info"></span><button class="btn mini" type="button" data-atualizar-pdfs>Atualizar PDFs</button></span>
    </div>
    <div id="tab-base"></div><div class="botoes" id="base-mais"></div></div>`;
}

/* Lê a pasta de PDFs da pasta conectada (uma vez por pasta, ou quando pedido) e redesenha a base. */
async function carregarPdfs(raiz, App, { forcar = false } = {}) {
  const pasta = App.gravador?.pasta, p = estado.pdfs;
  if (!pasta) { Object.assign(p, { pasta: null, indice: null, total: 0 }); return; }
  if (!forcar && p.pasta === pasta && (p.indice || p.lendo)) return p.lendo;
  p.pasta = pasta;
  p.lendo = listarPdfs(pasta).then(lista => { Object.assign(p, { indice: indexarPdfs(lista), total: lista.length, lendo: null }); },
    () => { Object.assign(p, { indice: indexarPdfs([]), total: 0, lendo: null }); });
  await p.lendo;
  if (raiz.isConnected && $("#tab-base", raiz)) pintarBase(raiz, App);
}

function pdfDe(App, c, mesmoNumero) {
  const p = estado.pdfs;
  if (!App.gravador?.pasta) return { ok: false, dica: "Conecte a pasta (aba Dados) para abrir os PDFs." };
  if (!p.indice) return { ok: false, dica: "Lendo a pasta de PDFs…" };
  const r = pdfDoCte(p.indice, c, { nomeTransportador: nomeDoCnpj(App.dados, c.cnpjTransportador) || "", outrosComMesmoNumero: (mesmoNumero.get(c.numero) || 1) - 1 });
  return r.ok ? { ok: true, item: r.item, dica: `Abrir ${r.item.caminho}` }
    : { ok: false, dica: r.motivo === "varios" ? "Mais de um PDF com esse número na pasta; o nome do transportador não decide." : `PDF não encontrado na pasta ${PASTA_PDFS}.` };
}
const botaoPdf = (c, r) => `<button class="btn mini" type="button" data-pdf="${c.chave}" title="${esc(r.dica)}"${r.ok ? "" : " disabled"}>PDF</button>`;

async function abrirPdf(App, chave) {
  const c = App.dados.ctes.find(x => x.chave === chave);
  const mesmo = new Map(); for (const x of App.dados.ctes) mesmo.set(x.numero, (mesmo.get(x.numero) || 0) + 1);
  const r = c && pdfDe(App, c, mesmo);
  if (!r?.ok) return aviso(r?.dica || "CT-e não encontrado.", true);
  try {
    const url = URL.createObjectURL(await r.item.handle.getFile());
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { aviso(`Não foi possível abrir ${r.item.caminho}. Atualize os PDFs e tente de novo.`, true); }
}

function pintarBase(raiz, App) {
  const d = App.dados, q = soDigitos(estado.busca);
  const todas = filtrar(d, { ...App.filtros, metrica: undefined }, { aplicarCorte: false })
    // até 9 dígitos é número de CT-e; mais que isso, pedaço da chave
    .filter(c => !q || (q.length <= 9 ? String(c.numero).startsWith(String(Number(q))) : c.chave.includes(q)))
    .sort((a, b) => b.emissao.localeCompare(a.emissao) || b.numero - a.numero);
  const linhas = todas.slice(0, estado.limite);
  const recorte = ["rota", "transportador", "cliente", "itinerario", "mesIni", "mesFim"].some(k => App.filtros[k]);
  $("#base-cont", raiz).textContent = `${fmtNum(todas.length)} de ${fmtNum(d.ctes.length)} CT-e${recorte ? " (com o recorte da Evolução)" : ""}. Mais recentes primeiro.`;
  for (const k of estado.selecionados) if (!d.ctes.some(c => c.chave === k)) estado.selecionados.delete(k);   // excluídos por outra via
  const mesmoNumero = new Map(); for (const c of d.ctes) mesmoNumero.set(c.numero, (mesmoNumero.get(c.numero) || 0) + 1);
  const p = estado.pdfs;
  $("#pdfs-info", raiz).textContent = !App.gravador?.pasta ? "PDFs: conecte a pasta na aba Dados." : !p.indice ? "Lendo a pasta de PDFs…" : `${fmtNum(p.total)} PDF${p.total === 1 ? "" : "s"} em ${PASTA_PDFS}.`;
  tabelaOrdenavel($("#tab-base", raiz), [
    { titulo: "", valor: () => null, html: c => `<span data-escreve><input type="checkbox" data-sel="${c.chave}" aria-label="Selecionar CT-e ${esc(c.numero)}"${estado.selecionados.has(c.chave) ? " checked" : ""}></span>` },
    { titulo: "Emissão", valor: c => c.emissao, html: c => fmtData(c.emissao) + (noCorte(d, c) ? "" : '<span class="sub">antes do corte</span>') },
    { titulo: "Nº", valor: c => c.numero, html: c => `<span class="mono">${esc(c.numero)}</span>` },
    { titulo: "Transportador", valor: c => grupoDoCnpj(d, c.cnpjTransportador).nome, html: c => esc(nomeDoCnpj(d, c.cnpjTransportador) || fmtCnpj(c.cnpjTransportador)) },
    { titulo: "Cliente", valor: c => grupoDoCnpj(d, c.cnpjCliente).nome, html: c => esc(nomeDoCnpj(d, c.cnpjCliente) || fmtCnpj(c.cnpjCliente)) },
    { titulo: "Rota", valor: c => rotaDe(c), html: c => esc(rotaDe(c)) },
    { titulo: "Produto", valor: c => produtoDe(d, c.produto)?.nome || "", html: c => c.produto ? esc(produtoDe(d, c.produto)?.nome || c.produto) : '<span class="sub">a classificar</span>' },
    { titulo: "Quantidade", valor: c => c.quantidade, html: c => `${fmtNum(c.quantidade, Number.isInteger(c.quantidade) ? 0 : 2)}<span class="sub">${esc(unidadeDe(d, c.unidade)?.nome || "—")}</span>`, num: true },
    { titulo: "Tarifa", valor: c => c.tarifa, html: c => fmtMoeda(c.tarifa), num: true },
    { titulo: "R$/t", valor: c => c.precoTonelada, html: c => fmtMoeda(c.precoTonelada), num: true },
    { titulo: "R$/saca", valor: c => c.precoSaca, html: c => fmtMoeda(c.precoSaca), num: true },
    { titulo: "Lançado por", valor: c => c.criadoPor, html: c => `${esc(c.alteradoPor || c.criadoPor)}<span class="sub">${c.alteradoPor ? "corrigiu " : ""}${fmtQuando(c.alteradoEm || c.criadoEm).slice(0, 10)}</span>` },
    { titulo: "", valor: () => null, html: c => `${botaoPdf(c, pdfDe(App, c, mesmoNumero))} <span data-escreve><button class="btn mini" type="button" data-corrigir="${c.chave}">Corrigir</button>
      <button class="btn mini perigo" type="button" data-excluir="${c.chave}">Excluir</button></span>` },
  ], linhas, { vazia: q ? "Nenhum CT-e com esse número ou chave." : "Nenhum CT-e no recorte." });
  pintarSelecao(raiz, linhas);
  $("#base-mais", raiz).innerHTML = todas.length > linhas.length
    ? `<button class="btn" type="button" data-mais>Mostrar mais ${fmtNum(Math.min(POR_PAGINA, todas.length - linhas.length))}</button>` : "";
}

/* Contador do botão e o "Selecionar todos", que reflete os CT-e na tela. */
function pintarSelecao(raiz, linhas = null) {
  const n = estado.selecionados.size, b = $("[data-excluir-selecionados]", raiz);
  b.textContent = `Excluir selecionados (${fmtNum(n)})`;
  b.disabled = !n;
  const caixas = $$("#tab-base input[data-sel]", raiz);
  $("#sel-todos", raiz).checked = caixas.length > 0 && caixas.every(x => x.checked);
}

/* Sugestões de município sob os campos de origem e destino: setas escolhem, Enter confirma, Esc fecha.
   Ao sair do campo, um nome fora da lista de municípios (e da base) ganha um aviso, sem impedir o lançamento. */
function ligarCidades(form, App) {
  const extras = [...new Set(App.dados.ctes.flatMap(c => [c.origem, c.destino]))];
  for (const nome of ["origem", "destino"]) {
    const inp = form.querySelector(`[name=${nome}]`), caixa = form.querySelector(`#sug-${nome}`), aviso = form.querySelector(`[data-cidade-aviso=${nome}]`);
    let lista = [], ativo = -1;
    const fechar = () => { lista = []; ativo = -1; caixa.hidden = true; caixa.innerHTML = ""; inp.setAttribute("aria-expanded", "false"); };
    const pintar = () => {
      caixa.innerHTML = lista.map((c, i) => `<button type="button" role="option" tabindex="-1" data-cidade="${esc(c)}" aria-selected="${i === ativo}">${esc(c)}</button>`).join("");
      caixa.hidden = !lista.length; inp.setAttribute("aria-expanded", String(lista.length > 0));
      caixa.style.top = `${inp.offsetTop + inp.offsetHeight + 2}px`;   // logo abaixo do campo, por cima das mensagens
      caixa.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    };
    const avisar = () => { aviso.textContent = cidadeConhecida(inp.value, extras) ? "" : "Cidade não encontrada na lista de municípios. Confira o nome."; };
    const escolher = c => { inp.value = c; fechar(); avisar(); inp.dispatchEvent(new Event("change", { bubbles: true })); };
    inp.addEventListener("input", () => { lista = sugerirCidades(inp.value, { extras }); ativo = -1; aviso.textContent = ""; pintar(); });
    inp.addEventListener("keydown", ev => {
      if (!lista.length) return;
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); ativo = (ativo + (ev.key === "ArrowDown" ? 1 : -1) + lista.length) % lista.length; pintar(); }
      else if (ev.key === "Enter" && ativo >= 0) { ev.preventDefault(); escolher(lista[ativo]); }
      else if (ev.key === "Escape") fechar();
    });
    caixa.addEventListener("mousedown", ev => { const b = ev.target.closest("[data-cidade]"); if (b) { ev.preventDefault(); escolher(b.dataset.cidade); } });
    inp.addEventListener("blur", () => { fechar(); avisar(); });
  }
}

export function renderLancamentos(raiz, App) {
  const cte = estado.editando ? App.dados.ctes.find(c => c.chave === estado.editando) : null;
  if (!cte) estado.editando = null;
  raiz.innerHTML = `<section class="secao"><div class="wrap pilha">
    ${secHead("Lançamentos", "Um CT-e de concorrente por lançamento. Cada um registra quem lançou e quando.")}
    ${App.somenteLeitura ? `<div class="card"><p class="vazio">Painel aberto só para consulta: para lançar, abra o HTML pela pasta compartilhada no Chrome ou Edge.</p></div>` : formHtml(App, cte)}
    ${baseHtml()}</div></section>`;

  const form = $("#form-cte", raiz);
  if (form) {
    atualizarForm(form, App);
    ligarCidades(form, App);
    form.addEventListener("input", ev => {
      if (ev.target.name === "chave" && !estado.editando) {
        const n = numeroDaChave(ev.target.value), num = form.querySelector("[name=numero]");
        if (n && !num.value) num.value = n;
      }
      atualizarForm(form, App);
    });
    form.addEventListener("change", () => atualizarForm(form, App));
    form.addEventListener("submit", ev => { ev.preventDefault(); enviar(form, App); });
    form.addEventListener("click", ev => {
      if (ev.target.closest("[data-relancar]")) { enviar(form, App, { relancar: true }); return; }
      const abrirEx = ev.target.closest("[data-abrir]");
      if (abrirEx) { estado.editando = abrirEx.dataset.abrir; estado.rascunho = null; App.render(); scrollTo(0, 0); }
      if (ev.target.closest("[data-cancelar]")) { estado.editando = null; App.render(); }
      if (ev.target.closest("[data-limpar]")) { estado.rascunho = null; App.render(); }
    });
    if (cte) form.scrollIntoView({ block: "start" });
  }

  pintarBase(raiz, App);
  carregarPdfs(raiz, App);
  $("#busca", raiz).addEventListener("input", ev => { estado.busca = ev.target.value; estado.limite = POR_PAGINA; pintarBase(raiz, App); });
  // ouvinte na seção recém-desenhada: o #conteudo é o mesmo em todo redesenho e acumularia ouvintes
  raiz.firstElementChild.addEventListener("change", ev => {
    const t = ev.target;
    if (t.matches("input[data-sel]")) { if (t.checked) estado.selecionados.add(t.dataset.sel); else estado.selecionados.delete(t.dataset.sel); pintarSelecao(raiz); }
    else if (t.id === "sel-todos") {
      for (const x of $$("#tab-base input[data-sel]", raiz)) { x.checked = t.checked; if (t.checked) estado.selecionados.add(x.dataset.sel); else estado.selecionados.delete(x.dataset.sel); }
      pintarSelecao(raiz);
    }
  });
  raiz.firstElementChild.addEventListener("click", async ev => {
    if (ev.target.closest("[data-pdf]")) return abrirPdf(App, ev.target.closest("[data-pdf]").dataset.pdf);
    if (ev.target.closest("[data-atualizar-pdfs]")) {
      if (!App.gravador?.pasta) return aviso("Conecte a pasta na aba Dados para ler os PDFs.", true);
      await carregarPdfs(raiz, App, { forcar: true });
      return aviso(`${fmtNum(estado.pdfs.total)} PDF${estado.pdfs.total === 1 ? "" : "s"} encontrados em ${PASTA_PDFS}.`);
    }
    if (ev.target.closest("[data-excluir-selecionados]")) {
      const chaves = [...estado.selecionados].filter(k => App.dados.ctes.some(c => c.chave === k));
      if (!chaves.length) return;
      if (!(await confirmar(`Excluir ${chaves.length} CT-e?`, "Eles vão para a lixeira e podem ser restaurados na aba Dados. Cada exclusão fica registrada com o seu nome.", "Excluir"))) return;
      const r = await App.alterar((d, s, quem, agora) => App.acoes.excluirVarios(d, s, chaves, quem, agora));
      if (r?.ok) { estado.selecionados.clear(); aviso(`${r.excluidos} CT-e enviados para a lixeira.`); App.render(); }
      return;
    }
    const b = ev.target.closest("[data-corrigir],[data-excluir],[data-mais]");
    if (!b) return;
    if (b.dataset.mais !== undefined) { estado.limite += POR_PAGINA; pintarBase(raiz, App); return; }
    if (b.dataset.corrigir) { estado.editando = b.dataset.corrigir; estado.rascunho = null; App.render(); return; }
    const c = App.dados.ctes.find(x => x.chave === b.dataset.excluir);
    if (c && await confirmar(`Excluir o CT-e Nº ${c.numero}?`, "Ele vai para a lixeira e pode ser restaurado na aba Dados. A exclusão fica registrada com o seu nome.", "Excluir")) {
      const r = await App.alterar((d, s, quem, agora) => App.acoes.excluir(d, s, c.chave, quem, agora));
      if (r?.ok) aviso(`CT-e ${c.numero} enviado para a lixeira.`);
    }
  });
}
