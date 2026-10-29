// PDFs dos CT-e lançados, na pasta "PDFs Carga Solta" dentro da pasta do painel (subpastas valem).
// O nome do arquivo segue "CTE 1234 - Oasis.pdf": o número depois de CTE liga ao CT-e e o resto do nome,
// comparado com o transportador, desempata quando há mais de um. Uma chave de 44 dígitos no nome vale sobre tudo.

import { normalizarCidade } from "./calculos.js";

export const PASTA_PDFS = "PDFs Carga Solta";

/* "CTE 1234 - Oasis.pdf" → { numero: 1234, chave: null, resto: "OASIS" }; nome que não é de CT-e → null. */
export function lerNomePdf(nome) {
  const s = String(nome ?? "");
  if (!/\.pdf$/i.test(s)) return null;
  const base = s.replace(/\.pdf$/i, "");
  const chave = base.match(/(?<!\d)\d{44}(?!\d)/)?.[0] ?? null;
  const m = base.match(/CT-?E\s*(?:N\s*[º°o.]?\s*)?[-_.:#]?\s*0*(\d{1,9})(?!\d)/i);
  if (!m && !chave) return null;
  const resto = m ? normalizarCidade(base.slice(m.index + m[0].length).replace(/[-_.:]+/g, " ")) : "";
  return { numero: m ? Number(m[1]) : null, chave, resto };
}

export function indexarPdfs(arquivos) {
  const porNumero = new Map(), porChave = new Map();
  for (const a of arquivos) {
    const l = lerNomePdf(a.nome);
    if (!l) continue;
    const item = { ...a, ...l };
    if (l.chave) porChave.set(l.chave, item);
    else if (l.numero != null) (porNumero.get(l.numero) || porNumero.set(l.numero, []).get(l.numero)).push(item);
  }
  return { porNumero, porChave };
}

/* Alguma palavra do nome do arquivo (3+ letras) está no nome do transportador. */
const palavras = s => normalizarCidade(s).split(/[^A-Z0-9]+/).filter(p => p.length >= 3);
const combina = (resto, nome) => { const n = new Set(palavras(nome)); return palavras(resto).some(p => n.has(p)); };

/* O PDF de um CT-e: { ok: true, item } | { ok: false, motivo: "nenhum" | "varios" }.
   outrosComMesmoNumero: outros CT-e da base com o mesmo número (de outro transportador). */
export function pdfDoCte(indice, cte, { nomeTransportador = "", outrosComMesmoNumero = 0 } = {}) {
  const pelaChave = indice.porChave.get(cte.chave);
  if (pelaChave) return { ok: true, item: pelaChave };
  const todos = indice.porNumero.get(cte.numero) || [];
  const cands = todos.length > 1 || outrosComMesmoNumero > 0 ? todos.filter(p => combina(p.resto, nomeTransportador)) : todos;
  if (cands.length === 1) return { ok: true, item: cands[0] };
  // vários PDFs com o número e o nome não decide: não dá para saber qual abrir
  return { ok: false, motivo: cands.length > 1 || todos.length > 1 ? "varios" : "nenhum" };
}

/* Todos os .pdf da pasta de PDFs (e subpastas); sem a pasta, lista vazia. */
export async function listarPdfs(raiz) {
  let dir;
  try { dir = await raiz.getDirectoryHandle(PASTA_PDFS); } catch (e) { return []; }
  const out = [];
  const ler = async (d, prefixo) => {
    for await (const [nome, h] of d.entries()) {
      if (h.kind === "directory") await ler(h, prefixo + nome + "/");
      else if (/\.pdf$/i.test(nome)) out.push({ nome, caminho: prefixo + nome, handle: h });
    }
  };
  await ler(dir, "");
  return out;
}
