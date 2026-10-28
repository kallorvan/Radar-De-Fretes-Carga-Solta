import { secHead } from "../ui.js";

export function renderDados(raiz, App) {
  raiz.innerHTML = `<section class="secao"><div class="wrap">${secHead("Dados")}</div></section>`;
}
