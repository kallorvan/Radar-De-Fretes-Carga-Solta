// Aba e filtros no endereço (#evolucao?rota=…), para mandar um link já filtrado.

export const ABAS = ["evolucao", "rotas", "lancamentos", "cadastro", "dados"];
const CHAVES = ["rota", "produto", "transportador", "cliente", "itinerario", "mesIni", "mesFim", "metrica", "mediana"];
const METRICAS = ["tonelada", "saca", "tarifa"];

export function lerHash(hash) {
  const [aba, q = ""] = String(hash || "").replace(/^#/, "").split("?");
  const filtros = {};
  for (const [k, v] of new URLSearchParams(q)) if (CHAVES.includes(k) && v) filtros[k] = v;
  if (!METRICAS.includes(filtros.metrica)) filtros.metrica = "tonelada";
  if (filtros.mediana !== "0") delete filtros.mediana;   // a mediana do mês aparece por padrão: só "desligada" vai no endereço
  return { aba: ABAS.includes(aba) ? aba : "evolucao", filtros };
}

export function escreverHash(aba, filtros = {}) {
  const partes = CHAVES.filter(k => filtros[k] && !(k === "metrica" && filtros[k] === "tonelada"))
    .map(k => `${k}=${encodeURIComponent(filtros[k])}`);
  return "#" + aba + (partes.length ? "?" + partes.join("&") : "");
}
