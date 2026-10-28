// Gravação na pasta compartilhada (File System Access API, Chrome e Edge abrindo o HTML pela pasta).
// Antes de gravar, confere se outra pessoa gravou depois que esta página abriu (a trava por salvoEm);
// guarda a versão anterior em backups/ e grava em fila, uma escrita por vez.

import { ARQ_DADOS, PASTA_BKP, lerDadosJs, montarDadosJs, nomeBackup, podar, juntar, resumoConflito, sessaoVazia } from "./arquivo.js";

export const podeGravar = (env = globalThis) => env.location?.protocol === "file:" && typeof env.showDirectoryPicker === "function";

/* IndexedDB mínimo: guarda o handle da pasta e as alterações ainda não gravadas. */
export function idbNavegador(nome = "radar-carga-solta") {
  const abrir = () => new Promise((ok, err) => {
    const req = indexedDB.open(nome, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("arq");
    req.onerror = () => err(req.error);
    req.onsuccess = () => ok(req.result);
  });
  const op = (modo, fn) => abrir().then(db => new Promise((ok, err) => {
    const r = fn(db.transaction("arq", modo).objectStore("arq"));
    r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
  })).catch(() => undefined);
  return { get: k => op("readonly", st => st.get(k)), put: (k, v) => op("readwrite", st => st.put(v, k)), del: k => op("readwrite", st => st.delete(k)) };
}

const serSessao = s => ({ alterados: [...s.alterados], excluidos: [...s.excluidos], restaurados: [...s.restaurados], cadastro: [...s.cadastro], log: s.log });
const desSessao = s => ({ alterados: new Set(s.alterados), excluidos: new Set(s.excluidos), restaurados: new Set(s.restaurados), cadastro: new Map(s.cadastro), log: s.log });

export function criarGravador({ obterTela, obterSessao, obterQuem, aoSalvar, aoMudar = () => {}, idb, env = globalThis, atraso = 1000 }) {
  const g = {
    pasta: null,
    baseSalvoEm: obterTela().salvoEm ?? null,
    estado: "desconectado", mensagem: "",
  };
  let fila = Promise.resolve(), timer = null, esperaTimer = Promise.resolve();
  const muda = (estado, mensagem = "") => { g.estado = estado; g.mensagem = mensagem; aoMudar(g); };

  async function lerArquivo(pasta) {
    let fh;
    try { fh = await pasta.getFileHandle(ARQ_DADOS); } catch (e) { return { falta: true }; }
    const texto = await (await fh.getFile()).text();
    return { fh, texto, dados: lerDadosJs(texto) };
  }

  g.conectar = async (handle) => {
    try {
      const pasta = handle || await env.showDirectoryPicker({ id: "radar-carga-solta", mode: "readwrite" });
      const a = await lerArquivo(pasta);
      if (a.falta) return { ok: false, faltaArquivo: true, handle: pasta };
      if (!a.dados) return { ok: false, msg: `O ${ARQ_DADOS} dessa pasta está ilegível. Restaure a cópia mais recente de ${PASTA_BKP}/.` };
      g.pasta = pasta;
      await idb?.put("pasta", pasta);
      muda(sessaoVazia(obterSessao()) ? "salvo" : "pendente", `Conectado à pasta ${pasta.name}.`);
      return { ok: true, dados: a.dados };
    } catch (e) {
      if (e?.name === "AbortError") return { ok: false, cancelado: true };
      return { ok: false, msg: "Não foi possível abrir a pasta: " + (e?.message || e?.name) };
    }
  };

  g.reconectar = async () => {
    const h = await idb?.get("pasta");
    if (!h) return false;
    g.pasta = h;
    muda(sessaoVazia(obterSessao()) ? "salvo" : "pendente", `Pasta ${h.name} lembrada deste navegador.`);
    return true;
  };

  g.criarArquivoInicial = async (pasta) => {
    const d = { ...obterTela(), salvoEm: new Date().toISOString(), salvoPor: obterQuem() };
    const w = await (await pasta.getFileHandle(ARQ_DADOS, { create: true })).createWritable();
    await w.write(montarDadosJs(d)); await w.close();
    g.pasta = pasta; g.baseSalvoEm = d.salvoEm;
    await idb?.put("pasta", pasta);
    aoSalvar(d);
    muda("salvo", `Base criada na pasta ${pasta.name}.`);
    return { ok: true };
  };

  async function guardarBackup(texto, salvoEm) {
    const dir = await g.pasta.getDirectoryHandle(PASTA_BKP, { create: true });
    const nome = nomeBackup(salvoEm);
    let existe = true;
    try { await dir.getFileHandle(nome); } catch (e) { existe = false; }
    if (!existe) { const w = await (await dir.getFileHandle(nome, { create: true })).createWritable(); await w.write(texto); await w.close(); }
    const nomes = [];
    for await (const [n, h] of dir.entries()) if (h.kind === "file") nomes.push(n);
    for (const n of podar(nomes)) await dir.removeEntry(n).catch(() => {});
  }

  /* Tira da sessão só o que foi gravado; o que mudou durante a escrita continua pendente. */
  function baixarDaSessao(s, foto) {
    for (const k of ["alterados", "excluidos", "restaurados"]) for (const c of foto[k]) s[k].delete(c);
    for (const [cnpj, nome] of foto.cadastro) if (s.cadastro.get(cnpj) === nome) s.cadastro.delete(cnpj);
    s.log.splice(0, foto.log.length);
  }

  g.salvar = async ({ juntar: deveJuntar = false, manual = false } = {}) => {
    if (!g.pasta) return { ok: false, msg: "A pasta compartilhada não está conectada." };
    const sessao = obterSessao();
    if (!manual && !deveJuntar && sessaoVazia(sessao)) return { ok: true, msg: "Nada a gravar." };
    try {
      let p = await g.pasta.queryPermission({ mode: "readwrite" });
      if (p !== "granted" && manual) p = await g.pasta.requestPermission({ mode: "readwrite" });
      if (p !== "granted") {
        muda("pendente", "O navegador pede permissão para gravar na pasta. Clique em Salvar agora.");
        return { ok: false, msg: g.mensagem };
      }
      const a = await lerArquivo(g.pasta);
      if (a.falta) { muda("erro", `O ${ARQ_DADOS} não está mais na pasta ${g.pasta.name}. Nada foi gravado.`); return { ok: false, msg: g.mensagem }; }
      if (!a.dados) { muda("erro", `O ${ARQ_DADOS} da pasta está ilegível. Nada foi gravado; restaure a cópia mais recente de ${PASTA_BKP}/.`); return { ok: false, msg: g.mensagem }; }

      const tela = obterTela();
      const conflito = (a.dados.salvoEm || null) !== (g.baseSalvoEm || null);
      if (conflito && !deveJuntar) {
        muda("conflito", resumoConflito(a.dados, tela, sessao));
        return { ok: false, conflito: true, msg: g.mensagem };
      }
      muda("salvando", "Gravando na pasta…");
      const foto = { ...serSessao(sessao), cadastro: [...sessao.cadastro] };
      const base = conflito ? juntar(a.dados, tela, sessao) : JSON.parse(JSON.stringify(tela));
      base.salvoEm = new Date().toISOString();
      base.salvoPor = obterQuem();
      await guardarBackup(a.texto, a.dados.salvoEm);
      const w = await a.fh.createWritable();
      await w.write(montarDadosJs(base)); await w.close();

      g.baseSalvoEm = base.salvoEm;
      baixarDaSessao(sessao, foto);
      if (conflito) aoSalvar(base);
      else { tela.salvoEm = base.salvoEm; tela.salvoPor = base.salvoPor; aoSalvar(null); }
      const resto = sessaoVazia(sessao);
      await (resto ? idb?.del("pendentes") : guardarPendentes());
      muda(resto ? "salvo" : "pendente", `${conflito ? "Juntado e salvo" : "Salvo"} na pasta por ${base.salvoPor}.`);
      return { ok: true, dados: base };
    } catch (e) {
      muda("erro", "Não foi possível gravar (" + (e?.message || e?.name) + "). As alterações continuam guardadas neste navegador.");
      return { ok: false, msg: g.mensagem };
    }
  };

  g.gravarNaFila = (opcoes = {}) => (fila = fila.catch(() => null).then(() => g.salvar(opcoes)));

  async function guardarPendentes() {
    await idb?.put("pendentes", { tela: JSON.parse(JSON.stringify(obterTela())), sessao: serSessao(obterSessao()) });
  }

  g.marcarAlterado = () => {
    if (g.estado !== "conflito") muda("pendente", g.pasta ? "Alterações aguardando gravação." : "Alterações só neste navegador. Conecte a pasta para gravar.");
    const pend = guardarPendentes();
    clearTimeout(timer);
    if (!g.pasta || g.estado === "conflito") { esperaTimer = pend; return; }
    esperaTimer = new Promise(ok => { timer = setTimeout(() => { g.gravarNaFila(); ok(); }, atraso); }).then(() => pend);
  };

  g.ocioso = async () => { await esperaTimer; await fila; };

  g.restaurarPendentes = async () => {
    const p = await idb?.get("pendentes");
    return p ? { tela: p.tela, sessao: desSessao(p.sessao) } : null;
  };
  g.descartarPendentes = () => idb?.del("pendentes");

  return g;
}
