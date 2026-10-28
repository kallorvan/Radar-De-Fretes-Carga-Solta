/* Trecho de referência do Radar de Fretes Tóliman (linhas 3722-4036 da versão 1790361171-5068).
   Só para consulta: mecanismo de gravação em pasta. Não é carregado pelo painel. */
/* ═══════════════ gravar na pasta compartilhada ═══════════════
   Código e dados moram em arquivos separados na mesma pasta:

     Radar de Fretes Toliman.html   → só o código. Versão nova = trocar este.
     radar-dados.js                 → só os dados. É o que o Salvar grava.
     backups/                       → cópia do radar-dados.js ANTERIOR a cada
                                      gravação (as 60 mais recentes).

   Com isso, trocar a versão do painel nunca mexe nos lançamentos: não existe
   mais ordem certa de passos para não perder dados.

   Como funciona: o navegador (Chrome ou Edge) dá acesso de escrita a uma
   pasta que a pessoa escolhe, uma vez. O Salvar lê o radar-dados.js da pasta,
   confere se alguém gravou por cima desde que esta página abriu (a TRAVA),
   guarda uma cópia dele em backups/ e só então grava o novo.

   A trava compara o carimbo "salvoEm" do arquivo com o que esta página
   carregou. Se forem diferentes, alguém salvou no meio do caminho: em vez de
   sobrescrever, o painel oferece JUNTAR — parte do que está no arquivo e
   aplica por cima só o que foi mudado NESTA página (lançamentos e correções
   não salvos, exclusões, CNPJ cadastrados, importações). O resto vem do
   arquivo, inclusive o que a outra pessoa lançou, corrigiu ou excluiu.

   Enquanto não salva, o lançamento fica no navegador de quem lançou e
   aparece marcado como NÃO SALVO — ninguém mais o vê. */

const NO_ARQUIVO = location.protocol === "file:";
const ARQ_DADOS = "radar-dados.js", PASTA_BKP = "backups", MAX_BKP = 60;
const MARCA_JS = "window.__DADOS__=";
let PASTA = null;                          // handle da pasta conectada
// carimbo da gravação que esta página carregou; é contra ele que a trava compara
let BASE_SALVOEM = D.salvoEm || null;
/* O que esta página mudou desde a última gravação — é o que vai por cima do
   arquivo quando for preciso juntar. Os lançamentos e correções não salvos já
   estão marcados como `pendente` nas próprias linhas. */
const SESSAO = { excluidas: new Set(), cadastro: new Map(), importouBase: false, importouTarifa: false };
function zerarSessao() {
  SESSAO.excluidas.clear(); SESSAO.cadastro.clear();
  SESSAO.importouBase = false; SESSAO.importouTarifa = false;
}
/* O registro dos lançamentos é o arquivo: toda mudança — lançar, excluir,
   cadastrar CNPJ — fica só na tela até alguém salvar. Sem esta marca, uma
   exclusão se perderia em silêncio ao fechar a aba. */
let SUJO = false;
function marcarSujo() { SUJO = true; pintarArquivo(); agendarAuto(); }

function idbArq(modo, fn) {
  return new Promise((ok, err) => {
    let req;
    try { req = indexedDB.open("radar-fretes", 1); } catch (e) { return err(e); }
    req.onupgradeneeded = () => req.result.createObjectStore("arq");
    req.onerror = () => err(req.error);
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction("arq", modo);
        const r = fn(tx.objectStore("arq"));
        r.onsuccess = () => ok(r.result);
        r.onerror = () => err(r.error);
      } catch (e) { err(e); }
    };
  });
}
// chave nova ("pasta"): o handle de ARQUIVO da versão antiga não serve mais
const guardarHandle = h => idbArq("readwrite", st => st.put(h, "pasta")).catch(() => null);
const lerHandle = () => idbArq("readonly", st => st.get("pasta")).catch(() => null);

/* Texto do radar-dados.js ↔ objeto de dados.
   O JSON sai com "</" escapado: o mesmo arquivo pode ser embutido numa página
   sem que um texto do usuário feche o bloco de script. `pendente` é estado
   deste navegador e nunca vai para o arquivo. */
function lerDadosJs(texto) {
  const i = texto.indexOf(MARCA_JS);
  if (i < 0) return null;
  const corpo = texto.slice(i + MARCA_JS.length).trim().replace(/;\s*$/, "");
  try { const d = JSON.parse(corpo); return d && Array.isArray(d.ctes) ? d : null; }
  catch (e) { return null; }
}
function montarDadosJs(dados) {
  const json = JSON.stringify(dados, (k, v) => k === "pendente" ? undefined : v).split("</").join("<\\/");
  return "/* Radar de Fretes Tóliman — arquivo de dados (CT-e, cadastro e tarifário).\n" +
    "   Fica na MESMA PASTA do HTML do painel. Não edite à mão: lance e salve pelo painel.\n" +
    "   Gravado em " + dados.salvoEm + " */\n" + MARCA_JS + json + ";\n";
}

const dois = n => String(n).padStart(2, "0");
function quandoLocal(iso) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return "";
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}
function nomeBackup(iso) {
  const d = iso && !isNaN(new Date(iso)) ? new Date(iso) : new Date();
  return `radar-dados ${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ` +
    `${dois(d.getHours())}h${dois(d.getMinutes())}m${dois(d.getSeconds())}.js`;
}

function pintarArquivo() {
  const st = $("#arq-estado"); if (!st) return;
  const pend = D.ctes.filter(c => c.pendente).length;
  const q = $("#arq-quando");
  if (q) q.textContent = D.salvoEm ? "última gravação: " + quandoLocal(D.salvoEm) : "";
  if (!NO_ARQUIVO) {
    st.textContent = "Esta cópia está aberta pelo link, não pela pasta — aqui o lançamento fica só neste navegador.";
    $("#arq-conectar").hidden = true; $("#arq-salvar").hidden = true;
    return;
  }
  if (!window.showDirectoryPicker) {
    st.textContent = "Gravar na pasta pede Chrome ou Edge. Neste navegador o lançamento fica só aqui — exporte o CSV.";
    $("#arq-conectar").hidden = true; $("#arq-salvar").hidden = true;
    return;
  }
  $("#arq-conectar").hidden = false;
  $("#arq-salvar").hidden = !PASTA;
  $("#arq-conectar").textContent = PASTA ? "Trocar pasta" : "Conectar a pasta";
  const aviso = SUJO
    ? ` · <b style="color:var(--bad)">alterações não salvas</b>` + (pend ? ` (${pend} lançamento${pend === 1 ? "" : "s"})` : "")
    : " · tudo salvo";
  const ca = $("#arq-auto"); if (ca) { ca.checked = AUTO; ca.closest("label").hidden = false; }
  st.innerHTML = PASTA
    ? `Conectado à pasta <b>${esc(PASTA.name)}</b> — ` +
      (AUTO ? `cada lançamento, correção, exclusão ou cadastro é salvo sozinho em ${ARQ_DADOS}` : `o Salvar grava em ${ARQ_DADOS}`) +
      ` e a versão anterior fica em ${PASTA_BKP}/` + aviso
    : "Conecte uma vez a pasta compartilhada onde estão o painel e o radar-dados.js; a partir daí cada lançamento é salvo sozinho, e quem abrir a pasta vê o que você lançou." +
      (SUJO ? " <b style=\"color:var(--bad)\">Há alterações não salvas.</b>" : "");
}
const esc = t => String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

async function conectarPasta() {
  try {
    const p = await window.showDirectoryPicker({ id: "radar-fretes", mode: "readwrite" });
    let fh;
    try { fh = await p.getFileHandle(ARQ_DADOS); }
    catch (e) {
      say("#st-arq", `Essa pasta não tem o ${ARQ_DADOS}. Escolha a pasta onde estão o painel e o ${ARQ_DADOS}.`, false);
      return false;
    }
    if (!lerDadosJs(await (await fh.getFile()).text())) {
      say("#st-arq", `O ${ARQ_DADOS} dessa pasta não é do Radar de Fretes (ou está danificado). Nada foi conectado.`, false);
      return false;
    }
    PASTA = p; await guardarHandle(p);
    pintarArquivo();
    if (SUJO) setTimeout(agendarAuto, 0);
    say("#st-arq", `Conectado à pasta ${p.name}. A partir de agora, Salvar grava lá.`, true);
    return true;
  } catch (e) {
    if (e && e.name === "AbortError") return false;
    say("#st-arq", "Não foi possível abrir a pasta: " + (e.message || e.name), false);
    return false;
  }
}

/* Parte do arquivo e aplica por cima só o que esta página mudou. */
function juntarComArquivo(F) {
  const pend = D.ctes.filter(c => c.pendente);
  let base;
  if (SESSAO.importouBase) {
    // importou a planilha aqui: a planilha é a base, e do arquivo vêm só os
    // lançamentos do formulário que ela não traz (mesma regra da importação)
    const minhas = D.ctes.filter(c => !c.pendente);
    const tem = new Set(minhas.map(c => c.chave));
    base = minhas.concat(F.ctes.filter(c => c.manual && !tem.has(c.chave) && !SESSAO.excluidas.has(c.chave)));
  } else {
    base = F.ctes.filter(c => !SESSAO.excluidas.has(c.chave));
  }
  const sai = new Set();
  pend.forEach(p => { sai.add(p.chave); if (p.chaveOriginal) sai.add(p.chaveOriginal); });
  D.ctes = base.filter(c => !sai.has(c.chave)).concat(pend);

  const cad = new Map((F.cadastro || []).map(c => [c.cnpj, c.nome]));
  // valor null = CNPJ excluído nesta página
  for (const [k, v] of SESSAO.cadastro) { if (v == null) cad.delete(k); else cad.set(k, v); }
  D.cadastro = [...cad].map(([cnpj, nome]) => ({ cnpj, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  CAD.clear(); for (const c of D.cadastro) CAD.set(c.cnpj, c.nome);

  if (!SESSAO.importouTarifa && F.tarifario && F.tabelas) {
    D.tarifario = F.tarifario; D.tabelas = F.tabelas;
  }
  if (F.params) D.params = F.params;
  reindex(); rebuildDePara(); buildFilters(); fillRotaSel(); fmDatalists();
}

/* Diz, em números, o que mudou no arquivo desde que esta página abriu. */
function resumoConflito(F) {
  const tela = new Set(D.ctes.map(c => c.chave));
  D.ctes.forEach(c => { if (c.pendente && c.chaveOriginal) tela.add(c.chaveOriginal); });
  const arq = new Set(F.ctes.map(c => c.chave));
  const entram = [...arq].filter(k => !tela.has(k) && !SESSAO.excluidas.has(k)).length;
  const saem = D.ctes.filter(c => !c.pendente && !arq.has(c.chave)).length;
  const telaPorChave = new Map(D.ctes.map(c => [c.chave, c]));
  const mudaram = F.ctes.filter(c => {
    const t = telaPorChave.get(c.chave);
    const norm = o => JSON.stringify(o, Object.keys(o).filter(k => k !== "pendente").sort());
    return t && !t.pendente && norm(t) !== norm(c);
  }).length;
  const minhas = D.ctes.filter(c => c.pendente).length + SESSAO.excluidas.size + SESSAO.cadastro.size;
  const quem = F.salvoEm ? `em ${quandoLocal(F.salvoEm)}` : "sem carimbo de data";
  const partes = [];
  if (entram) partes.push(`${entram} CT-e que você não tem na tela`);
  if (mudaram) partes.push(`${mudaram} CT-e alterado${mudaram === 1 ? "" : "s"}`);
  if (saem) partes.push(`${saem} CT-e a menos`);
  return `O ${ARQ_DADOS} foi gravado ${quem}, depois que esta página abriu` +
    (partes.length ? ` — ele tem ${partes.join(", ")}.` : ".") +
    ` <b style="display:inline;color:var(--ink);font-family:inherit;font-size:inherit;margin:0">Juntar e salvar</b> usa o arquivo como base e aplica por cima só o que você mudou nesta página` +
    (minhas ? ` (${minhas} alteraç${minhas === 1 ? "ão" : "ões"})` : "") +
    `; o arquivo anterior fica guardado em ${PASTA_BKP}/. Se preferir conferir antes, cancele e atualize a página (F5) — o que você lançou e não salvou continua guardado neste navegador.`;
}

async function guardarBackup(texto, salvoEmAnterior) {
  const dir = await PASTA.getDirectoryHandle(PASTA_BKP, { create: true });
  const nome = nomeBackup(salvoEmAnterior);
  let existe = true;
  try { await dir.getFileHandle(nome); } catch (e) { existe = false; }
  if (!existe) {                            // mesmo carimbo = mesmo conteúdo já guardado
    const w = await (await dir.getFileHandle(nome, { create: true })).createWritable();
    await w.write(texto); await w.close();
  }
  // poda: fica com as MAX_BKP mais recentes (o nome ordena pela data)
  const nomes = [];
  for await (const [n, hd] of dir.entries())
    if (hd.kind === "file" && /^radar-dados \d{4}-\d{2}-\d{2} .*\.js$/.test(n)) nomes.push(n);
  nomes.sort();
  for (const n of nomes.slice(0, Math.max(0, nomes.length - MAX_BKP)))
    await dir.removeEntry(n).catch(() => {});
  return nome;
}

/* Resultado de uma gravação: { ok, msg, conflito? } — o aviso do lançamento
   e o salvamento automático dizem ao usuário o que aconteceu de fato. */
function falhou(msg, auto) {
  say("#st-arq", msg, false);
  if (auto) toast("Não salvo na pasta: " + msg, false);
  return { ok: false, msg };
}
async function salvarNaPasta(juntar, auto) {
  $("#arq-conflito").hidden = true;
  if (!PASTA) {
    if (auto) return { ok: false, msg: "a pasta compartilhada não está conectada" };
    if (!(await conectarPasta())) return { ok: false, msg: "a pasta não foi conectada" };
  }
  try {
    let p = await PASTA.queryPermission({ mode: "readwrite" });
    if (p !== "granted") p = await PASTA.requestPermission({ mode: "readwrite" });
    if (p !== "granted") return falhou("o navegador não liberou a gravação na pasta.", auto);

    let fh;
    try { fh = await PASTA.getFileHandle(ARQ_DADOS); }
    catch (e) { return falhou(`o ${ARQ_DADOS} não está mais na pasta ${PASTA.name}. Nada foi gravado — confira a pasta ou use Trocar pasta.`, auto); }
    const texto = await (await fh.getFile()).text();
    const F = lerDadosJs(texto);
    if (!F) return falhou(`o ${ARQ_DADOS} da pasta está ilegível. Nada foi gravado — restaure a cópia mais recente de ${PASTA_BKP}/.`, auto);

    // a TRAVA: alguém gravou depois que esta página abriu?
    const conflito = (F.salvoEm || null) !== (BASE_SALVOEM || null);
    if (conflito && !juntar) {
      $("#arq-conflito-txt").innerHTML = resumoConflito(F);
      $("#arq-conflito").hidden = false;
      $("#st-arq").className = "status";
      const msg = "outra pessoa gravou na pasta depois que você abriu o painel. Use Juntar e salvar, no quadro Gravar na pasta compartilhada (aba Base concorrentes).";
      if (auto) toast("Não salvo: " + msg, false);
      return { ok: false, conflito: true, msg };
    }
    if (conflito) juntarComArquivo(F);

    const bkp = await guardarBackup(texto, F.salvoEm);
    D.salvoEm = new Date().toISOString();
    const w = await fh.createWritable();
    await w.write(montarDadosJs(D)); await w.close();

    // o que estava só no navegador agora está no arquivo
    BASE_SALVOEM = D.salvoEm;
    gravarLancamentos([]);
    D.ctes.forEach(c => { if (c.pendente) delete c.pendente; });
    zerarSessao();
    SUJO = false;
    renderAll(); atualizarLanc(); pintarArquivo();
    const n = D.ctes.filter(c => c.manual).length;
    say("#st-arq", (conflito ? "Juntado com o que estava no arquivo e gravado" : auto ? "Salvo automaticamente" : "Gravado") +
      ` em ${ARQ_DADOS} às ${quandoLocal(D.salvoEm).slice(11)} · ${D.ctes.length} CT-e (${n} lançados no painel) e ${D.cadastro.length} CNPJ no cadastro.` +
      ` Versão anterior guardada em ${PASTA_BKP}/${bkp}. Quem abrir a pasta já vê.`, true);
    if (auto) toast(`Salvo na pasta às ${quandoLocal(D.salvoEm).slice(11)}`, true);
    return { ok: true, msg: `salvo na pasta às ${quandoLocal(D.salvoEm).slice(11)}` };
  } catch (e) {
    return falhou("não foi possível gravar (" + (e.message || e.name) + "). Se o arquivo estiver aberto por outra pessoa, tente de novo em instantes.", auto);
  }
}

/* ── salvamento automático ──
   Lançar, corrigir, excluir e cadastrar CNPJ gravam sozinhos na pasta, sem
   precisar do botão Salvar. As gravações vão numa fila: duas ações seguidas
   nunca escrevem o arquivo ao mesmo tempo. Precisa da pasta conectada; o
   navegador pede a permissão de escrita uma vez por sessão. */
const LS_AUTO = "radar-fretes:auto-salvar";
let AUTO = (() => { try { return localStorage.getItem(LS_AUTO) !== "0"; } catch (e) { return true; } })();
let FILA = Promise.resolve(null);
function agendarAuto() {
  if (!AUTO || !NO_ARQUIVO || !PASTA || !window.showDirectoryPicker) return null;
  FILA = FILA.catch(() => null).then(() => SUJO ? salvarNaPasta(false, true) : { ok: true, msg: "já estava salvo" });
  return FILA;
}
const autoLigado = () => Boolean(AUTO && NO_ARQUIVO && PASTA && window.showDirectoryPicker);

/* aviso flutuante, no canto da tela: a gravação acontece longe de onde a
   pessoa está olhando */
let toastT;
function toast(msg, ok) {
  let t = $("#toast");
  if (!t) { t = el("div", "toast"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.className = "toast on " + (ok ? "ok" : "err");
  t.textContent = (ok ? "✓ " : "⚠ ") + msg;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = "toast " + (ok ? "ok" : "err"); }, ok ? 3500 : 9000);
}

