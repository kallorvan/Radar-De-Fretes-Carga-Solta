// Cadastro: o nome e o produto de costume de cada CNPJ (filiais se juntam pela raiz) e as listas
// de produtos e unidades de medida usadas no lançamento.

import { grupoDoCnpj } from "../base.js";
import { normalizarCnpj, raizCnpj, soDigitos } from "../calculos.js";
import { esc, fmtCnpj, fmtNum } from "../formato.js";
import { $, secHead, tabelaOrdenavel, aviso } from "../ui.js";

const estado = { busca: "", destaque: null };

/* Vindo de uma exceção: a lista inteira, com a linha do CNPJ destacada; sem cadastro, o "Incluir CNPJ" já preenchido. */
export const abrirNoCadastro = cnpj => { estado.busca = ""; estado.destaque = cnpj; };

const opcoesProduto = (d, atual) => `<option value="">—</option>` +
  d.produtos.map(p => `<option value="${esc(p.id)}"${p.id === atual ? " selected" : ""}>${esc(p.nome)}</option>`).join("");

export function renderCadastro(raiz, App) {
  const d = App.dados, so = App.somenteLeitura;
  const uso = new Map(), usoUnidade = new Map(), usoProduto = new Map();
  for (const c of [...d.ctes, ...d.lixeira.map(l => l.cte)]) {
    usoUnidade.set(c.unidade, (usoUnidade.get(c.unidade) || 0) + 1);
    usoProduto.set(c.produto, (usoProduto.get(c.produto) || 0) + 1);
  }
  for (const c of d.ctes) for (const k of [c.cnpjTransportador, c.cnpjCliente]) uso.set(k, (uso.get(k) || 0) + 1);

  raiz.innerHTML = `<section class="secao"><div class="wrap pilha">
    ${secHead("Cadastro", "Nomes dos CNPJ, o produto de costume de cada cliente, e as listas de produtos e unidades de medida.")}
    <div class="cols2">
      <div class="card"><h3>Produtos</h3><p class="hint">O que é transportado. O nome pode mudar a qualquer momento.</p>
        <div id="tab-produtos"></div>
        <form id="form-produto" class="form-linha" data-escreve novalidate><label class="campo"><span>Novo produto</span><input name="nome" maxlength="60" autocomplete="off"></label>
          <button class="btn primario" type="submit">Incluir</button></form></div>
      <div class="card"><h3>Unidades de medida</h3><p class="hint">O peso de uma unidade em uso não muda: para outro peso, crie outra unidade. Sem peso, o lançamento pede o peso do CT-e.</p>
        <div id="tab-unidades"></div>
        <form id="form-unidade" class="form-linha" data-escreve novalidate><label class="campo"><span>Nova unidade</span><input name="nome" maxlength="60" autocomplete="off"></label>
          <label class="campo curto"><span>kg por unidade</span><input name="kg" inputmode="decimal" autocomplete="off" placeholder="vazio = peso do CT-e"></label>
          <label class="campo check"><input type="checkbox" name="saca"><span>É saca</span></label>
          <button class="btn primario" type="submit">Incluir</button></form></div>
    </div>
    <form class="card" id="form-cnpj" data-escreve novalidate><div class="card-head"><div><h3>Incluir CNPJ</h3></div></div>
      <div class="form-grid"><label class="campo"><span>CNPJ</span><input name="cnpj" placeholder="00.000.000/0000-00" autocomplete="off"></label>
      <label class="campo w2"><span>Nome</span><input name="nome" maxlength="120" autocomplete="off"></label>
      <div class="campo"><span>&nbsp;</span><button class="btn primario" type="submit">Incluir</button></div></div></form>
    <div class="card"><div class="card-head"><div><h3>CNPJ cadastrados</h3><p class="hint">${fmtNum(d.cnpjs.length)} CNPJ. ${so ? "" : "Altere o nome e saia do campo para salvar. O produto padrão preenche o produto no lançamento e classifica o histórico."}</p></div>
      <label class="campo busca"><span>Buscar por nome ou CNPJ</span><input id="busca-cnpj" type="search" value="${esc(estado.busca)}" autocomplete="off"></label></div>
      <div id="tab-cnpj"></div></div></div></section>`;

  tabelaOrdenavel($("#tab-produtos", raiz), [
    { titulo: "Produto", valor: p => p.nome, html: p => so ? esc(p.nome) : `<input class="nome-lista" data-produto="${esc(p.id)}" value="${esc(p.nome)}" aria-label="Nome do produto ${esc(p.nome)}">` },
    { titulo: "CT-e", valor: p => usoProduto.get(p.id) || 0, html: p => fmtNum(usoProduto.get(p.id) || 0), num: true },
  ], d.produtos);
  tabelaOrdenavel($("#tab-unidades", raiz), [
    { titulo: "Unidade", valor: u => u.nome, html: u => so ? esc(u.nome) : `<input class="nome-lista" data-unidade="${esc(u.id)}" value="${esc(u.nome)}" aria-label="Nome da unidade ${esc(u.nome)}">` },
    { titulo: "kg", valor: u => u.kg, html: u => so ? (u.kg ? fmtNum(u.kg) : "do CT-e") :
      `<input class="kg-lista" data-kg="${esc(u.id)}" value="${u.kg ?? ""}" placeholder="do CT-e" inputmode="decimal" ${usoUnidade.get(u.id) ? 'disabled title="Em uso: crie outra unidade para outro peso"' : ""} aria-label="kg da unidade ${esc(u.nome)}">`, num: true },
    { titulo: "Saca", valor: u => u.saca, html: u => u.saca ? "sim" : "não" },
    { titulo: "CT-e", valor: u => usoUnidade.get(u.id) || 0, html: u => fmtNum(usoUnidade.get(u.id) || 0), num: true },
  ], d.unidades);

  const pintar = () => {
    const q = estado.busca.trim().toUpperCase(), qd = soDigitos(q);
    const linhas = d.cnpjs.filter(c => !q || c.nome.includes(q) || (qd && c.cnpj.includes(qd)));
    tabelaOrdenavel($("#tab-cnpj", raiz), [
      { titulo: "CNPJ", valor: c => c.cnpj, html: c => `<span class="mono" data-linha-cnpj="${c.cnpj}">${fmtCnpj(c.cnpj)}</span>` },
      { titulo: "Nome", valor: c => c.nome, html: c => so ? esc(c.nome) :
        `<input class="nome-cnpj" data-cnpj="${c.cnpj}" value="${esc(c.nome)}" aria-label="Nome de ${fmtCnpj(c.cnpj)}">` },
      { titulo: "Produto padrão", valor: c => c.produtoPadrao || "", html: c => so ? esc(d.produtos.find(p => p.id === c.produtoPadrao)?.nome || "—") :
        `<select class="produto-padrao" data-cnpj="${c.cnpj}" aria-label="Produto padrão de ${fmtCnpj(c.cnpj)}">${opcoesProduto(d, c.produtoPadrao)}</select>` },
      { titulo: "Grupo (raiz)", valor: c => grupoDoCnpj(d, c.cnpj).nome, html: c => `${esc(grupoDoCnpj(d, c.cnpj).nome)}<span class="sub">${raizCnpj(c.cnpj)}</span>` },
      { titulo: "CT-e", valor: c => uso.get(c.cnpj) || 0, html: c => fmtNum(uso.get(c.cnpj) || 0), num: true },
    ], linhas, { ordem: { col: 1, desc: false }, vazia: "Nenhum CNPJ encontrado." });
  };
  pintar();
  if (estado.destaque) {
    const tr = raiz.querySelector(`[data-linha-cnpj="${estado.destaque}"]`)?.closest("tr"), form = $("#form-cnpj", raiz);
    const alvo = tr || form;
    if (!tr && form) { form.querySelector("[name=cnpj]").value = fmtCnpj(estado.destaque); form.querySelector("[name=nome]").focus({ preventScroll: true }); }
    else tr?.querySelector("input")?.focus({ preventScroll: true });
    if (alvo) { alvo.classList.add("destaque"); requestAnimationFrame(() => alvo.scrollIntoView({ block: "center" })); }
    estado.destaque = null;
  }
  $("#busca-cnpj", raiz).addEventListener("input", ev => { estado.busca = ev.target.value; pintar(); });

  const alterar = async (fn, ok) => { const r = await App.alterar(fn); if (r?.ok) aviso(ok(r)); else if (r?.erro) { aviso(r.erro, true); App.render(); } };
  // ouvinte na seção recém-desenhada: o #conteudo é o mesmo em todo redesenho e acumularia ouvintes
  raiz.firstElementChild.addEventListener("change", ev => {
    const t = ev.target;
    if (t.matches("input.nome-cnpj")) alterar((dd, s, quem, agora) => App.acoes.cadastrar(dd, s, t.dataset.cnpj, t.value, quem, agora), r => `Nome de ${fmtCnpj(r.cnpj)} salvo.`);
    else if (t.matches("select.produto-padrao")) alterar((dd, s, quem, agora) => App.acoes.definirProdutoPadrao(dd, s, t.dataset.cnpj, t.value || null, quem, agora), r => `Produto padrão de ${r.nome} salvo.`);
    else if (t.matches("input[data-produto]")) alterar((dd, s, quem, agora) => App.acoes.cadastrarProduto(dd, s, { id: t.dataset.produto, nome: t.value }, quem, agora), r => `Produto ${r.produto.nome} salvo.`);
    else if (t.matches("input[data-unidade], input[data-kg]")) {
      const id = t.dataset.unidade || t.dataset.kg, u = d.unidades.find(x => x.id === id);
      const nome = $(`input[data-unidade="${id}"]`, raiz).value, kg = $(`input[data-kg="${id}"]`, raiz).value;
      alterar((dd, s, quem, agora) => App.acoes.cadastrarUnidade(dd, s, { id, nome, kg, saca: u.saca }, quem, agora), r => `Unidade ${r.unidade.nome} salva.`);
    }
  });
  $("#form-produto", raiz)?.addEventListener("submit", ev => {
    ev.preventDefault();
    const nome = new FormData(ev.target).get("nome");
    if (!String(nome || "").trim()) return aviso("Informe o nome do produto.", true);
    alterar((dd, s, quem, agora) => App.acoes.cadastrarProduto(dd, s, { nome }, quem, agora, { novo: true }), r => `Produto ${r.produto.nome} incluído.`);
  });
  $("#form-unidade", raiz)?.addEventListener("submit", ev => {
    ev.preventDefault();
    const f = new FormData(ev.target), nome = String(f.get("nome") || "").trim();
    if (!nome) return aviso("Informe o nome da unidade.", true);
    alterar((dd, s, quem, agora) => App.acoes.cadastrarUnidade(dd, s, { nome, kg: f.get("kg"), saca: f.get("saca") === "on" }, quem, agora, { novo: true }), r => `Unidade ${r.unidade.nome} incluída.`);
  });
  $("#form-cnpj", raiz)?.addEventListener("submit", ev => {
    ev.preventDefault();
    const f = new FormData(ev.target), cnpj = normalizarCnpj(f.get("cnpj")), nome = String(f.get("nome") || "").trim();
    if (cnpj.length !== 14 || !nome) { aviso("Informe o CNPJ com 14 dígitos e o nome.", true); return; }
    alterar((dd, s, quem, agora) => App.acoes.cadastrar(dd, s, cnpj, nome, quem, agora), () => `${fmtCnpj(cnpj)} cadastrado.`);
  });
}
