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
  d.corte = null;   // os CT-e de exemplo são de janeiro a abril: sem corte, todos entram na análise
  return d;
}

/* A mesma base com 3 CT-e de café em sacas de 60 kg na rota A → B (R$ ~536/t). */
export function baseCafeEAcucar() {
  const d = baseExemplo();
  let n = 100;
  for (const [f, dia] of [[17353.56, "05"], [17300, "12"], [17400, "20"]])
    incluir(d, campos({ chave: chaveN(++n), numero: n, origem: "A", destino: "B", cnpjTransportador: T3, emissao: `2026-04-${dia}`,
      valorFrete: f, quantidade: 540, unidade: "SC60", produto: "CAFE" }), "Ana", AGORA);
  return d;
}

/* Base v1 (painel antigo) com 4 CT-e: 3 de clientes com produto conhecido e 1 de cliente transportador. */
export function baseV1ParaClassificar() {
  const cte = (n, cli, quantidade, valorFrete) => ({ chave: chaveN(200 + n), numero: 200 + n, emissao: "2026-07-01", cnpjCliente: cli,
    cnpjTransportador: T1, origem: "A", destino: "B", itinerario: "", valorAssegurado: 0, taxaSeguro: 0, valorSeguro: 0, adicionais: 0,
    valorFrete, tarifa: valorFrete, sacas: quantidade, precoSaca: valorFrete / quantidade, vpo: false, observacoes: "",
    criadoPor: "Ana", criadoEm: AGORA, origemLancamento: "importacao" });
  return { versao: 1, corte: null, salvoEm: "2026-10-28T09:00:00.000Z", salvoPor: "Ana", log: [], lixeira: [],
    // base v1 real: nenhum CNPJ tem produto padrão; a migração semeia pelo nome
    cnpjs: [{ cnpj: "44209336003583", nome: "USINA ALTA MOGIANA S/A" }, { cnpj: "55555555000100", nome: "EISA" },
      { cnpj: "66666666000100", nome: "COLOMBARI SERVIÇOS DE TRANSPORTES LTDA" }, { cnpj: T1, nome: "TRANSPORTES UM" }],
    ctes: [cte(1, "44209336003583", 50, 8750), cte(2, "44209336003583", 1080, 9612), cte(3, "55555555000100", 540, 17353.56), cte(4, "66666666000100", 50, 6900)] };
}
