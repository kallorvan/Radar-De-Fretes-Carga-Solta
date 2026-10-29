// Dados: a pasta compartilhada, exportar para Excel, data de corte, classificação, lixeira, histórico e o nome de quem lança.

import { exportarXlsx } from "../importacao.js";
import { ARQ_DADOS, PASTA_BKP, sessaoVazia } from "../arquivo.js";
import { grupoDoCnpj, unidadeDe } from "../base.js";
import { rotaDe, calcularCte, numeroBR } from "../calculos.js";
import { sugerirClassificacao, pendentesDeClassificacao } from "../classificacao.js";
import { esc, fmtData, fmtNum, fmtMoeda, fmtQuando } from "../formato.js";
import { $, $$, secHead, tabelaOrdenavel, confirmar, aviso } from "../ui.js";

// escolhas: o que a pessoa ajustou em cada linha da classificação, guardado entre redesenhos
const estado = { escolhas: new Map() };
const ACAO = { incluir: "Lançou", corrigir: "Corrigiu", excluir: "Excluiu", restaurar: "Restaurou", "tirar-lixeira": "Tirou da lixeira", importar: "Importou", cadastro: "Cadastro",
  classificar: "Classificou", produto: "Produto", unidade: "Unidade", corte: "Data de corte" };

/* Linha da classificação: a sugestão da regra, com o que a pessoa trocou por cima. */
function escolhaDe(d, cte) {
  // linha que a pessoa ainda não mexeu segue a sugestão atual (o produto padrão pode ter mudado no Cadastro)
  if (!estado.escolhas.get(cte.chave)?.tocada) {
    const s = sugerirClassificacao(d, cte);
    estado.escolhas.set(cte.chave, { produto: s.produto || "", unidade: s.unidade || "", peso: "", marcado: Boolean(s.produto && s.unidade), motivo: s.motivo });
  }
  const e = estado.escolhas.get(cte.chave), u = unidadeDe(d, e.unidade), peso = numeroBR(e.peso);
  const calc = u ? calcularCte({ ...cte, unidade: u, pesoKg: peso, pesoInformado: peso > 0 || !(u.kg > 0) }) : { pesoKg: null, precoTonelada: null };
  return { ...e, calc };
}

const opc = (lista, atual) => `<option value="">—</option>` + lista.map(x => `<option value="${esc(x.id)}"${x.id === atual ? " selected" : ""}>${esc(x.nome)}</option>`).join("");

function classificarHtml(App) {
  const d = App.dados, pend = pendentesDeClassificacao(d);
  if (!pend.length) return `<div class="limpo"><b>Tudo classificado</b><p>Todos os CT-e têm produto e unidade.</p></div>`;
  const linhas = pend.map(c => {
    const e = escolhaDe(d, c), k = esc(c.chave);
    return `<tr data-chave="${k}"><td><input type="checkbox" data-marcar="${k}" ${e.marcado ? "checked" : ""} aria-label="Aplicar ao CT-e ${esc(c.numero)}" data-escreve></td>
      <td class="mono">${esc(c.numero)}<span class="sub">${fmtData(c.emissao)}</span></td>
      <td>${esc(grupoDoCnpj(d, c.cnpjCliente).nome)}<span class="sub">${esc(rotaDe(c))}</span></td>
      <td class="num">${fmtNum(c.quantidade, Number.isInteger(c.quantidade) ? 0 : 2)}</td>
      <td><select data-produto="${k}" aria-label="Produto">${opc(d.produtos, e.produto)}</select></td>
      <td><select data-unidade="${k}" aria-label="Unidade">${opc(d.unidades, e.unidade)}</select></td>
      <td class="num"><input class="kg-lista" data-peso="${k}" value="${esc(e.peso)}" placeholder="${e.calc.pesoKg != null ? fmtNum(e.calc.pesoKg) : "peso do CT-e"}" inputmode="decimal" aria-label="Peso total (kg)"></td>
      <td class="num">${fmtMoeda(e.calc.precoTonelada)}</td>
      <td><span class="sub">${esc(e.motivo)}</span></td></tr>`;
  }).join("");
  const marcados = pend.filter(c => estado.escolhas.get(c.chave)?.marcado).length;
  return `<p class="hint">${fmtNum(pend.length)} CT-e sem produto ou unidade. A sugestão vem do produto padrão do cliente e da quantidade (até 100 = toneladas; acima, sacas). Confira, troque o que precisar e aplique.</p>
    <div class="tabela"><table><thead><tr><th></th><th>CT-e</th><th>Cliente · rota</th><th class="num">Quantidade</th><th>Produto</th><th>Unidade</th><th class="num">Peso (kg)</th><th class="num">R$/t</th><th>Por quê</th></tr></thead>
    <tbody>${linhas}</tbody></table></div>
    <div class="botoes" data-escreve><button class="btn" type="button" data-marcar-todos>Marcar todos com sugestão</button>
      <button class="btn primario" type="button" id="aplicar-classificacao" ${marcados ? "" : "disabled"}>Aplicar marcados (${fmtNum(marcados)})</button></div>`;
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
    <div class="card"><h3>Exportar para Excel</h3><p class="hint">A base inteira no mesmo layout da planilha: ${fmtNum(d.ctes.length)} CT-e e ${fmtNum(d.cnpjs.length)} CNPJ.</p>
      <button class="btn" type="button" data-exportar ${d.ctes.length ? "" : "disabled"}>Baixar .xlsx</button></div>
    <div class="card" data-escreve><h3>Data de corte</h3><p class="hint">CT-e emitidos antes desta data ficam na base, mas fora da Evolução, das Rotas, das exceções e da classificação. Vazio = todos entram.</p>
      <div class="form-linha"><label class="campo"><span>Data de corte</span><input id="corte" type="date" value="${esc(d.corte || "")}"></label>
        <button class="btn primario" type="button" data-salvar-corte>Salvar data de corte</button></div></div>
    <div class="card" id="classificar"><h3>Classificar CT-e</h3>${classificarHtml(App)}</div>
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
  const secao = raiz.firstElementChild;
  const repintar = () => { $("#classificar", raiz).innerHTML = `<h3>Classificar CT-e</h3>${classificarHtml(App)}`; };
  secao.addEventListener("change", ev => {
    const t = ev.target, k = t.dataset.produto || t.dataset.unidade || t.dataset.peso || t.dataset.marcar;
    if (!k || !t.closest("#classificar")) return;
    const e = estado.escolhas.get(k);
    if (t.dataset.produto !== undefined) e.produto = t.value;
    else if (t.dataset.unidade !== undefined) e.unidade = t.value;
    else if (t.dataset.peso !== undefined) e.peso = t.value;
    else e.marcado = t.checked;
    e.tocada = true;
    if (t.dataset.marcar === undefined) e.marcado = Boolean(e.produto && e.unidade);
    repintar();
  });
  secao.addEventListener("click", async ev => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-marcar-todos")) {
      for (const c of pendentesDeClassificacao(d)) { const e = estado.escolhas.get(c.chave); if (e) e.marcado = Boolean(e.produto && e.unidade); }
      return repintar();
    }
    if (b.id === "aplicar-classificacao") {
      const alvo = pendentesDeClassificacao(d).filter(c => estado.escolhas.get(c.chave)?.marcado);
      const r = await App.alterar((dd, s, quem, agora) => {
        let feitos = 0; const falhas = [];
        for (const c of alvo) {
          const e = estado.escolhas.get(c.chave), peso = numeroBR(e.peso);
          const res = App.acoes.classificar(dd, s, c.chave, { produto: e.produto, unidade: e.unidade, pesoKg: peso, pesoInformado: peso > 0 }, quem, agora);
          if (res.ok) { feitos++; estado.escolhas.delete(c.chave); } else falhas.push(`${c.numero}: ${Object.values(res.erros).join(" ")}`);
        }
        return { ok: feitos > 0, feitos, falhas };
      });
      if (r) aviso(`${r.feitos} CT-e classificados.` + (r.falhas.length ? ` Não classificados: ${r.falhas.join("; ")}` : ""), r.falhas.length > 0);
      return;
    }
    if (b.dataset.restaurar) {
      const r = await App.alterar((dd, s, quem, agora) => App.acoes.restaurar(dd, s, b.dataset.restaurar, quem, agora));
      if (r?.ok) aviso(`CT-e ${r.cte.numero} restaurado.`);
    } else if (b.hasAttribute("data-salvar-corte")) {
      const r = await App.alterar((dd, s, quem, agora) => App.acoes.definirCorte(dd, s, $("#corte", raiz).value, quem, agora));
      if (r?.ok && !r.mudou) aviso("A data de corte já era essa.");
      else if (r?.ok) aviso(r.corte ? `Data de corte: ${fmtData(r.corte)}.` : "Sem data de corte: todos os CT-e entram na análise.");
      else if (r) aviso("Data inválida.", true);
    } else if (b.hasAttribute("data-nome")) { await App.pedirNome(); App.render(); }
    else if (b.hasAttribute("data-salvar")) { const r = await g.gravarNaFila({ manual: true }); if (r?.ok) aviso("Salvo na pasta."); App.render(); }
    else if (b.hasAttribute("data-exportar")) {
      if (!window.XLSX) return aviso("A biblioteca de planilhas não carregou (precisa de internet). Tente de novo em instantes.", true);
      const blob = new Blob([exportarXlsx(d, window.XLSX)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `radar-carga-solta ${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else if (b.hasAttribute("data-conectar")) await conectar(App);
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
