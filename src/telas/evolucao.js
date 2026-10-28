// Evolução: o preço do recorte no topo, o gráfico mensal por transportador, a comparação na rota e as exceções.

import { filtrar, resumoGeral, transportadoresNaRota, excecoes, resumoRotas, produtosDaRota, valorMetrica, medianasPorMes } from "../agregacao.js";
import { pontosCtes, corGradiente } from "../graficos.js";
import { grupoDoCnpj, produtoDe, ctesNoCorte } from "../base.js";
import { raizCnpj, rotaDe, mesDe } from "../calculos.js";
import { esc, fmtMoeda, fmtNum, fmtPct, fmtMesLongo, fmtMes, fmtData, fmtCnpj } from "../formato.js";
import { $, $$, secHead, dica, tabelaOrdenavel, opcoes } from "../ui.js";

const variacaoHtml = v => v == null ? "—" : `<span class="${v > 0 ? "sobe" : v < 0 ? "desce" : ""}">${v > 0 ? "+" : ""}${fmtPct(v)}</span>`;
export const NOMES_METRICA = { tonelada: "Preço por tonelada", saca: "Preço por saca", tarifa: "Tarifa do frete" };
export { variacaoHtml };

/* Opções dos filtros a partir da base inteira. */
function listas(d) {
  const ctes = ctesNoCorte(d);
  const grupos = campo => {
    const m = new Map();
    for (const c of ctes) { const g = grupoDoCnpj(d, c[campo]); m.set(g.raiz, g.nome); }
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  };
  const meses = [...new Set(ctes.map(c => mesDe(c.emissao)))].sort().map(m => [m, fmtMes(m)]);
  return {
    rotas: resumoRotas(d, "saca").map(r => [r.rota, `${r.rota} · ${r.nCtes} CT-e`]),
    transportadores: grupos("cnpjTransportador"), clientes: grupos("cnpjCliente"),
    itinerarios: [...new Set(ctes.map(c => c.itinerario).filter(Boolean))].sort().map(i => [i, i]),
    meses,
    produtos: d.produtos.filter(p => ctes.some(c => c.produto === p.id)).map(p => [p.id, p.nome]),
  };
}

const TITULOS_EXC = {
  "preco-fora": ["R$/t fora da faixa da rota", "Acima de 3× ou abaixo de ⅓ da mediana da rota para o mesmo produto. Confira quantidade, unidade e frete no CT-e."],
  "a-classificar": ["CT-e a classificar", "Sem produto, unidade ou peso: fica fora do R$/t e conta só na tarifa. Classifique em Dados → Classificar CT-e."],
  "sem-cadastro": ["CNPJ sem nome no cadastro", "O painel mostra o CNPJ no lugar do nome. Cadastre o nome na aba Cadastro."],
  "diverge-planilha": ["Diferente da planilha", "Na importação, o CNPJ do transportador, o itinerário ou a tarifa não bateram; vale o CNPJ da chave e o itinerário do cadastro do Rodopar, e a tarifa da planilha."],
};

const NOMES_DIVERGENCIA = { valorSeguro: "Seguro", tarifa: "Tarifa", precoSaca: "R$/saca", cnpjTransportador: "CNPJ", itinerario: "Itinerário" };
const fmtDivergente = (k, v) => k === "cnpjTransportador" ? fmtCnpj(v) : k === "itinerario" ? (v || "em branco") : fmtMoeda(v);
/* "CNPJ: planilha 11.111.111/0001-00 · painel 05.780.969/0001-46" */
const oQueDivergiu = div => Object.keys(div?.planilha || {}).map(k =>
  `${NOMES_DIVERGENCIA[k] || k}: planilha ${fmtDivergente(k, div.planilha[k])}${k in (div.calculado || {}) ? " · painel " + fmtDivergente(k, div.calculado[k]) : ""}`).join("<br>");

function excecoesHtml(d) {
  const ex = excecoes(d);
  if (!ex.length) return `<div class="card"><div class="limpo"><b>Nenhuma exceção</b><p>Todos os CT-e têm sacas, CNPJ cadastrado e preço dentro da faixa da rota.</p></div></div>`;
  const porTipo = Object.keys(TITULOS_EXC).map(t => [t, ex.filter(e => e.tipo === t)]).filter(([, l]) => l.length);
  return `<p class="hint">Todas entram nos totais do painel; ficam aqui para que a correção volte ao lançamento.</p>` + porTipo.map(([tipo, lista]) => {
    const [titulo, acao] = TITULOS_EXC[tipo];
    const diverge = tipo === "diverge-planilha";
    const linhas = lista.map(e => e.cte
      ? `<tr><td class="mono">${esc(e.cte.numero)}${tipo === "a-classificar" ? "" : `<button class="btn mini" type="button" data-abrir-cte="${e.cte.chave}">Abrir na base</button>`}</td><td>${fmtData(e.cte.emissao)}</td><td>${esc(grupoDoCnpj(d, e.cte.cnpjTransportador).nome)}</td><td>${esc(rotaDe(e.cte))}</td><td>${esc(produtoDe(d, e.cte.produto)?.nome || "—")}</td><td class="num">${fmtMoeda(e.cte.precoTonelada)}</td>${diverge ? `<td class="sub">${esc(oQueDivergiu(e.cte.divergencia)).replace(/&lt;br&gt;/g, "<br>")}</td>` : ""}</tr>`
      : `<tr><td class="mono" colspan="2">${fmtCnpj(e.cnpj)} <button class="btn mini" type="button" data-abrir-cnpj="${e.cnpj}">Abrir no cadastro</button></td><td colspan="4">${d.ctes.filter(c => c.cnpjTransportador === e.cnpj || c.cnpjCliente === e.cnpj).length} CT-e usam este CNPJ</td></tr>`);
    const cab = lista[0].cte ? `<tr><th>CT-e</th><th>Emissão</th><th>Transportador</th><th>Rota</th><th>Produto</th><th class="num">R$/t</th>${diverge ? "<th>O que divergiu</th>" : ""}</tr>` : `<tr><th colspan="2">CNPJ</th><th colspan="4">Uso</th></tr>`;
    return `<div class="exc" data-tipo="${tipo}"><span class="pill">${lista.length} ${lista.length === 1 ? "registro" : "registros"}</span><h4>${esc(titulo)}</h4>
      <p class="exc-act">${esc(acao)}</p><div class="tabela"><table><thead>${cab}</thead><tbody>${linhas.slice(0, 20).join("")}</tbody>
      <tbody class="resto" hidden>${linhas.slice(20).join("")}</tbody></table></div>
      <div class="botoes">${tipo === "a-classificar" ? `<button class="btn mini primario" type="button" data-ir-classificar>Classificar CT-e</button>` : ""}
      ${linhas.length > 20 ? `<button class="btn mini" type="button" data-ver-todas>Ver todas (${linhas.length})</button>` : ""}</div></div>`;
  }).join("");
}

export function renderEvolucao(raiz, App) {
  const d = App.dados, f = App.filtros, metrica = f.metrica;
  if (!d.ctes.length) {
    raiz.innerHTML = `<section class="secao"><div class="wrap">${secHead("Evolução")}
      <div class="card vazio"><b>Nenhum CT-e lançado ainda</b>Lance os CT-e de concorrentes ou importe o histórico da planilha.
      <div class="botoes" style="justify-content:flex-start"><button class="btn primario" type="button" data-ir="lancamentos">Lançar CT-e</button>
      <button class="btn" type="button" data-ir="dados">Importar planilha</button></div></div></div></section>`;
    $$("[data-ir]", raiz).forEach(b => b.addEventListener("click", () => App.irPara(b.dataset.ir)));
    return;
  }
  const ctes = filtrar(d, f);
  const foraDoCorte = d.ctes.length - ctesNoCorte(d).length;
  const r = resumoGeral(ctes, metrica);
  const comValor = ctes.filter(c => valorMetrica(c, metrica) != null);
  const pontos = comValor.map(c => ({ data: c.emissao, valor: valorMetrica(c, metrica), chave: c.chave }));
  const comMediana = f.mediana !== "0";
  const medianas = comMediana ? Object.entries(medianasPorMes(comValor, metrica)).map(([mes, valor]) => ({ mes, valor })) : [];
  const vals = pontos.map(p => p.valor), lo = vals.length ? Math.min(...vals) : null, hi = vals.length ? Math.max(...vals) : null;
  const L = listas(d);
  const nomeMetrica = NOMES_METRICA[metrica];
  const misturados = f.rota && !f.produto ? produtosDaRota(d, f.rota) : [];
  const formatar = v => metrica === "tarifa" ? fmtMoeda(v).replace(/,\d\d$/, "") : fmtMoeda(v);
  const valorTxt = fmtMoeda(r.valor);

  raiz.innerHTML = `
  <section class="hero"><div class="wrap hero-grid">
    <div>
      <div class="eyebrow">${r.ultimoMes ? esc(fmtMesLongo(r.ultimoMes)) + " · último mês com dados" : "Sem CT-e no recorte"}</div>
      <h1>${esc(nomeMetrica)}<em>${esc(f.rota || "todas as rotas")}</em></h1>
      <p class="sub">Mediana dos CT-e de concorrentes no mês${metrica === "tarifa" ? ", sem seguro e adicionais" : metrica === "saca" ? ", só CT-e lançados em sacas" : ""}${f.produto ? " · " + esc(produtoDe(d, f.produto)?.nome || f.produto) : ""}. ${f.rota ? "" : "Sem rota escolhida, o número mistura rotas diferentes."}</p>
      <div class="bignum${valorTxt.length > 12 ? " longo" : ""}">${r.valor == null ? "—" : `<span class="un">R$ </span>${valorTxt.replace(/^R\$ /, "")}`}</div>
      <div class="bigcap">Mediana do mês</div>
      <div class="split">
        <div><span>${variacaoHtml(r.variacao)}</span><small>${r.mesAnterior ? "vs " + fmtMes(r.mesAnterior) : "sem mês anterior"}</small></div>
        <div><span>${fmtNum(r.nCtes)}</span><small>CT-e</small></div>
        <div><span>${fmtNum(r.nTransportadores)}</span><small>transportadores</small></div>
      </div>
    </div>
    <div class="on-navy">
      <div class="yard-head"><h3>Recorte</h3><p>Escolha a rota para comparar transportadores no mesmo trajeto.</p>
        <div class="modes" role="group" aria-label="Métrica">
          <button type="button" data-metrica="tonelada" aria-pressed="${metrica === "tonelada"}">R$/t</button>
          <button type="button" data-metrica="saca" aria-pressed="${metrica === "saca"}">R$/saca</button>
          <button type="button" data-metrica="tarifa" aria-pressed="${metrica === "tarifa"}">Tarifa R$</button>
        </div></div>
      <div class="filtros">
        <label class="campo largo"><span>Rota</span><select id="f-rota" data-f="rota">${opcoes(L.rotas, f.rota, "Todas as rotas")}</select></label>
        <label class="campo largo"><span>Transportador</span><select data-f="transportador">${opcoes(L.transportadores, f.transportador)}</select></label>
        <label class="campo largo"><span>Cliente</span><select data-f="cliente">${opcoes(L.clientes, f.cliente)}</select></label>
        <label class="campo"><span>Produto</span><select id="f-produto" data-f="produto">${opcoes(L.produtos, f.produto)}</select></label>
        <label class="campo"><span>Cód. itinerário</span><select data-f="itinerario">${opcoes(L.itinerarios, f.itinerario)}</select></label>
        <label class="campo"><span>De</span><select data-f="mesIni">${opcoes(L.meses, f.mesIni, "Início")}</select></label>
        <label class="campo"><span>Até</span><select data-f="mesFim">${opcoes(L.meses, f.mesFim, "Fim")}</select></label>
        <div class="campo"><span>&nbsp;</span><button class="btn" type="button" data-limpar>Limpar recorte</button></div>
      </div>
    </div>
  </div></section>
  <section class="secao"><div class="wrap pilha">
    ${foraDoCorte ? `<p class="hint" id="aviso-corte">${fmtNum(foraDoCorte)} CT-e emitido${foraDoCorte === 1 ? "" : "s"} antes de ${fmtData(d.corte)} fora da análise (sem CT-e em mãos para classificar). A data de corte fica em Dados.</p>` : ""}
    ${misturados.length > 1 ? `<div class="exc" id="aviso-produtos"><span class="pill">Produtos misturados</span>
      <h4>Esta rota tem ${esc(misturados.map(p => produtoDe(d, p)?.nome || p).join(" e "))}</h4>
      <p class="exc-act">O frete de produtos diferentes tem preço diferente: escolha o produto no recorte para comparar transportadores.</p></div>` : ""}
    <div class="card">
      <div class="card-head"><div><h3>Evolução por CT-e</h3><p class="hint">Cada ponto é um CT-e, na data de emissão. A cor vai do azul (frete mais barato do recorte) ao rosa (mais caro)${comMediana ? "; a linha tracejada é a mediana do mês" : ""}. Clique num ponto para abrir o CT-e. Ponto com contorno na borda: fora da escala; o valor real aparece ao passar o mouse.</p></div>
        <div class="modes light" role="group" aria-label="Mediana do mês"><span class="modes-rot">Mediana do mês</span>
          <button type="button" data-mediana="1" aria-pressed="${comMediana}">ligada</button>
          <button type="button" data-mediana="0" aria-pressed="${!comMediana}">desligada</button></div></div>
      <div class="grafico">${pontosCtes(pontos, { medianas, formatar })}</div>
      ${vals.length ? `<div class="legenda-gradiente"><span>mais barato <b>${formatar(lo)}</b></span><i style="background:linear-gradient(90deg, ${corGradiente(0)}, ${corGradiente(0.5)}, ${corGradiente(1)})"></i><span>mais caro <b>${formatar(hi)}</b></span></div>` : ""}
    </div>
    <div class="kpis">
      <div class="kpi"><b>${fmtNum(r.nCtes)}</b><u>CT-e no recorte</u></div>
      <div class="kpi"><b>${fmtNum(r.pesoT)}</b><u>Toneladas</u></div>
      <div class="kpi"><b>${fmtNum(r.nTransportadores)}</b><u>Transportadores</u></div>
      <div class="kpi"><b>${fmtNum(r.nRotas)}</b><u>Rotas</u></div>
    </div>
    <div class="card"><div class="card-head"><div><h3>Transportadores nesta rota</h3>
      <p class="hint">${f.rota ? "Clique no título da coluna para ordenar. Variação = último mês contra o primeiro mês com dados." : ""}</p></div></div>
      <div id="tab-transp"></div></div>
  </div></section>
  <section class="secao"><div class="wrap">${secHead("Exceções a tratar", "Registros que pedem conferência.")}<div id="excecoes">${excecoesHtml(d)}</div></div></section>`;

  const tab = $("#tab-transp", raiz);
  if (!f.rota) tab.innerHTML = `<p class="vazio">Escolha uma rota para comparar transportadores. Preço por saca de rotas diferentes não se compara.</p>`;
  else tabelaOrdenavel(tab, [
    { titulo: "Transportador", valor: t => t.nome, html: t => esc(t.nome) },
    { titulo: "CT-e", valor: t => t.nCtes, html: t => fmtNum(t.nCtes), num: true },
    { titulo: "Último preço", valor: t => t.ultimo?.valor, html: t => t.ultimo ? `${fmtMoeda(t.ultimo.valor)}<span class="sub">${fmtData(t.ultimo.emissao)}</span>` : "—", num: true },
    { titulo: "Mediana do período", valor: t => t.mediana, html: t => fmtMoeda(t.mediana), num: true },
    { titulo: "Variação", valor: t => t.variacao, html: t => variacaoHtml(t.variacao), num: true },
  ], transportadoresNaRota(d, ctes, metrica));

  $$("[data-metrica]", raiz).forEach(b => b.addEventListener("click", () => App.mudarFiltros({ metrica: b.dataset.metrica })));
  $$("select[data-f]", raiz).forEach(s => s.addEventListener("change", () => App.mudarFiltros({ [s.dataset.f]: s.value })));
  $("[data-limpar]", raiz).addEventListener("click", () => App.irPara("evolucao", { metrica }));
  $$("[data-abrir-cte]", raiz).forEach(b => b.addEventListener("click", () => App.abrirCte(b.dataset.abrirCte)));
  $$("[data-abrir-cnpj]", raiz).forEach(b => b.addEventListener("click", () => App.abrirCnpj(b.dataset.abrirCnpj)));
  $$("[data-ir-classificar]", raiz).forEach(b => b.addEventListener("click", () => {
    App.irPara("dados", { metrica }); requestAnimationFrame(() => document.querySelector("#classificar")?.scrollIntoView({ block: "start" }));
  }));
  $$("[data-ver-todas]", raiz).forEach(b => b.addEventListener("click", () => {
    b.closest(".exc").querySelector("tbody.resto").hidden = false; b.remove();
  }));

  $$("[data-mediana]", raiz).forEach(b => b.addEventListener("click", () => App.mudarFiltros({ mediana: b.dataset.mediana === "0" ? "0" : "" })));
  const graf = $(".grafico", raiz), porChave = new Map(comValor.map(c => [c.chave, c]));
  graf.addEventListener("mousemove", ev => {
    const c = porChave.get(ev.target.closest("circle.cte")?.dataset.chave);
    if (!c) return dica(null);
    dica(`<b>CT-e ${esc(c.numero)}</b>${fmtData(c.emissao)} · ${esc(grupoDoCnpj(d, c.cnpjTransportador).nome)}<br>${esc(rotaDe(c))}${c.produto ? " · " + esc(produtoDe(d, c.produto)?.nome || c.produto) : ""}<br><span>${esc(formatar(valorMetrica(c, metrica)))}</span>`, ev);
  });
  graf.addEventListener("mouseleave", () => dica(null));
  graf.addEventListener("click", ev => {
    const p = ev.target.closest("circle.cte");
    if (p) { dica(null); App.abrirCte(p.dataset.chave); }
  });
}
