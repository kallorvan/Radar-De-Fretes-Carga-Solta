// Base fictícia: rota A → B com 3 transportadores (UM tem filial), meses 01, 02 e 04; rota C → B com 1 CT-e.
import { novaBase, incluir, cadastrarCnpj } from "../../src/base.js";
import { campos, chaveN } from "../ajuda.js";

const AGORA = "2026-10-28T12:00:00.000Z";
export const T1 = "11111111000100", T1F = "11111111000290", T2 = "22222222000100", T3 = "33333333000100";

export function baseExemplo() {
  const d = novaBase();
  for (const [c, n] of [[T1, "TRANSPORTES UM"], [T2, "TRANSPORTES DOIS"], [T3, "TRANSPORTES TRES"], [T1F, "TRANSPORTES UM FILIAL"],
    ["44209336003583", "USINA ALTA MOGIANA"]]) cadastrarCnpj(d, c, n, "Ana", AGORA);
  let n = 0;
  const lanca = extra => incluir(d, campos({ chave: chaveN(++n), numero: n, origem: "A", destino: "B", ...extra }), "Ana", AGORA);
  lanca({ cnpjTransportador: T1, emissao: "2026-01-05", valorFrete: 8750 });   // 175
  lanca({ cnpjTransportador: T1F, emissao: "2026-01-20", valorFrete: 9250 });  // 185
  lanca({ cnpjTransportador: T2, emissao: "2026-01-10", valorFrete: 8500 });   // 170
  lanca({ cnpjTransportador: T1, emissao: "2026-02-10", valorFrete: 9000 });   // 180
  lanca({ cnpjTransportador: T3, emissao: "2026-02-11", valorFrete: 8000 });   // 160
  lanca({ cnpjTransportador: T1, emissao: "2026-04-02", valorFrete: 9500 });   // 190
  lanca({ cnpjTransportador: T2, emissao: "2026-03-02", valorFrete: 5000, origem: "C" });
  d.salvoEm = "2026-10-28T09:00:00.000Z"; d.salvoPor = "Ana";
  return d;
}
