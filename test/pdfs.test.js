// PDFs dos CT-e na pasta "PDFs Carga Solta": nome "CTE 1234 - Oasis.pdf" (ou com a chave de 44 dígitos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerNomePdf, indexarPdfs, pdfDoCte, listarPdfs, PASTA_PDFS, PASTA_REGISTRADOS, pastaDoMes, mesDaChave, planejarOrganizacao, executarOrganizacao } from "../src/pdfs.js";
import { PastaFalsa } from "./fakes/pasta-falsa.js";

const CHAVE = "35260820947259000151570010000028481000034856";
const arq = nome => ({ nome, caminho: nome });

test("o nome da pasta é PDFs Carga Solta", () => assert.equal(PASTA_PDFS, "PDFs Carga Solta"));

test("lerNomePdf: número depois de CTE, resto do nome e chave", () => {
  assert.deepEqual(lerNomePdf("CTE 1234 - Oasis.pdf"), { numero: 1234, chave: null, resto: "OASIS" });
  assert.deepEqual(lerNomePdf("cte-0001234_Oasis Transportes.PDF"), { numero: 1234, chave: null, resto: "OASIS TRANSPORTES" });
  assert.deepEqual(lerNomePdf("CT-e nº 2848 - JF Pereira.pdf"), { numero: 2848, chave: null, resto: "JF PEREIRA" });
  assert.equal(lerNomePdf(`${CHAVE}.pdf`).chave, CHAVE);
  assert.equal(lerNomePdf("Fatura 1234.pdf"), null, "sem CTE e sem chave não é PDF de CT-e");
  assert.equal(lerNomePdf("CTE 1234 - Oasis.xml"), null, "só .pdf");
});

test("pdfDoCte acha pelo número; sem PDF diz nenhum", () => {
  const ind = indexarPdfs([arq("CTE 1234 - Oasis.pdf"), arq("CTE 99 - Outra.pdf")]);
  assert.equal(pdfDoCte(ind, { numero: 1234, chave: "x" }, {}).item.nome, "CTE 1234 - Oasis.pdf");
  assert.deepEqual(pdfDoCte(ind, { numero: 5, chave: "x" }, {}), { ok: false, motivo: "nenhum" });
});

test("pdfDoCte prefere a chave no nome do arquivo", () => {
  const ind = indexarPdfs([arq("CTE 2848 - Outra.pdf"), arq(`${CHAVE}.pdf`)]);
  assert.equal(pdfDoCte(ind, { numero: 2848, chave: CHAVE }, {}).item.nome, `${CHAVE}.pdf`);
});

test("mesmo número em dois PDFs: o nome do transportador decide", () => {
  const ind = indexarPdfs([arq("CTE 1234 - Oasis.pdf"), arq("CTE 1234 - Colombari.pdf")]);
  assert.equal(pdfDoCte(ind, { numero: 1234, chave: "x" }, { nomeTransportador: "COLOMBARI SERVIÇOS DE TRANSPORTES LTDA" }).item.nome, "CTE 1234 - Colombari.pdf");
  assert.deepEqual(pdfDoCte(ind, { numero: 1234, chave: "x" }, { nomeTransportador: "TRANSPORTES TRES" }), { ok: false, motivo: "varios" });
});

test("dois CT-e com o mesmo número: o PDF de outro transportador não vale", () => {
  const ind = indexarPdfs([arq("CTE 1234 - Oasis.pdf")]);
  assert.equal(pdfDoCte(ind, { numero: 1234, chave: "a" }, { nomeTransportador: "OASIS LOGISTICA", outrosComMesmoNumero: 1 }).ok, true);
  assert.equal(pdfDoCte(ind, { numero: 1234, chave: "b" }, { nomeTransportador: "JF PEREIRA", outrosComMesmoNumero: 1 }).motivo, "nenhum");
  assert.equal(pdfDoCte(ind, { numero: 1234, chave: "b" }, { nomeTransportador: "JF PEREIRA" }).ok, true, "número único: o nome não precisa bater");
});

test("listarPdfs lê PDFs Carga Solta e Registrados, com as subpastas", async () => {
  const raiz = new PastaFalsa("Radar");
  const pdfs = await raiz.getDirectoryHandle(PASTA_PDFS, { create: true });
  pdfs.arquivos.set("CTE 1 - A.pdf", "%PDF");
  pdfs.arquivos.set("leia.txt", "x");
  (await pdfs.getDirectoryHandle("Agosto", { create: true })).arquivos.set("CTE 2 - B.pdf", "%PDF");
  (await (await raiz.getDirectoryHandle(PASTA_REGISTRADOS, { create: true })).getDirectoryHandle("1 - Janeiro_2026", { create: true })).arquivos.set("CTE 3 - C.pdf", "%PDF");
  const lista = await listarPdfs(raiz);
  assert.deepEqual(lista.map(p => p.caminho).sort(), ["PDFs Carga Solta/Agosto/CTE 2 - B.pdf", "PDFs Carga Solta/CTE 1 - A.pdf", "Registrados/1 - Janeiro_2026/CTE 3 - C.pdf"]);
  assert.ok(lista.every(p => p.handle?.getFile));
  assert.deepEqual(await listarPdfs(new PastaFalsa("sem pdfs")), [], "sem a pasta: lista vazia");
});

test("pastaDoMes: número do mês, nome e ano", () => {
  assert.equal(PASTA_REGISTRADOS, "Registrados");
  assert.equal(pastaDoMes("2026-01-15"), "1 - Janeiro_2026");
  assert.equal(pastaDoMes("2026-03"), "3 - Março_2026");
  assert.equal(pastaDoMes("2025-12-01"), "12 - Dezembro_2025");
  assert.equal(pastaDoMes(""), null);
  assert.equal(pastaDoMes("2026-13-01"), null);
});

test("mesDaChave: AAMM da chave de acesso", () => {
  assert.equal(mesDaChave(CHAVE), "2026-08");
  assert.equal(mesDaChave("123"), null);
});

/* Pasta com PDFs soltos, um já no lugar, um sem CT-e e um com a chave no nome. */
async function montar() {
  const raiz = new PastaFalsa("Radar");
  const pdfs = await raiz.getDirectoryHandle(PASTA_PDFS, { create: true });
  pdfs.arquivos.set("CTE 1 - Oasis.pdf", "%PDF um");
  (await pdfs.getDirectoryHandle("Antigos", { create: true })).arquivos.set("CTE 2 - Oasis.pdf", "%PDF dois");
  pdfs.arquivos.set("CTE 9 - Ninguem.pdf", "%PDF nove");
  pdfs.arquivos.set(`${CHAVE}.pdf`, "%PDF chave");
  const reg = await raiz.getDirectoryHandle(PASTA_REGISTRADOS, { create: true });
  (await reg.getDirectoryHandle("2 - Fevereiro_2026", { create: true })).arquivos.set("CTE 3 - Oasis.pdf", "%PDF tres");
  const ctes = [
    { numero: 1, chave: "a", emissao: "2026-01-20" },
    { numero: 2, chave: "b", emissao: "2025-12-05" },
    { numero: 3, chave: "c", emissao: "2026-02-10" },
  ];
  return { raiz, pdfs, ctes };
}

test("planejarOrganizacao: mês da emissão do CT-e, ou da chave; sem mês fica", async () => {
  const { raiz, ctes } = await montar();
  const plano = planejarOrganizacao(await listarPdfs(raiz), ctes);
  assert.deepEqual(new Map(plano.mover.map(m => [m.item.caminho, m.pasta])), new Map([
    ["PDFs Carga Solta/Antigos/CTE 2 - Oasis.pdf", "12 - Dezembro_2025"],
    ["PDFs Carga Solta/CTE 1 - Oasis.pdf", "1 - Janeiro_2026"],
    [`PDFs Carga Solta/${CHAVE}.pdf`, "8 - Agosto_2026"],
  ]));
  assert.equal(plano.noLugar, 1);
  assert.deepEqual(plano.semMes.map(i => i.nome), ["CTE 9 - Ninguem.pdf"]);
});

test("planejarOrganizacao: não põe dois arquivos de mesmo nome na mesma pasta", () => {
  const lista = [{ nome: "CTE 1 - A.pdf", caminho: "CTE 1 - A.pdf" }, { nome: "CTE 1 - A.pdf", caminho: "X/CTE 1 - A.pdf" }];
  const plano = planejarOrganizacao(lista, [{ numero: 1, chave: "a", emissao: "2026-05-01" }]);
  assert.equal(plano.mover.length + plano.duplicados.length + plano.semMes.length, 2);
  assert.ok(plano.mover.length <= 1);
});

test("executarOrganizacao copia para Registrados/mês, na pasta do painel, e tira da origem", async () => {
  const { raiz, pdfs, ctes } = await montar();
  const plano = planejarOrganizacao(await listarPdfs(raiz), ctes);
  const r = await executarOrganizacao(raiz, plano);
  assert.deepEqual(r, { movidos: 3, falhas: [] });
  const reg = raiz.pastas.get(PASTA_REGISTRADOS);
  assert.deepEqual([...reg.pastas.keys()].sort(), ["1 - Janeiro_2026", "12 - Dezembro_2025", "2 - Fevereiro_2026", "8 - Agosto_2026"]);
  assert.equal(reg.pastas.get("1 - Janeiro_2026").arquivos.get("CTE 1 - Oasis.pdf"), "%PDF um");
  assert.equal(reg.pastas.get("12 - Dezembro_2025").arquivos.get("CTE 2 - Oasis.pdf"), "%PDF dois");
  assert.equal(pdfs.arquivos.has("CTE 1 - Oasis.pdf"), false);
  assert.equal(pdfs.pastas.get("Antigos").arquivos.size, 0);
  assert.equal(pdfs.arquivos.has("CTE 9 - Ninguem.pdf"), true, "sem mês fica onde está");
  // segunda vez: tudo no lugar
  const de2 = planejarOrganizacao(await listarPdfs(raiz), ctes);
  assert.equal(de2.mover.length, 0);
  assert.equal(de2.noLugar, 4);
});

test("executarOrganizacao não sobrescreve arquivo que já está na pasta do mês", async () => {
  const { raiz, pdfs, ctes } = await montar();
  const plano = planejarOrganizacao(await listarPdfs(raiz), ctes);
  const reg = raiz.pastas.get(PASTA_REGISTRADOS);
  (await reg.getDirectoryHandle("1 - Janeiro_2026", { create: true })).arquivos.set("CTE 1 - Oasis.pdf", "outro");
  const r = await executarOrganizacao(raiz, plano);
  assert.equal(r.movidos, 2);
  assert.equal(r.falhas[0].item.nome, "CTE 1 - Oasis.pdf");
  assert.equal(reg.pastas.get("1 - Janeiro_2026").arquivos.get("CTE 1 - Oasis.pdf"), "outro");
  assert.equal(pdfs.arquivos.get("CTE 1 - Oasis.pdf"), "%PDF um", "o original continua");
});

test("Registrados dentro de PDFs Carga Solta (versão anterior) vai para a da pasta do painel", async () => {
  const raiz = new PastaFalsa("Radar");
  const pdfs = await raiz.getDirectoryHandle(PASTA_PDFS, { create: true });
  const velha = await (await pdfs.getDirectoryHandle(PASTA_REGISTRADOS, { create: true })).getDirectoryHandle("3 - Março_2026", { create: true });
  velha.arquivos.set("CTE 4 - Oasis.pdf", "%PDF quatro");
  const ctes = [{ numero: 4, chave: "d", emissao: "2026-03-15" }];
  const r = await executarOrganizacao(raiz, planejarOrganizacao(await listarPdfs(raiz), ctes));
  assert.equal(r.movidos, 1);
  assert.equal(raiz.pastas.get(PASTA_REGISTRADOS).pastas.get("3 - Março_2026").arquivos.get("CTE 4 - Oasis.pdf"), "%PDF quatro");
  assert.equal(velha.arquivos.size, 0);
});

test("listarPdfs procura na pasta do painel inteira, fora as pastas ocultas", async () => {
  const raiz = new PastaFalsa("Radar");
  raiz.arquivos.set("CTE 7 - Solto na raiz.pdf", "%PDF");
  (await (await raiz.getDirectoryHandle("Antigos", { create: true })).getDirectoryHandle("2025", { create: true })).arquivos.set("CTE 8 - X.pdf", "%PDF");
  (await raiz.getDirectoryHandle(".lixo", { create: true })).arquivos.set("CTE 9 - Oculto.pdf", "%PDF");
  (await raiz.getDirectoryHandle(PASTA_PDFS, { create: true })).arquivos.set("CTE 1 - A.pdf", "%PDF");
  const caminhos = (await listarPdfs(raiz)).map(p => p.caminho).sort();
  assert.deepEqual(caminhos, ["Antigos/2025/CTE 8 - X.pdf", "CTE 7 - Solto na raiz.pdf", "PDFs Carga Solta/CTE 1 - A.pdf"]);
});

test("listarPdfs não esconde erro de leitura (a falta de permissão vira aviso na tela)", async () => {
  const raiz = new PastaFalsa("Radar");
  raiz.entries = async function* () { throw Object.assign(new Error("sem permissão"), { name: "NotAllowedError" }); };
  await assert.rejects(listarPdfs(raiz), { name: "NotAllowedError" });
});
