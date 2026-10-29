import { test } from "node:test";
import assert from "node:assert/strict";
import { novaBase } from "../src/base.js";
import * as A from "../src/acoes.js";
import { novaSessao, montarDadosJs, lerDadosJs, ARQ_DADOS, PASTA_BKP } from "../src/arquivo.js";
import { criarGravador, podeGravar } from "../src/pasta.js";
import { PastaFalsa, idbFalso } from "./fakes/pasta-falsa.js";
import { campos, chaveN } from "./ajuda.js";

const AGORA = "2026-10-28T12:00:00.000Z";

/* Uma "página": dados na tela, sessão e gravador apontando para a pasta. */
function pagina(pasta, quem = "Ana") {
  const p = { quem, dados: lerDadosJs(pasta.arquivos.get(ARQ_DADOS)), sessao: novaSessao() };
  p.g = criarGravador({
    obterTela: () => p.dados, obterSessao: () => p.sessao, obterQuem: () => p.quem,
    aoSalvar: dados => { if (dados) p.dados = dados; },
    idb: idbFalso(), atraso: 0,
  });
  p.lanca = n => A.incluir(p.dados, p.sessao, campos({ chave: chaveN(n), numero: n }), p.quem, AGORA);
  p.corrige = (n, extra) => A.corrigir(p.dados, p.sessao, chaveN(n), campos({ chave: chaveN(n), numero: n, ...extra }), p.quem, AGORA);
  return p;
}
function pastaComBase() {
  const pasta = new PastaFalsa();
  const d = novaBase(); d.salvoEm = "2026-10-28T09:00:00.000Z";
  pasta.arquivos.set(ARQ_DADOS, montarDadosJs(d));
  return pasta;
}
const lerArquivo = pasta => lerDadosJs(pasta.arquivos.get(ARQ_DADOS));

test("salvar grava o arquivo e faz backup do anterior", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  assert.equal((await p.g.conectar(pasta)).ok, true);
  p.lanca(1);
  const r = await p.g.salvar({ manual: true });
  assert.equal(r.ok, true);
  const arq = lerArquivo(pasta);
  assert.equal(arq.ctes.length, 1);
  assert.equal(arq.salvoPor, "Ana");
  assert.notEqual(arq.salvoEm, "2026-10-28T09:00:00.000Z");
  assert.equal(p.g.baseSalvoEm, arq.salvoEm);
  assert.equal(p.g.estado, "salvo");
  const bkp = pasta.pastas.get(PASTA_BKP);
  assert.equal(bkp.arquivos.size, 1);
  assert.equal(lerDadosJs([...bkp.arquivos.values()][0]).ctes.length, 0);
  assert.equal(p.sessao.alterados.size, 0);
  assert.equal(p.sessao.log.length, 0);
});

test("o que muda durante a gravação continua pendente", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  await p.g.conectar(pasta);
  p.lanca(1);
  const salvando = p.g.salvar({ manual: true });
  await new Promise(r => setTimeout(r, 1));   // a escrita está em andamento
  p.lanca(2);
  assert.equal((await salvando).ok, true);
  assert.deepEqual([...p.sessao.alterados], [chaveN(2)]);
  assert.equal(p.dados.ctes.length, 2);
  assert.equal(p.g.estado, "pendente");
});

test("conectar exige o arquivo de dados na pasta", async () => {
  const p = pagina(pastaComBase());
  const r = await p.g.conectar(new PastaFalsa("vazia"));
  assert.equal(r.ok, false);
  assert.equal(r.faltaArquivo, true);
  assert.equal(p.g.pasta, null);
});

test("criarArquivoInicial grava base vazia e conecta", async () => {
  const vazia = new PastaFalsa("nova");
  const g = criarGravador({ obterTela: () => novaBase(), obterSessao: novaSessao, obterQuem: () => "Ana", aoSalvar() {}, idb: idbFalso() });
  assert.equal((await g.criarArquivoInicial(vazia)).ok, true);
  assert.equal(lerArquivo(vazia).ctes.length, 0);
  assert.equal(g.pasta, vazia);
  assert.equal(g.baseSalvoEm, lerArquivo(vazia).salvoEm);
});

test("criarArquivoInicial leva o que estava pendente e limpa a sessão", async () => {
  const vazia = new PastaFalsa("nova"), p = pagina(pastaComBase());
  p.lanca(1);
  await p.g.criarArquivoInicial(vazia);
  assert.equal(lerArquivo(vazia).ctes.length, 1);
  assert.equal(p.sessao.alterados.size + p.sessao.log.length, 0);
  assert.equal(p.g.estado, "salvo");
});

test("salvar detecta conflito", async () => {
  const pasta = pastaComBase(), a = pagina(pasta, "Ana"), b = pagina(pasta, "Bia");
  await a.g.conectar(pasta); await b.g.conectar(pasta);
  b.lanca(2); assert.equal((await b.g.salvar({ manual: true })).ok, true);
  a.lanca(1);
  const r = await a.g.salvar({ manual: true });
  assert.equal(r.ok, false);
  assert.equal(r.conflito, true);
  assert.equal(a.g.estado, "conflito");
  assert.match(a.g.mensagem, /Bia gravou/);
  assert.deepEqual(lerArquivo(pasta).ctes.map(c => c.numero), [2]);
});

test("salvar com juntar preserva os dois lados", async () => {
  const pasta = pastaComBase(), a = pagina(pasta, "Ana"), b = pagina(pasta, "Bia");
  await a.g.conectar(pasta); await b.g.conectar(pasta);
  b.lanca(2); await b.g.salvar({ manual: true });
  a.lanca(1); await a.g.salvar({ manual: true });
  const r = await a.g.salvar({ manual: true, juntar: true });
  assert.equal(r.ok, true);
  assert.deepEqual(lerArquivo(pasta).ctes.map(c => c.numero).sort(), [1, 2]);
  assert.deepEqual(a.dados.ctes.map(c => c.numero).sort(), [1, 2]);
});

test("arquivo ilegível não é sobrescrito", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  await p.g.conectar(pasta);
  pasta.arquivos.set(ARQ_DADOS, "lixo");
  p.lanca(1);
  const r = await p.g.salvar({ manual: true });
  assert.equal(r.ok, false);
  assert.equal(p.g.estado, "erro");
  assert.match(p.g.mensagem, /ilegível/);
  assert.equal(pasta.arquivos.get(ARQ_DADOS), "lixo");
});

test("sem permissão na gravação automática fica pendente pedindo clique", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  await p.g.conectar(pasta);
  pasta.permissao = "prompt";
  p.lanca(1);
  const r = await p.g.salvar({});
  assert.equal(r.ok, false);
  assert.equal(p.g.estado, "pendente");
  assert.match(p.g.mensagem, /Salvar agora/);
});

test("fila automática não grava duas vezes ao mesmo tempo", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  await p.g.conectar(pasta);
  p.lanca(1); const x = p.g.gravarNaFila();
  p.lanca(2); const y = p.g.gravarNaFila();
  p.lanca(3); p.g.marcarAlterado();
  await Promise.all([x, y]); await p.g.ocioso();
  assert.equal(pasta.maxSimultaneo, 1);
  assert.deepEqual(lerArquivo(pasta).ctes.map(c => c.numero).sort(), [1, 2, 3]);
});

test("pendências sobrevivem num idb e voltam", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  p.lanca(1);
  p.g.marcarAlterado();
  const pend = await p.g.restaurarPendentes();
  assert.equal(pend.tela.ctes.length, 1);
  assert.ok(pend.sessao.alterados.has(chaveN(1)));
});

test("podeGravar é falso fora de file:", () => {
  assert.equal(podeGravar({ location: { protocol: "https:" }, showDirectoryPicker() {} }), false);
  assert.equal(podeGravar({ location: { protocol: "file:" } }), false);
  assert.equal(podeGravar({ location: { protocol: "file:" }, showDirectoryPicker() {} }), true);
});

test("corrigir o mesmo CT-e durante a gravação continua pendente", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  await p.g.conectar(pasta);
  p.lanca(1);
  const salvando = p.g.salvar({ manual: true });
  await new Promise(r => setTimeout(r, 1));
  p.corrige(1, { quantidade: 999 });
  assert.equal((await salvando).ok, true);
  assert.equal(p.g.estado, "pendente");
  assert.ok(p.sessao.alterados.has(chaveN(1)));
  assert.equal(p.sessao.log.length, 1);
  assert.equal((await p.g.salvar({})).ok, true);
  assert.equal(lerArquivo(pasta).ctes[0].quantidade, 999);
});

test("o que se lança durante Juntar e salvar fica na tela e vai na próxima gravação", async () => {
  const pasta = pastaComBase(), a = pagina(pasta, "Ana"), b = pagina(pasta, "Bia");
  await a.g.conectar(pasta); await b.g.conectar(pasta);
  a.lanca(1); await a.g.salvar({ manual: true });
  b.lanca(2); await b.g.salvar({ manual: true });       // conflito
  const juntando = b.g.salvar({ manual: true, juntar: true });
  await new Promise(r => setTimeout(r, 1));
  b.lanca(3);
  assert.equal((await juntando).ok, true);
  assert.deepEqual(b.dados.ctes.map(c => c.numero).sort(), [1, 2, 3]);
  assert.equal(b.g.estado, "pendente");
  assert.equal((await b.g.salvar({})).ok, true);
  assert.deepEqual(lerArquivo(pasta).ctes.map(c => c.numero).sort(), [1, 2, 3]);
});

test("criarArquivoInicial recusa pasta que já tem base ou backups", async () => {
  const comBkp = new PastaFalsa("sincronizando");
  await comBkp.getDirectoryHandle("backups", { create: true });
  const g = criarGravador({ obterTela: () => novaBase(), obterSessao: novaSessao, obterQuem: () => "Ana", aoSalvar() {}, idb: idbFalso() });
  const r = await g.criarArquivoInicial(comBkp);
  assert.equal(r.ok, false);
  assert.match(r.msg, /backups/);
  assert.equal(comBkp.arquivos.size, 0);
  const comCopia = new PastaFalsa("copia");
  comCopia.arquivos.set("radar-carga-solta-dados-PC01.js", "x");
  assert.equal((await g.criarArquivoInicial(comCopia)).ok, false);
});

test("gravação de outra pessoa durante o backup vira conflito, sem sobrescrever", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  await p.g.conectar(pasta);
  const orig = pasta.getDirectoryHandle.bind(pasta);
  pasta.getDirectoryHandle = async (...x) => {          // enquanto o backup é feito, Bia grava
    const d = lerArquivo(pasta); d.salvoEm = "2026-10-28T11:11:11.000Z"; d.salvoPor = "Bia";
    pasta.arquivos.set(ARQ_DADOS, montarDadosJs(d));
    return orig(...x);
  };
  p.lanca(1);
  const r = await p.g.salvar({ manual: true });
  assert.equal(r.conflito, true);
  assert.equal(lerArquivo(pasta).salvoPor, "Bia");
  assert.equal(lerArquivo(pasta).ctes.length, 0);
});

test("pendências v1 no IndexedDB voltam migradas", async () => {
  const idb = idbFalso();
  await idb.put("pendentes", { tela: { versao: 1, ctes: [{ chave: "a", sacas: 7 }], cnpjs: [], lixeira: [], log: [] },
    sessao: { alterados: ["a"], excluidos: [], restaurados: [], cadastro: [["1", "X"]], log: [] } });
  const g = criarGravador({ obterTela: () => novaBase(), obterSessao: novaSessao, obterQuem: () => "Ana", aoSalvar() {}, idb });
  const p = await g.restaurarPendentes();
  assert.equal(p.tela.versao, 3);
  assert.equal(p.tela.ctes[0].quantidade, 7);
  assert.equal(p.sessao.cadastro.get("1").nome, "X", "cadastro antigo (só nome) vira objeto");
  assert.equal(p.sessao.listas.size, 0);
});

test("a data de corte gravada sai da sessão e vai para o arquivo", async () => {
  const pasta = pastaComBase(), p = pagina(pasta);
  await p.g.conectar(pasta);
  A.definirCorte(p.dados, p.sessao, "2026-09-01", p.quem, AGORA);
  assert.equal((await p.g.salvar({ manual: true })).ok, true);
  assert.equal(lerArquivo(pasta).corte, "2026-09-01");
  assert.equal(p.sessao.config.size, 0);
});

test("pendências guardadas levam a data de corte da sessão", async () => {
  const idb = idbFalso(), s = novaSessao();
  s.config.set("corte", null);
  const g = criarGravador({ obterTela: () => novaBase(), obterSessao: () => s, obterQuem: () => "Ana", aoSalvar() {}, idb, atraso: 0 });
  g.marcarAlterado();
  await g.ocioso?.();
  const p = await g.restaurarPendentes();
  assert.equal(p.sessao.config.get("corte"), null);
  assert.equal(p.sessao.config.has("corte"), true);
});

test("apagados da lixeira sobrevivem nas pendências guardadas", async () => {
  const idb = idbFalso(), s = novaSessao();
  s.apagados.add("abc");
  const g = criarGravador({ obterTela: () => novaBase(), obterSessao: () => s, obterQuem: () => "Ana", aoSalvar() {}, idb, atraso: 0 });
  g.marcarAlterado();
  await g.ocioso();
  const p = await g.restaurarPendentes();
  assert.deepEqual([...p.sessao.apagados], ["abc"]);
});
