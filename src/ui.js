// Peças de tela repetidas: cabeçalho de seção, dica flutuante, aviso, diálogos e tabela ordenável.

import { esc } from "./formato.js";

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const secHead = (titulo, descricao = "", etiqueta = "") =>
  `<div class="sec-head"><h2>${esc(titulo)}</h2>${descricao ? `<p>${esc(descricao)}</p>` : ""}${etiqueta ? `<span class="tag">${esc(etiqueta)}</span>` : ""}</div>`;

export function dica(html, ev) {
  const t = $("#tip");
  if (!t) return;
  if (!html) { t.style.opacity = 0; return; }
  t.innerHTML = html;
  t.style.opacity = 1;
  const w = t.offsetWidth, h = t.offsetHeight;
  const x = Math.min(ev.clientX + 14, innerWidth - w - 8), y = ev.clientY + 16 + h > innerHeight ? ev.clientY - h - 12 : ev.clientY + 16;
  t.style.left = Math.max(8, x) + "px"; t.style.top = y + "px";
}

let toastT;
export function aviso(msg, erro = false) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.className = "toast on" + (erro ? " erro" : "");
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = "toast" + (erro ? " erro" : ""); }, erro ? 9000 : 3500);
}

export function confirmar(titulo, texto, rotuloOk = "Confirmar") {
  const dlg = $("#dlg-confirma");
  $("#dlg-confirma-titulo").textContent = titulo;
  $("#dlg-confirma-texto").textContent = texto;
  $("#dlg-confirma-ok").textContent = rotuloOk;
  return new Promise(ok => {
    dlg.addEventListener("close", () => ok(dlg.returnValue === "ok"), { once: true });
    dlg.returnValue = "";
    dlg.showModal();
  });
}

/* Tabela com cabeçalho clicável: colunas = [{titulo, valor: linha => any, html: linha => string, num?}]. */
export function tabelaOrdenavel(raiz, colunas, linhas, { ordem = null, aoClicar = null, vazia = "Nada a mostrar." } = {}) {
  let col = ordem?.col ?? null, desc = ordem?.desc ?? true;
  const pintar = () => {
    const ls = col == null ? linhas : [...linhas].sort((a, b) => {
      const va = colunas[col].valor(a), vb = colunas[col].valor(b);
      const r = va == null ? 1 : vb == null ? -1 : typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return desc ? -r : r;
    });
    raiz.innerHTML = `<div class="tabela"><table><thead><tr>${colunas.map((c, i) =>
      `<th data-ordem="${i}" class="${c.num ? "num" : ""}"${col === i ? ` aria-sort="${desc ? "descending" : "ascending"}"` : ""}>${esc(c.titulo)}</th>`).join("")}</tr></thead>
      <tbody>${ls.length ? ls.map((l, i) => `<tr data-i="${linhas.indexOf(l)}"${aoClicar ? ' class="clicavel" tabindex="0"' : ""}>${colunas.map(c =>
        `<td class="${c.num ? "num" : ""}">${c.html(l)}</td>`).join("")}</tr>`).join("") :
        `<tr><td colspan="${colunas.length}" class="vazio">${esc(vazia)}</td></tr>`}</tbody></table></div>`;
    $$("th[data-ordem]", raiz).forEach(th => th.addEventListener("click", () => {
      const i = +th.dataset.ordem; desc = col === i ? !desc : true; col = i; pintar();
    }));
    if (aoClicar) $$("tbody tr[data-i]", raiz).forEach(tr => {
      const ir = () => aoClicar(linhas[+tr.dataset.i]);
      tr.addEventListener("click", ev => { if (!ev.target.closest("button,a,input")) ir(); });
      tr.addEventListener("keydown", ev => { if (ev.key === "Enter") ir(); });
    });
  };
  pintar();
}

/* <option>s a partir de [valor, rótulo]; o valor atual fica selecionado. */
export const opcoes = (pares, atual, vazio = "Todos") =>
  `<option value="">${esc(vazio)}</option>` + pares.map(([v, r]) => `<option value="${esc(v)}"${v === atual ? " selected" : ""}>${esc(r)}</option>`).join("");
