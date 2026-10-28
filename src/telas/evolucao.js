// Evolução: o preço do recorte no topo, o gráfico mensal por transportador, a comparação na rota e as exceções.

import { filtrar, serieMensal, resumoGeral, transportadoresNaRota, excecoes, resumoRotas, produtosDaRota } from "../agregacao.js";
import { linhasMensais, CORES_SERIES } from "../graficos.js";
import { grupoDoCnpj, produtoDe } from "../base.js";
import { raizCnpj, rotaDe, mesDe } from "../calculos.js";
import { esc, fmtMoeda, fmtNum, fmtPct, fmtMesLongo, fmtMes, fmtData, fmtCnpj } from "../formato.js";
import { $, $$, secHead, dica, tabelaOrdenavel, opcoes } from "../ui.js";

const variacaoHtml = v => v == null ? "—" : `<span class="${v > 0 ? "sobe" : v < 0 ? "desce" : ""}">${v > 0 ? "+" : ""}${fmtPct(v)}</span>`;
export const NOMES_METRICA = { tonelada: "Preço por tonelada", saca: "Preço por saca", tarifa: "Tarifa do frete" };
export { variacaoHtml };

/* Opções dos filtros a partir da base inteira. */
function listas(d) {
  const grupos = campo => {
    const m = new Map();
    for (const c of d.ctes) { const g = grupoDoCnpj(d, c[campo]); m.set(g.raiz, g.nome); }
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  };
  const meses = [...new Set(d.ctes.map(c => mesDe(c.emissao)))].sort().map(m => [m, fmtMes(m)]);
  return {
    rotas: resumoRotas(d, "saca").map(r => [r.rota, `${r.rota} · ${r.nCtes} CT-e`]),
    transportadores: grupos("cnpjTransportador"), clientes: grupos("cnpjCliente"),
    itinerarios: [...new Set(d.ctes.map(c => c.itinerario).filter(Boolean))].sort().map(i => [i, i]),
    meses,
    produtos: d.produtos.filter(p => d.ctes.some(c => c.produto === p.id)).map(p => [p.id, p.nome]),
  };
}

const TITULOS_EXC = {
  "preco-fora": ["R$/t fora da faixa da rota", "Acima de 3× ou abaixo de ⅓ da mediana da rota para o mesmo produto. Confira quantidade, unidade e frete no CT-e."],
  "a-classificar": ["CT-e a classificar", "Sem produto, unidade ou peso: fica fora do R$/t e conta só na tarifa. Classifique em Dados → Classificar CT-e."],
  "sem-cadastro": ["CNPJ sem nome no cadastro", "O painel mostra o CNPJ no lugar do nome. Cadastre o nome na aba Cadastro."],
  "diverge-planilha": ["Cálculo diferente da planilha", "Na importação, seguro, tarifa ou preço por saca não bateram com a conta. Vale o número da planilha."],
};

function excecoesHtml(d) {
  const ex = excecoes(d);
  if (!ex.length) return `<div class="card"><div class="limpo"><b>Nenhuma exceção</b><p>Todos os CT-e têm sacas, CNPJ cadastrado e preço dentro da faixa da rota.</p></div></div>`;
  const porTipo = Object.keys(TITULOS_EXC).map(t => [t, ex.filter(e => e.tipo === t)]).filter(([, l]) => l.length);
  return `<p class="hint">Todas entram nos totais do painel; ficam aqui para que a correção volte ao lançamento.</p>` + porTipo.map(([tipo, lista]) => {
    const [titulo, acao] = TITULOS_EXC[tipo];
    const linhas = lista.map(e => e.cte
      ? `<tr><td class="mono">${esc(e.cte.numero)}</td><td>${fmtData(e.cte.emissao)}</td><td>${esc(grupoDoCnpj(d, e.cte.cnpjTransportador).nome)}</td><td>${esc(rotaDe(e.cte))}</td><td>${esc(produtoDe(d, e.cte.produto)?.nome || "—")}</td><td class="num">${fmtMoeda(e.cte.precoTonelada)}</td></tr>`
      : `<tr><td class="mono" colspan="2">${fmtCnpj(e.cnpj)}</td><td colspan="4">${d.ctes.filter(c => c.cnpjTransportador === e.cnpj || c.cnpjCliente === e.cnpj).length} CT-e usam este CNPJ</td></tr>`);
    const cab = lista[0].cte ? `<tr><th>CT-e</th><th>Emissão</th><th>Transportador</th><th>Rota</th><th>Produto</th><th class="num">R$/t</th></tr>` : `<tr><th colspan="2">CNPJ</th><th colspan="4">Uso</th></tr>`;
    return `<div class="exc" data-tipo="${tipo}"><span class="pill">${lista.length} ${lista.length === 1 ? "registro" : "registros"}</span><h4>${esc(titulo)}</h4>
      <p class="exc-act">${esc(acao)}</p><div class="tabela"><table><thead>${cab}</thead><tbody>${linhas.slice(0, 20).join("")}</tbody>
      <tbody class="resto" hidden>${linhas.slice(20).join("")}</tbody></table></div>
      ${linhas.length > 20 ? `<div class="botoes"><button class="btn mini" type="button" data-ver-todas>Ver todas (${linhas.length})</button></div>` : ""}</div>`;
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
  const r = resumoGeral(ctes, metrica);
  const serie = serieMensal(d, ctes, metrica);
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
    ${misturados.length > 1 ? `<div class="exc" id="aviso-produtos"><span class="pill">Produtos misturados</span>
      <h4>Esta rota tem ${esc(misturados.map(p => produtoDe(d, p)?.nome || p).join(" e "))}</h4>
      <p class="exc-act">O frete de produtos diferentes tem preço diferente: escolha o produto no recorte para comparar transportadores.</p></div>` : ""}
    <div class="card">
      <div class="card-head"><div><h3>Evolução mensal</h3><p class="hint">Mediana do mês por transportador; o traço vertical vai do menor ao maior preço do mês (cortado na borda quando passa da escala). Passe o cursor para ver mínimo, máximo e número de CT-e.</p></div></div>
      <div class="grafico">${linhasMensais(serie, { formatar })}</div>
      <div class="legenda">${serie.series.slice(0, CORES_SERIES.length).map((s, i) =>
        `<span data-raiz="${esc(s.raiz)}"><i style="background:${CORES_SERIES[i]}"></i>${esc(s.nome)} · ${s.n}</span>`).join("")}
        ${serie.series.length > CORES_SERIES.length ? `<span><i style="background:var(--steel-l)"></i>outros ${serie.series.length - CORES_SERIES.length} em cinza</span>` : ""}</div>
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
  $$("[data-ver-todas]", raiz).forEach(b => b.addEventListener("click", () => {
    b.closest(".exc").querySelector("tbody.resto").hidden = false; b.remove();
  }));

  const graf = $(".grafico", raiz);
  graf.addEventListener("mousemove", ev => {
    const p = ev.target.closest("circle.ponto");
    if (!p) return dica(null);
    const ds = p.dataset;
    dica(`<b>${esc(ds.nome)}</b>${esc(fmtMesLongo(ds.mes))}<br>mediana ${formatar(+ds.mediana)}<br><span>${formatar(+ds.min)} a ${formatar(+ds.max)} · ${ds.n} CT-e</span>`, ev);
  });
  graf.addEventListener("mouseleave", () => dica(null));
  $$(".legenda [data-raiz]", raiz).forEach(l => {
    l.addEventListener("mouseenter", () => $$(".grupo-serie", graf).forEach(g => g.classList.toggle("apagado", g.dataset.raiz !== l.dataset.raiz)));
    l.addEventListener("mouseleave", () => $$(".grupo-serie", graf).forEach(g => g.classList.remove("apagado")));
  });
}
