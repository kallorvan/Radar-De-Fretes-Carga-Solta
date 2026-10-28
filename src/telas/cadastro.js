// Cadastro CNPJ: o nome de cada transportador e cliente. Filiais se juntam pela raiz (8 primeiros dígitos).

import { grupoDoCnpj } from "../base.js";
import { normalizarCnpj, raizCnpj, soDigitos } from "../calculos.js";
import { esc, fmtCnpj, fmtNum } from "../formato.js";
import { $, $$, secHead, tabelaOrdenavel, aviso } from "../ui.js";

const estado = { busca: "" };

export function renderCadastro(raiz, App) {
  const d = App.dados;
  const uso = new Map();
  for (const c of d.ctes) for (const k of [c.cnpjTransportador, c.cnpjCliente]) uso.set(k, (uso.get(k) || 0) + 1);
  raiz.innerHTML = `<section class="secao"><div class="wrap pilha">
    ${secHead("Cadastro CNPJ", "O nome que aparece no painel. CNPJ da mesma raiz (filiais) entram juntos; o grupo usa o nome da matriz.")}
    <form class="card" id="form-cnpj" data-escreve novalidate><div class="card-head"><div><h3>Incluir CNPJ</h3></div></div>
      <div class="form-grid"><label class="campo"><span>CNPJ</span><input name="cnpj" placeholder="00.000.000/0000-00" autocomplete="off"></label>
      <label class="campo w2"><span>Nome</span><input name="nome" maxlength="120" autocomplete="off"></label>
      <div class="campo"><span>&nbsp;</span><button class="btn primario" type="submit">Incluir</button></div></div></form>
    <div class="card"><div class="card-head"><div><h3>CNPJ cadastrados</h3><p class="hint">${fmtNum(d.cnpjs.length)} CNPJ. ${App.somenteLeitura ? "" : "Altere o nome e saia do campo para salvar."}</p></div>
      <label class="campo busca"><span>Buscar por nome ou CNPJ</span><input id="busca-cnpj" type="search" value="${esc(estado.busca)}" autocomplete="off"></label></div>
      <div id="tab-cnpj"></div></div></div></section>`;

  const pintar = () => {
    const q = estado.busca.trim().toUpperCase(), qd = soDigitos(q);
    const linhas = d.cnpjs.filter(c => !q || c.nome.includes(q) || (qd && c.cnpj.includes(qd)));
    tabelaOrdenavel($("#tab-cnpj", raiz), [
      { titulo: "CNPJ", valor: c => c.cnpj, html: c => `<span class="mono">${fmtCnpj(c.cnpj)}</span>` },
      { titulo: "Nome", valor: c => c.nome, html: c => App.somenteLeitura ? esc(c.nome) :
        `<input class="nome-cnpj" data-cnpj="${c.cnpj}" value="${esc(c.nome)}" aria-label="Nome de ${fmtCnpj(c.cnpj)}">` },
      { titulo: "Grupo (raiz)", valor: c => grupoDoCnpj(d, c.cnpj).nome, html: c => `${esc(grupoDoCnpj(d, c.cnpj).nome)}<span class="sub">${raizCnpj(c.cnpj)}</span>` },
      { titulo: "CT-e", valor: c => uso.get(c.cnpj) || 0, html: c => fmtNum(uso.get(c.cnpj) || 0), num: true },
    ], linhas, { ordem: { col: 1, desc: false }, vazia: "Nenhum CNPJ encontrado." });
  };
  pintar();
  $("#busca-cnpj", raiz).addEventListener("input", ev => { estado.busca = ev.target.value; pintar(); });
  // ouvinte na seção recém-desenhada: o #conteudo é o mesmo em todo redesenho e acumularia ouvintes
  raiz.firstElementChild.addEventListener("change", async ev => {
    const inp = ev.target.closest("input.nome-cnpj");
    if (!inp) return;
    const r = await App.alterar((dd, s, quem, agora) => App.acoes.cadastrar(dd, s, inp.dataset.cnpj, inp.value, quem, agora));
    if (r?.ok) aviso(`Nome de ${fmtCnpj(r.cnpj)} salvo.`);
  });
  $("#form-cnpj", raiz)?.addEventListener("submit", async ev => {
    ev.preventDefault();
    const f = new FormData(ev.target), cnpj = normalizarCnpj(f.get("cnpj")), nome = String(f.get("nome") || "").trim();
    if (cnpj.length !== 14 || !nome) { aviso("Informe o CNPJ com 14 dígitos e o nome.", true); return; }
    const r = await App.alterar((dd, s, quem, agora) => App.acoes.cadastrar(dd, s, cnpj, nome, quem, agora));
    if (r?.ok) aviso(`${fmtCnpj(cnpj)} cadastrado.`);
  });
}
