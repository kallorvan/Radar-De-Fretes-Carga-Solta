import { test } from "node:test";
import assert from "node:assert/strict";
import { novaBase, incluir } from "../src/base.js";
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
  p.lanca = n => {
    const antes = p.dados.log.length;
    incluir(p.dados, campos({ chave: chaveN(n), numero: n }), p.quem, AGORA);
    p.sessao.alterados.add(chaveN(n));
    p.sessao.log.push(...p.dados.log.slice(antes));
  };
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
