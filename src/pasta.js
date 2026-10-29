// Gravação na pasta compartilhada (File System Access API, Chrome e Edge abrindo o HTML pela pasta).
// Antes de gravar, confere se outra pessoa gravou depois que esta página abriu (a trava por salvoEm);
// guarda a versão anterior em backups/ e grava em fila, uma escrita por vez.

import { migrarBase } from "./base.js";
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

const serSessao = s => ({ alterados: [...s.alterados], excluidos: [...s.excluidos], restaurados: [...s.restaurados], apagados: [...(s.apagados || [])], cadastro: [...s.cadastro], listas: [...(s.listas || [])], config: [...(s.config || [])], log: [...s.log], toques: [...(s.toques || [])] });
const desSessao = s => ({ alterados: new Set(s.alterados), excluidos: new Set(s.excluidos), restaurados: new Set(s.restaurados), apagados: new Set(s.apagados || []), 
  // sessões antigas guardavam só o nome do CNPJ
  cadastro: new Map((s.cadastro || []).map(([k, v]) => [k, typeof v === "string" ? { nome: v } : v])),
  listas: new Map(s.listas || []), config: new Map(s.config || []), log: s.log, toques: new Map(s.toques || []) });

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

  /* Só para a primeira instalação: recusa pasta que já tem sinal de base (o OneDrive pode ainda não ter
     baixado o arquivo de dados, e criar um vazio por cima perderia a base da equipe). */
  g.criarArquivoInicial = async (pasta) => {
    try {
      for await (const [nome, h] of pasta.entries()) {
        if (h.kind === "directory" && nome === PASTA_BKP)
          return { ok: false, msg: `A pasta ${pasta.name} já tem ${PASTA_BKP}/: a base existe e talvez ainda não tenha sincronizado. Espere o OneDrive terminar e conecte de novo.` };
        if (h.kind === "file" && /^radar-carga-solta-dados.*\.js$/i.test(nome))
          return { ok: false, msg: `A pasta ${pasta.name} já tem ${nome}. Confira com a equipe antes de criar uma base nova.` };
      }
    } catch (e) { return { ok: false, msg: "Não foi possível ler a pasta: " + (e?.message || e?.name) }; }
    const d = { ...obterTela(), salvoEm: new Date().toISOString(), salvoPor: obterQuem() };
    try {
      const w = await (await pasta.getFileHandle(ARQ_DADOS, { create: true })).createWritable();
      await w.write(montarDadosJs(d)); await w.close();
    } catch (e) { return { ok: false, msg: "Não foi possível criar a base: " + (e?.message || e?.name) }; }
    g.pasta = pasta; g.baseSalvoEm = d.salvoEm;
    const s = obterSessao();
    baixarDaSessao(s, serSessao(s));
    await idb?.put("pasta", pasta);
    await idb?.del("pendentes");
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
    const toquesFoto = new Map(foto.toques || []);
    const mudouDepois = c => s.toques && (s.toques.get(c) || 0) !== (toquesFoto.get(c) || 0);
    for (const k of ["alterados", "excluidos", "restaurados"]) for (const c of foto[k]) if (!mudouDepois(c)) s[k].delete(c);
    for (const c of foto.apagados || []) s.apagados?.delete(c);
    if (s.toques) for (const [c, n] of toquesFoto) if (s.toques.get(c) === n) s.toques.delete(c);
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const [cnpj, reg] of foto.cadastro) if (igual(s.cadastro.get(cnpj), reg)) s.cadastro.delete(cnpj);
    for (const [k, item] of foto.listas || []) if (igual(s.listas?.get(k), item)) s.listas.delete(k);
    for (const [k, v] of foto.config || []) if (s.config?.has(k) && igual(s.config.get(k), v)) s.config.delete(k);
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
      const foto = serSessao(sessao);
      const base = conflito ? juntar(a.dados, tela, sessao) : JSON.parse(JSON.stringify(tela));
      base.salvoEm = new Date().toISOString();
      base.salvoPor = obterQuem();
      await guardarBackup(a.texto, a.dados.salvoEm);
      // a trava de novo, logo antes de escrever: alguém pode ter gravado enquanto o backup era feito
      const agoraNaPasta = lerDadosJs(await (await a.fh.getFile()).text());
      if ((agoraNaPasta?.salvoEm || null) !== (a.dados.salvoEm || null)) {
        muda("conflito", resumoConflito(agoraNaPasta || a.dados, tela, sessao));
        return { ok: false, conflito: true, msg: g.mensagem };
      }
      const w = await a.fh.createWritable();
      await w.write(montarDadosJs(base)); await w.close();

      g.baseSalvoEm = base.salvoEm;
      baixarDaSessao(sessao, foto);
      // o que mudou na tela durante a junção vai por cima da base juntada
      if (conflito) aoSalvar(sessaoVazia(sessao) ? base : juntar(base, obterTela(), sessao));
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
    return p ? { tela: migrarBase(p.tela), sessao: desSessao(p.sessao) } : null;
  };
  g.descartarPendentes = () => idb?.del("pendentes");

  return g;
}
