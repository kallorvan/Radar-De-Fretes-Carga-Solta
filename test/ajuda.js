// Dados fictícios compartilhados pelos testes.
export const CHAVE = "35260105780969000146570010000106001000120718";
export const chaveN = n => "352601057809690001465700100" + String(n).padStart(8, "0") + "100012071";

export const campos = (extra = {}) => ({
  chave: CHAVE, numero: 10600, emissao: "2026-01-10",
  cnpjTransportador: "05780969000146", cnpjCliente: "44209336003583",
  origem: "São Joaquim da Barra", destino: "Santos", itinerario: "",
  valorAssegurado: 119322.29, taxaSeguro: 0, valorFrete: 8750, adicionais: 0,
  produto: "ACUCAR", unidade: "TON", quantidade: 50, vpo: false, observacoes: "", ...extra,
});
