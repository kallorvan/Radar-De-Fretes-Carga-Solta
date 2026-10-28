// Rotas: uma linha por origem → destino, com a mediana do último mês e a tendência mês a mês.

import { resumoRotas, mesesEntre } from "../agregacao.js";
import { miniGrafico } from "../graficos.js";
import { esc, fmtMoeda, fmtNum, fmtMes } from "../formato.js";
import { $, $$, secHead, tabelaOrdenavel, opcoes } from "../ui.js";
import { produtoDe } from "../base.js";
import { variacaoHtml, NOMES_METRICA } from "./evolucao.js";

export function renderRotas(raiz, App) {
  const d = App.dados, metrica = App.filtros.metrica, produto = App.filtros.produto;
  const rotas = resumoRotas(d, metrica, { produto });
  const nomes = ids => ids.map(p => produtoDe(d, p)?.nome || p).join(", ");
  const todos = rotas.flatMap(r => Object.keys(r.porMes)).sort();
  const meses = todos.length ? mesesEntre(todos[0], todos.at(-1)) : [];
  raiz.innerHTML = `<section class="secao"><div class="wrap">
    ${secHead("Rotas", "Uma linha por origem → destino. Clique para ver a evolução da rota.")}
    <div class="card"><div class="card-head"><div><h3>${NOMES_METRICA[metrica]} por rota</h3>
      <p class="hint">Mediana do último mês com dados; a variação compara com o mês anterior que teve CT-e. O traço mostra ${meses.length ? fmtMes(meses[0]) + " a " + fmtMes(meses.at(-1)) : "os meses"}.</p></div>
      <label class="campo curto"><span>Produto</span><select id="f-produto-rotas">${opcoes(d.produtos.map(p => [p.id, p.nome]), produto)}</select></label>
      <div class="modes light" role="group" aria-label="Métrica">
        <button type="button" data-metrica="tonelada" aria-pressed="${metrica === "tonelada"}">R$/t</button>
        <button type="button" data-metrica="saca" aria-pressed="${metrica === "saca"}">R$/saca</button>
        <button type="button" data-metrica="tarifa" aria-pressed="${metrica === "tarifa"}">Tarifa R$</button></div></div>
      <div id="tab-rotas"></div></div></div></section>`;
  tabelaOrdenavel($("#tab-rotas", raiz), [
    { titulo: "Rota", valor: r => r.rota, html: r => esc(r.rota) },
    { titulo: "Produtos", valor: r => nomes(r.produtos), html: r => r.produtos.length ? esc(nomes(r.produtos)) : '<span class="sub">a classificar</span>' },
    { titulo: "CT-e", valor: r => r.nCtes, html: r => fmtNum(r.nCtes), num: true },
    { titulo: "Transportadores", valor: r => r.nTransportadores, html: r => fmtNum(r.nTransportadores), num: true },
    { titulo: "Último mês", valor: r => r.valor, html: r => r.valor == null ? "—" : `${fmtMoeda(r.valor)}<span class="sub">${fmtMes(r.ultimoMes)}</span>`, num: true },
    { titulo: "Variação", valor: r => r.variacao, html: r => variacaoHtml(r.variacao), num: true },
    { titulo: "Meses", valor: r => Object.keys(r.porMes).length, html: r => miniGrafico(r.porMes, meses, {}) },
  ], rotas, { aoClicar: r => App.irPara("evolucao", { metrica, rota: r.rota, produto }), vazia: produto ? "Nenhum CT-e desse produto." : "Nenhum CT-e lançado ainda." });
  $("#f-produto-rotas", raiz).addEventListener("change", ev => App.mudarFiltros({ produto: ev.target.value }));
  $$("[data-metrica]", raiz).forEach(b => b.addEventListener("click", () => App.mudarFiltros({ metrica: b.dataset.metrica })));
}
