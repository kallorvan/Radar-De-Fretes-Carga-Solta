import { secHead } from "../ui.js";

export function renderCadastro(raiz, App) {
  raiz.innerHTML = `<section class="secao"><div class="wrap">${secHead("Cadastro CNPJ")}</div></section>`;
}
