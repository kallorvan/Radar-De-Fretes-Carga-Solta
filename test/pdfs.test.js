// PDFs dos CT-e na pasta "PDFs Carga Solta": nome "CTE 1234 - Oasis.pdf" (ou com a chave de 44 dígitos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerNomePdf, indexarPdfs, pdfDoCte, listarPdfs, PASTA_PDFS } from "../src/pdfs.js";
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

test("listarPdfs lê a pasta e as subpastas", async () => {
  const raiz = new PastaFalsa("Radar");
  const pdfs = await raiz.getDirectoryHandle(PASTA_PDFS, { create: true });
  pdfs.arquivos.set("CTE 1 - A.pdf", "%PDF");
  pdfs.arquivos.set("leia.txt", "x");
  (await pdfs.getDirectoryHandle("Agosto", { create: true })).arquivos.set("CTE 2 - B.pdf", "%PDF");
  const lista = await listarPdfs(raiz);
  assert.deepEqual(lista.map(p => p.caminho).sort(), ["Agosto/CTE 2 - B.pdf", "CTE 1 - A.pdf"]);
  assert.ok(lista.every(p => p.handle?.getFile));
  assert.deepEqual(await listarPdfs(new PastaFalsa("sem pdfs")), [], "sem a pasta: lista vazia");
});
