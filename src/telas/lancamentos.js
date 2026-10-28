import { secHead } from "../ui.js";

export function renderLancamentos(raiz, App) {
  raiz.innerHTML = `<section class="secao"><div class="wrap">${secHead("Lançamentos")}</div></section>`;
}
