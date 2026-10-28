// Dados: a pasta compartilhada, importar a planilha, exportar para Excel, lixeira, histórico e o nome de quem lança.

import { lerPlanilha, exportarXlsx } from "../importacao.js";
import { ARQ_DADOS, PASTA_BKP, sessaoVazia } from "../arquivo.js";
import { grupoDoCnpj } from "../base.js";
import { rotaDe } from "../calculos.js";
import { esc, fmtData, fmtNum, fmtQuando } from "../formato.js";
import { $, secHead, tabelaOrdenavel, confirmar, aviso } from "../ui.js";

const estado = { resumo: null, erroImp: "" };
const ACAO = { incluir: "Lançou", corrigir: "Corrigiu", excluir: "Excluiu", restaurar: "Restaurou", importar: "Importou", cadastro: "Cadastro" };

function resumoHtml() {
  if (estado.erroImp) return `<div class="exc"><span class="pill">Não importado</span><h4>${esc(estado.erroImp)}</h4></div>`;
  const r = estado.resumo;
  if (!r) return "";
  return `<div class="resumo-imp"><p><b>${fmtNum(r.incluidos)}</b> CT-e incluídos · <b>${fmtNum(r.pulados)}</b> já existiam e ficaram como estavam ·
    <b>${fmtNum(r.rejeitados.length)}</b> rejeitados · <b>${fmtNum(r.cadastrados)}</b> CNPJ cadastrados${r.divergentes ? ` · <b>${fmtNum(r.divergentes)}</b> com cálculo diferente da planilha (veja Exceções a tratar)` : ""}.</p>
    ${r.rejeitados.length ? `<div class="tabela"><table><thead><tr><th>Linha da planilha</th><th>Motivo</th></tr></thead><tbody>${r.rejeitados.map(x =>
      `<tr><td class="mono">${x.numLinha}</td><td>${esc(x.motivo)}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>`;
}

export function renderDados(raiz, App) {
  const d = App.dados, g = App.gravador;
  const pasta = App.somenteLeitura
    ? `<p class="hint">Aberto só para consulta. A gravação na pasta funciona no Chrome ou no Edge, abrindo o HTML direto da pasta compartilhada.</p>`
    : `<p class="hint">${g.pasta ? `Conectado à pasta <b>${esc(g.pasta.name)}</b>. Cada alteração é gravada sozinha em ${ARQ_DADOS}; a versão anterior fica em ${PASTA_BKP}/ (as 60 últimas).`
        : `Conecte uma vez a pasta compartilhada onde estão este painel e o ${ARQ_DADOS}. A partir daí, cada lançamento é gravado sozinho e quem abrir a pasta vê.`}</p>
       <p class="hint">${d.salvoEm ? `Última gravação ${fmtQuando(d.salvoEm)}${d.salvoPor ? " por " + esc(d.salvoPor) : ""}.` : "Esta base ainda não foi gravada na pasta."}
        ${sessaoVazia(App.sessao) ? "" : " Há alterações desta página aguardando gravação."}</p>
       <div class="botoes" style="justify-content:flex-start"><button class="btn primario" type="button" data-conectar>${g.pasta ? "Trocar pasta" : "Conectar a pasta"}</button>
        ${g.pasta ? `<button class="btn" type="button" data-salvar>Salvar agora</button>` : ""}</div>`;

  raiz.innerHTML = `<section class="secao"><div class="wrap pilha">
    ${secHead("Dados", "Onde a base fica gravada, a importação do histórico e o registro de quem fez o quê.")}
    <div class="card"><h3>Pasta compartilhada</h3>${pasta}</div>
    <div class="cols2">
      <div class="card" data-escreve><h3>Importar planilha</h3><p class="hint">Lê as abas BASE CARGA SOLTA 2026 e BASE DE DADOS CNPJ da Radar_Fretes_Concorrentes (.xlsm ou .xlsx). CT-e já lançados ficam como estão.</p>
        <label class="btn" style="display:inline-block">Escolher planilha<input id="arq-planilha" type="file" accept=".xlsm,.xlsx" hidden></label>
        <div id="resumo-imp">${resumoHtml()}</div></div>
      <div class="card"><h3>Exportar para Excel</h3><p class="hint">A base inteira no mesmo layout da planilha: ${fmtNum(d.ctes.length)} CT-e e ${fmtNum(d.cnpjs.length)} CNPJ.</p>
        <button class="btn" type="button" data-exportar ${d.ctes.length ? "" : "disabled"}>Baixar .xlsx</button></div>
    </div>
    <div class="card"><h3>Lixeira</h3><p class="hint">CT-e excluídos. Restaurar devolve o lançamento para a base, com o registro de quem restaurou.</p><div id="tab-lixeira"></div></div>
    <div class="card"><h3>Histórico</h3><p class="hint">As ${fmtNum(d.log.length)} últimas ações (o painel guarda até 500), da mais recente para a mais antiga.</p><div id="tab-log"></div></div>
    <div class="card" data-escreve><h3>Seu nome</h3><p class="hint">${App.quem ? `Lançando como <b>${esc(App.quem)}</b>.` : "Nenhum nome informado neste navegador."}</p>
      <button class="btn" type="button" data-nome>${App.quem ? "Trocar nome" : "Informar nome"}</button></div>
  </div></section>`;

  tabelaOrdenavel($("#tab-lixeira", raiz), [
    { titulo: "CT-e", valor: l => l.cte.numero, html: l => `<span class="mono">${esc(l.cte.numero)}</span>` },
    { titulo: "Emissão", valor: l => l.cte.emissao, html: l => fmtData(l.cte.emissao) },
    { titulo: "Transportador", valor: l => grupoDoCnpj(d, l.cte.cnpjTransportador).nome, html: l => esc(grupoDoCnpj(d, l.cte.cnpjTransportador).nome) },
    { titulo: "Rota", valor: l => rotaDe(l.cte), html: l => esc(rotaDe(l.cte)) },
    { titulo: "Excluído por", valor: l => l.excluidoEm, html: l => `${esc(l.excluidoPor)}<span class="sub">${fmtQuando(l.excluidoEm)}</span>` },
    { titulo: "", valor: () => null, html: l => `<button class="btn mini" type="button" data-escreve data-restaurar="${l.cte.chave}">Restaurar</button>` },
  ], [...d.lixeira].reverse(), { vazia: "A lixeira está vazia." });
  tabelaOrdenavel($("#tab-log", raiz), [
    { titulo: "Quando", valor: l => l.quando, html: l => `<span class="mono">${fmtQuando(l.quando)}</span>` },
    { titulo: "Quem", valor: l => l.quem, html: l => esc(l.quem) },
    { titulo: "Ação", valor: l => l.acao, html: l => esc(ACAO[l.acao] || l.acao) },
    { titulo: "O quê", valor: l => l.resumo, html: l => esc(l.resumo) },
  ], [...d.log].reverse(), { vazia: "Nenhuma ação registrada ainda." });

  // ouvinte na seção recém-desenhada: o #conteudo é o mesmo em todo redesenho e acumularia ouvintes
  raiz.firstElementChild.addEventListener("click", async ev => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.restaurar) {
      const r = await App.alterar((dd, s, quem, agora) => App.acoes.restaurar(dd, s, b.dataset.restaurar, quem, agora));
      if (r?.ok) aviso(`CT-e ${r.cte.numero} restaurado.`);
    } else if (b.hasAttribute("data-nome")) { await App.pedirNome(); App.render(); }
    else if (b.hasAttribute("data-salvar")) { const r = await g.gravarNaFila({ manual: true }); if (r?.ok) aviso("Salvo na pasta."); App.render(); }
    else if (b.hasAttribute("data-exportar")) {
      if (!window.XLSX) return aviso("A biblioteca de planilhas não carregou (precisa de internet). Tente de novo em instantes.", true);
      const blob = new Blob([exportarXlsx(d, window.XLSX)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `radar-carga-solta ${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else if (b.hasAttribute("data-conectar")) await conectar(App);
  });
  $("#arq-planilha", raiz)?.addEventListener("change", async ev => {
    const arq = ev.target.files?.[0];
    if (!arq) return;
    estado.resumo = null; estado.erroImp = "";
    if (!window.XLSX) { estado.erroImp = "A biblioteca de planilhas não carregou (precisa de internet)."; return App.render(); }
    let lido;
    try { lido = lerPlanilha(window.XLSX, await arq.arrayBuffer()); } catch (e) { lido = { erro: "Não foi possível ler o arquivo como planilha do Excel." }; }
    if (lido.erro) { estado.erroImp = lido.erro; return App.render(); }
    const r = await App.alterar((dd, s, quem, agora) => App.acoes.importar(dd, s, lido, quem, agora));
    if (r) { estado.resumo = r; aviso(`${r.incluidos} CT-e importados.`); App.render(); }
  });
}

async function conectar(App) {
  const g = App.gravador;
  const r = await g.conectar();
  if (r.faltaArquivo) {
    if (await confirmar("Criar a base nesta pasta?", `A pasta ${r.handle.name} não tem o ${ARQ_DADOS}. O painel cria o arquivo com o que está na tela agora (${App.dados.ctes.length} CT-e). Use isto só na primeira instalação; se a base já existe, escolha a pasta onde ela está.`, "Criar a base")) {
      const c = await g.criarArquivoInicial(r.handle);
      if (c.ok) aviso("Base criada na pasta."); else aviso(c.msg, true);
    }
  } else if (r.ok) {
    // pasta com uma base mais nova que a desta página: sem alterações locais, a tela passa a mostrar a da pasta
    if (r.dados.salvoEm !== App.dados.salvoEm && sessaoVazia(App.sessao)) { App.dados = r.dados; g.baseSalvoEm = r.dados.salvoEm; }
    aviso(`Conectado à pasta ${g.pasta.name}.`);
    if (!sessaoVazia(App.sessao)) g.marcarAlterado();
  } else if (!r.cancelado) aviso(r.msg, true);
  App.render();
}
