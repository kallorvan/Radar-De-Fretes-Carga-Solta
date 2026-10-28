// Ponto de entrada do painel: carrega os dados da pasta, guarda o estado da página e troca de tela.

import { novaBase, migrarBase } from "./base.js";
import { novaSessao, sessaoVazia, juntar } from "./arquivo.js";
import { criarGravador, podeGravar, idbNavegador } from "./pasta.js";
import { lerHash, escreverHash } from "./hash.js";
import * as acoes from "./acoes.js";
import { fmtQuando, esc } from "./formato.js";
import { $, $$, aviso } from "./ui.js";
import { renderEvolucao } from "./telas/evolucao.js";
import { renderRotas } from "./telas/rotas.js";
import { renderLancamentos } from "./telas/lancamentos.js";
import { renderCadastro } from "./telas/cadastro.js";
import { renderDados } from "./telas/dados.js";

const TELAS = { evolucao: renderEvolucao, rotas: renderRotas, lancamentos: renderLancamentos, cadastro: renderCadastro, dados: renderDados };
const LS_QUEM = "radar-carga-solta:quem";

const lerLS = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* navegador sem armazenamento */ } };

const App = {
  dados: novaBase(),
  sessao: novaSessao(),
  aba: "evolucao",
  filtros: { metrica: "tonelada" },
  somenteLeitura: !podeGravar(),
  quem: lerLS(LS_QUEM),
  gravador: null,
  acoes,

  agora: () => new Date().toISOString(),

  /* Muda a aba e/ou os filtros e regrava o endereço. */
  irPara(aba = App.aba, filtros = App.filtros) {
    const h = escreverHash(aba, filtros);
    if (location.hash === h) App.render(); else location.hash = h;
  },
  mudarFiltros(parciais) {
    const f = { ...App.filtros, ...parciais };
    for (const k of Object.keys(f)) if (!f[k]) delete f[k];
    App.irPara(App.aba, f);
  },

  /* Toda alteração passa aqui: exige o nome, aplica, redesenha e agenda a gravação. */
  async alterar(fn) {
    if (App.somenteLeitura) { aviso("Este painel está aberto só para consulta.", true); return null; }
    if (!App.quem && !(await App.pedirNome())) return null;
    const r = fn(App.dados, App.sessao, App.quem, App.agora());
    if (r === undefined || r?.ok !== false) { App.gravador.marcarAlterado(); App.render(); pintarEstado(); }
    return r;
  },

  pedirNome() {
    const dlg = $("#dlg-nome"), inp = dlg.querySelector("input");
    inp.value = App.quem;
    return new Promise(ok => {
      dlg.addEventListener("close", () => {
        const nome = inp.value.trim();
        if (dlg.returnValue === "ok" && nome) { App.quem = nome; gravarLS(LS_QUEM, nome); pintarEstado(); ok(true); } else ok(false);
      }, { once: true });
      dlg.returnValue = "";
      dlg.showModal();
    });
  },

  render() {
    $$("#abas button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.aba === App.aba)));
    TELAS[App.aba]($("#conteudo"), App);
  },
};
window.RADAR_APP = App;   // para depuração no console

const ROTULO = {
  "somente-leitura": "Somente consulta", desconectado: "Pasta não conectada", salvo: "Tudo salvo",
  pendente: "Alterações pendentes", salvando: "Gravando", conflito: "Outra pessoa gravou", erro: "Não gravado",
};

function pintarEstado() {
  const g = App.gravador, estado = App.somenteLeitura ? "somente-leitura" : g.estado;
  const msg = App.somenteLeitura
    ? (location.protocol === "file:" ? "Este navegador não grava na pasta. Abra pelo Chrome ou Edge para lançar." : "Aberto por link: só consulta. Para lançar, abra o HTML pela pasta compartilhada no Chrome ou Edge.")
    : g.mensagem || (App.dados.salvoEm ? `Última gravação ${fmtQuando(App.dados.salvoEm)}${App.dados.salvoPor ? " por " + App.dados.salvoPor : ""}.` : "Base ainda não gravada na pasta.");
  $("#estado-gravacao").innerHTML =
    `<span class="perlab"><i class="marca ${estado}"></i>${esc(ROTULO[estado] || estado)}</span><span class="msg">${esc(msg)}</span>` +
    (!App.somenteLeitura && !g.pasta ? `<button class="btn mini" type="button" data-acao="conectar">Conectar a pasta</button>` : "") +
    (!App.somenteLeitura && g.pasta && estado !== "salvo" && estado !== "conflito" ? `<button class="btn mini" type="button" data-acao="salvar">Salvar agora</button>` : "") +
    `<span class="quem">${App.quem ? `Lançando como <b>${esc(App.quem)}</b> ` : ""}<button class="btn mini" type="button" data-acao="nome">${App.quem ? "Trocar" : "Informar nome"}</button></span>`;
  const fixo = $("#aviso-fixo");
  if (!App.somenteLeitura && (estado === "erro" || estado === "conflito")) {
    fixo.hidden = false;
    fixo.className = "aviso-fixo" + (estado === "conflito" ? " conflito" : "");
    fixo.innerHTML = `<div class="wrap"><span><b>${estado === "conflito" ? "Outra pessoa gravou na pasta." : "Não gravado na pasta."}</b> ${esc(g.mensagem)}</span>` +
      (estado === "conflito" ? `<button class="btn primario" type="button" data-acao="juntar">Juntar e salvar</button>` : `<button class="btn" type="button" data-acao="salvar">Tentar de novo</button>`) + `</div>`;
  } else fixo.hidden = true;
  document.body.classList.toggle("somente-leitura", App.somenteLeitura);
}

async function acaoGravacao(acao) {
  const g = App.gravador;
  if (acao === "nome") return App.pedirNome();
  if (acao === "conectar") { App.irPara("dados"); return; }
  if (acao === "salvar") { const r = await g.gravarNaFila({ manual: true }); if (r?.ok) aviso("Salvo na pasta."); return; }
  if (acao === "juntar") { const r = await g.gravarNaFila({ manual: true, juntar: true }); if (r?.ok) aviso("Juntado com o que estava na pasta e salvo."); }
}

async function iniciar() {
  // base gravada por um painel antigo (v1) é atualizada aqui; a pasta só recebe a v2 na próxima gravação
  const arquivo = window.RADAR_CS ? migrarBase({ versao: 1, cnpjs: [], lixeira: [], log: [], ...window.RADAR_CS }) : novaBase();
  App.dados = arquivo;
  App.gravador = criarGravador({
    obterTela: () => App.dados, obterSessao: () => App.sessao, obterQuem: () => App.quem || "sem nome",
    aoSalvar: d => { if (d) App.dados = d; App.render(); },
    aoMudar: pintarEstado,
    idb: App.somenteLeitura ? null : idbNavegador(),
  });
  if (!App.somenteLeitura) {
    // o que ficou sem gravar da última vez volta, por cima do arquivo atual
    const pend = await App.gravador.restaurarPendentes();
    if (pend && !sessaoVazia(pend.sessao)) {
      App.dados = pend.tela.salvoEm === arquivo.salvoEm ? pend.tela : juntar(arquivo, pend.tela, pend.sessao);
      App.sessao = pend.sessao;
    }
    await App.gravador.reconectar();
    if (!sessaoVazia(App.sessao)) App.gravador.marcarAlterado();
  }
  App.gravador.baseSalvoEm = arquivo.salvoEm ?? null;

  $("#abas").addEventListener("click", ev => {
    const b = ev.target.closest("button[data-aba]");
    if (b) App.irPara(b.dataset.aba, App.filtros);
  });
  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-acao]");
    if (b && (b.closest("#estado-gravacao") || b.closest("#aviso-fixo"))) acaoGravacao(b.dataset.acao);
  });
  const topo = $("#topo");
  const mede = () => document.documentElement.style.setProperty("--stickyh", topo.offsetHeight + "px");
  addEventListener("scroll", () => topo.classList.toggle("scrolled", scrollY > 8), { passive: true });
  addEventListener("resize", mede); mede();
  addEventListener("hashchange", () => { ({ aba: App.aba, filtros: App.filtros } = lerHash(location.hash)); App.render(); });
  ({ aba: App.aba, filtros: App.filtros } = lerHash(location.hash));
  pintarEstado();
  App.render();
}

iniciar();
