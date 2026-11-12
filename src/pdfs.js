// PDFs dos CT-e lançados, na pasta "PDFs Carga Solta" (onde se salva) e na "Registrados" (organizados por mês),
// as duas dentro da pasta do painel (subpastas valem).
// O nome do arquivo segue "CTE 1234 - Oasis.pdf": o número depois de CTE liga ao CT-e e o resto do nome,
// comparado com o transportador, desempata quando há mais de um. Uma chave de 44 dígitos no nome vale sobre tudo.

import { normalizarCidade } from "./calculos.js";

export const PASTA_PDFS = "PDFs Carga Solta";
export const PASTA_REGISTRADOS = "Registrados";

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

/* Todos os .pdf da pasta do painel e de todas as subpastas (PDFs Carga Solta, Registrados ou qualquer outra),
   como no Radar Container: o PDF é achado onde quer que esteja. O caminho parte da pasta do painel.
   Pastas ocultas (nome começando com ".") ficam de fora. Erro de leitura (permissão, por exemplo) sobe para
   quem chamou, para virar aviso: antes ele era engolido e a lista saía vazia sem explicação. */
export async function listarPdfs(raiz) {
  const out = [];
  const ler = async (d, prefixo) => {
    for await (const [nome, h] of d.entries()) {
      if (nome.startsWith(".")) continue;
      if (h.kind === "directory") await ler(h, prefixo + nome + "/");
      else if (/\.pdf$/i.test(nome)) out.push({ nome, caminho: prefixo + nome, handle: h, pai: d });
    }
  };
  await ler(raiz, "");
  return out;
}

/* ---- Organizar por mês: Registrados/1 - Janeiro_2026/, na pasta do painel ---- */
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/* "2026-01" → "1 - Janeiro_2026" (o número do mês na frente põe as pastas em ordem). */
export function pastaDoMes(mes) {
  const m = /^(\d{4})-(\d{2})/.exec(String(mes ?? ""));
  const n = m ? Number(m[2]) : 0;
  if (!m || n < 1 || n > 12) return null;
  return `${n} - ${MESES[n - 1]}_${m[1]}`;
}

/* Mês de emissão pela chave de acesso: dígitos 3 a 6 são AAMM. */
export function mesDaChave(chave) {
  const m = /^\d{2}(\d{2})(\d{2})\d{38}$/.exec(String(chave ?? ""));
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `20${m[1]}-${m[2]}` : null;
}

/* Para onde vai cada PDF. O mês sai da emissão do CT-e ligado ao PDF (o mesmo vínculo do botão PDF);
   sem CT-e na base, da chave no nome do arquivo. Nada é movido aqui.
   → { mover: [{ item, pasta }], noLugar, semMes: [item], duplicados: [item] } */
export function planejarOrganizacao(lista, ctes, nomeTransportador = () => "") {
  const indice = indexarPdfs(lista);
  const mesmoNumero = new Map();
  for (const c of ctes) mesmoNumero.set(c.numero, (mesmoNumero.get(c.numero) || 0) + 1);
  const mesDe = new Map();   // caminho → mês; null quando dois CT-e de meses diferentes apontam o mesmo PDF
  for (const c of ctes) {
    const r = pdfDoCte(indice, c, { nomeTransportador: nomeTransportador(c) || "", outrosComMesmoNumero: (mesmoNumero.get(c.numero) || 1) - 1 });
    if (!r.ok) continue;
    const mes = String(c.emissao ?? "").slice(0, 7);
    const ja = mesDe.get(r.item.caminho);
    mesDe.set(r.item.caminho, ja === undefined || ja === mes ? mes : null);
  }
  const plano = { mover: [], noLugar: 0, semMes: [], duplicados: [] };
  const destinos = new Set();
  for (const item of lista) {
    const l = lerNomePdf(item.nome);
    const pasta = pastaDoMes(mesDe.has(item.caminho) ? mesDe.get(item.caminho) : mesDaChave(l?.chave));
    if (!pasta) { plano.semMes.push(item); continue; }
    const destino = `${PASTA_REGISTRADOS}/${pasta}/${item.nome}`;
    if (item.caminho === destino) { plano.noLugar++; continue; }
    // dois arquivos com o mesmo nome indo para a mesma pasta: só o primeiro vai
    if (destinos.has(destino) || lista.some(o => o.caminho === destino)) { plano.duplicados.push(item); continue; }
    destinos.add(destino);
    plano.mover.push({ item, pasta });
  }
  return plano;
}

/* Move os PDFs do plano. Usa move() quando o navegador tem; senão copia, confere o tamanho e só então
   apaga o original. Arquivo com o mesmo nome já na pasta do mês não é sobrescrito.
   → { movidos, falhas: [{ item, motivo }] } */
export async function executarOrganizacao(raiz, plano) {
  const reg = await raiz.getDirectoryHandle(PASTA_REGISTRADOS, { create: true });
  const out = { movidos: 0, falhas: [] };
  for (const { item, pasta } of plano.mover) {
    try {
      const dest = await reg.getDirectoryHandle(pasta, { create: true });
      let existe = true;
      try { await dest.getFileHandle(item.nome); } catch (e) { existe = false; }
      if (existe) { out.falhas.push({ item, motivo: "já existe um arquivo com esse nome na pasta do mês" }); continue; }
      let movido = false;
      if (typeof item.handle.move === "function") {
        try { await item.handle.move(dest); movido = true; } catch (e) { /* cai na cópia */ }
      }
      if (!movido) {
        const arq = await item.handle.getFile();
        const novo = await dest.getFileHandle(item.nome, { create: true });
        const w = await novo.createWritable();
        await w.write(arq);
        await w.close();
        const copia = await novo.getFile();
        if (copia.size !== arq.size) { await dest.removeEntry(item.nome); throw new Error("a cópia não ficou completa"); }
        await item.pai.removeEntry(item.nome);
      }
      out.movidos++;
    } catch (e) { out.falhas.push({ item, motivo: e?.message || e?.name || "erro" }); }
  }
  return out;
}
