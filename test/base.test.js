import { test } from "node:test";
import assert from "node:assert/strict";
import {
  novaBase, validarCampos, incluir, corrigir, excluir, restaurar,
  cadastrarCnpj, nomeDoCnpj, grupoDoCnpj, registrar, migrarBase, classificar,
  cadastrarProduto, cadastrarUnidade, definirProdutoPadrao, unidadeDe, produtoDe, definirCorte, relancar,
} from "../src/base.js";
import { CHAVE, campos, chaveN } from "./ajuda.js";

const AGORA = "2026-10-28T12:00:00.000Z";

test("incluir calcula e registra quem e quando", () => {
  const d = novaBase();
  const r = incluir(d, campos(), "Ana", AGORA);
  assert.equal(r.ok, true);
  assert.equal(r.cte.precoTonelada, 175);
  assert.equal(r.cte.pesoKg, 50000);
  assert.equal(r.cte.produto, "ACUCAR");
  assert.equal(r.cte.tarifa, 8750);
  assert.equal(r.cte.origem, "SAO JOAQUIM DA BARRA");
  assert.equal(r.cte.criadoPor, "Ana");
  assert.equal(r.cte.criadoEm, AGORA);
  assert.equal(r.cte.origemLancamento, "formulario");
  assert.equal(d.ctes.length, 1);
  assert.equal(d.log.at(-1).acao, "incluir");
  assert.equal(d.log.at(-1).quem, "Ana");
});

test("incluir bloqueia chave repetida e devolve o existente", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  const r = incluir(d, campos({ valorFrete: 1 }), "Bia", AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.existente.numero, 10600);
  assert.equal(d.ctes.length, 1);
});

test("chave na lixeira também bloqueia", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  excluir(d, CHAVE, "Ana", AGORA);
  const r = incluir(d, campos(), "Ana", AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.naLixeira, true);
});

test("validarCampos exige quantidade, frete, produto e unidade", () => {
  const d = novaBase();
  const v = validarCampos(d, campos({ quantidade: 0, valorFrete: null, produto: "", unidade: "XYZ" }));
  assert.equal(v.ok, false);
  assert.equal(v.erros.quantidade, "Informe a quantidade.");
  assert.ok(v.erros.valorFrete);
  assert.equal(v.erros.produto, "Escolha o produto.");
  assert.equal(v.erros.unidade, "Escolha a unidade.");
  assert.equal(validarCampos(d, campos({ chave: "123" })).erros.chave, "Chave de acesso precisa ter 44 dígitos.");
  assert.equal(validarCampos(d, campos()).ok, true);
});

test("big bag exige peso", () => {
  const d = novaBase();
  assert.equal(validarCampos(d, campos({ unidade: "BAG" })).erros.pesoKg, "Informe o peso total do CT-e (kg).");
  assert.equal(validarCampos(d, campos({ unidade: "BAG", pesoKg: 30000 })).ok, true);
  assert.equal(validarCampos(d, campos({ pesoInformado: true, pesoKg: 0 })).erros.pesoKg, "Informe o peso total do CT-e (kg).");
});

test("listas iniciais e versão 3", () => {
  const d = novaBase();
  assert.equal(d.versao, 3);
  assert.deepEqual(unidadeDe(d, "SC60"), { id: "SC60", nome: "Saca 60 kg", kg: 60, saca: true });
  assert.equal(unidadeDe(d, "BAG").kg, null);
  assert.equal(produtoDe(d, "ACUCAR").nome, "Açúcar");
});

test("incluir com campos inválidos devolve erros e não grava", () => {
  const d = novaBase();
  const r = incluir(d, campos({ quantidade: 0 }), "Ana", AGORA);
  assert.equal(r.ok, false);
  assert.ok(r.erros.quantidade);
  assert.equal(d.ctes.length, 0);
});

test("corrigir recalcula e não troca a chave", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  const r = corrigir(d, CHAVE, campos({ chave: "9".repeat(44), quantidade: 70 }), "Bia", "2026-10-29T00:00:00.000Z");
  assert.equal(r.ok, true);
  assert.equal(r.cte.chave, CHAVE);
  assert.equal(r.cte.precoTonelada, 125);
  assert.equal(r.cte.criadoPor, "Ana");
  assert.equal(r.cte.alteradoPor, "Bia");
  assert.equal(d.log.at(-1).acao, "corrigir");
});

test("excluir manda para a lixeira e restaurar devolve", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  assert.equal(excluir(d, CHAVE, "Bia", AGORA).ok, true);
  assert.equal(d.ctes.length, 0);
  assert.equal(d.lixeira[0].excluidoPor, "Bia");
  assert.equal(restaurar(d, CHAVE, "Caio", AGORA).ok, true);
  assert.equal(d.ctes.length, 1);
  assert.equal(d.lixeira.length, 0);
  assert.deepEqual(d.log.map(l => l.acao), ["incluir", "excluir", "restaurar"]);
});

test("grupo usa o nome da matriz e junta filiais", () => {
  const d = novaBase();
  cadastrarCnpj(d, "07668709000290", "atma filial ", "Ana", AGORA);
  cadastrarCnpj(d, "07.668.709/0001-09", "ATMA LOGISTICA", "Ana", AGORA);
  assert.equal(nomeDoCnpj(d, "07668709000290"), "ATMA FILIAL");
  assert.deepEqual(grupoDoCnpj(d, "07668709000290"), { raiz: "07668709", nome: "ATMA LOGISTICA" });
  assert.deepEqual(grupoDoCnpj(d, "11111111000100"), { raiz: "11111111", nome: "CNPJ 11.111.111/0001-00" });
});

test("cadastrar renomeia sem duplicar", () => {
  const d = novaBase();
  cadastrarCnpj(d, "07668709000109", "A", "Ana", AGORA);
  cadastrarCnpj(d, "07668709000109", "B", "Ana", AGORA);
  assert.equal(d.cnpjs.length, 1);
  assert.equal(nomeDoCnpj(d, "07668709000109"), "B");
});

test("log guarda só as 500 últimas", () => {
  const d = novaBase();
  for (let i = 0; i < 510; i++) registrar(d, "cadastro", "Ana", AGORA, "", "x" + i);
  assert.equal(d.log.length, 500);
  assert.equal(d.log[0].resumo, "x10");
});

test("migrarBase converte v1 sem perder nada", () => {
  const v1 = { versao: 1, salvoEm: "x", salvoPor: "Ana", cnpjs: [{ cnpj: "1", nome: "A" }], log: [{ acao: "incluir" }],
    ctes: [{ chave: "a", numero: 1, sacas: 50, tarifa: 8750, precoSaca: 175 }],
    lixeira: [{ cte: { chave: "b", numero: 2, sacas: 20, tarifa: 100, precoSaca: 5 }, excluidoPor: "Bia", excluidoEm: "y" }] };
  const d = migrarBase(v1);
  assert.equal(d.versao, 3);
  assert.equal(d.ctes.length, 1);
  assert.deepEqual([d.ctes[0].quantidade, d.ctes[0].produto, d.ctes[0].unidade, d.ctes[0].pesoKg, d.ctes[0].precoTonelada, d.ctes[0].precoSaca],
    [50, null, null, null, null, null]);
  assert.equal("sacas" in d.ctes[0], false);
  assert.equal(d.lixeira[0].cte.quantidade, 20);
  assert.equal(d.unidades.length, 4);
  assert.equal(d.produtos.length, 2);
  assert.equal(v1.versao, 1, "não muda o original");
  assert.deepEqual(migrarBase(d), d, "v2 fica igual");
});

test("classificar recalcula e registra", () => {
  const d = migrarBase({ versao: 1, ctes: [{ chave: "a", numero: 1, sacas: 540, valorFrete: 17353.56, valorSeguro: 0, adicionais: 0, tarifa: 17353.56, precoSaca: 32.14 }], cnpjs: [], lixeira: [], log: [] });
  const r = classificar(d, "a", { produto: "CAFE", unidade: "SC60" }, "Ana", AGORA);
  assert.equal(r.ok, true);
  assert.equal(d.ctes[0].precoTonelada, 535.6);
  assert.equal(d.ctes[0].precoSaca, 32.14);
  assert.equal(d.log.at(-1).acao, "classificar");
  assert.equal(classificar(d, "a", { produto: "CAFE", unidade: "BAG" }, "Ana", AGORA).ok, false, "big bag sem peso");
});

test("unidade em uso não muda de kg", () => {
  const d = novaBase();
  incluir(d, campos({ unidade: "SC60" }), "Ana", AGORA);
  assert.equal(cadastrarUnidade(d, { id: "SC60", nome: "Saca de 60 kg", kg: 60, saca: true }, "Ana", AGORA).ok, true);
  assert.equal(unidadeDe(d, "SC60").nome, "Saca de 60 kg");
  const r = cadastrarUnidade(d, { id: "SC60", nome: "Saca", kg: 50, saca: true }, "Ana", AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.erro, "Unidade em uso: crie outra para um peso diferente.");
  assert.equal(cadastrarUnidade(d, { id: "TON", nome: "Tonelada", kg: 900, saca: false }, "Ana", AGORA).ok, true, "TON não está em uso");
  const nova = cadastrarUnidade(d, { nome: "Fardo 200 kg", kg: 200, saca: false }, "Ana", AGORA);
  assert.equal(nova.id, "FARDO200KG");
});

test("cadastrarProduto gera id e renomeia", () => {
  const d = novaBase();
  const r = cadastrarProduto(d, { nome: "Algodão em pluma" }, "Ana", AGORA);
  assert.equal(r.id, "ALGODAOEMPLUMA");
  cadastrarProduto(d, { id: "ALGODAOEMPLUMA", nome: "Algodão" }, "Ana", AGORA);
  assert.equal(produtoDe(d, "ALGODAOEMPLUMA").nome, "Algodão");
  assert.equal(d.produtos.length, 3);
  assert.equal(d.log.at(-1).acao, "produto");
});

test("produto padrão do CNPJ", () => {
  const d = novaBase();
  cadastrarCnpj(d, "07668709000109", "EISA", "Ana", AGORA);
  definirProdutoPadrao(d, "07668709000109", "CAFE", "Ana", AGORA);
  assert.equal(d.cnpjs[0].produtoPadrao, "CAFE");
  definirProdutoPadrao(d, "07668709000109", null, "Ana", AGORA);
  assert.equal(d.cnpjs[0].produtoPadrao, null);
});

test("migração v1 semeia o produto padrão pelo nome do cliente", () => {
  const d = migrarBase({ versao: 1, ctes: [], lixeira: [], log: [], cnpjs: [{ cnpj: "1", nome: "USINA ALTA MOGIANA S/A" }, { cnpj: "2", nome: "EISA" }, { cnpj: "3", nome: "COLOMBARI" }] });
  assert.deepEqual(d.cnpjs.map(c => c.produtoPadrao ?? null), ["ACUCAR", "CAFE", null]);
});

test("CT-e com sacas dentro de base v2 (gravado pelo painel antigo) é normalizado", () => {
  const d = novaBase();
  incluir(d, campos({ quantidade: 50 }), "Ana", AGORA);            // açúcar em tonelada, R$ 175/t
  const c = d.ctes[0];
  // o painel antigo corrigiu: gravou sacas e recalculou a tarifa, sem saber de quantidade/peso
  Object.assign(c, { sacas: 40, valorFrete: 8000, tarifa: 8000, precoSaca: 200 });
  const v1novo = { chave: "9".repeat(44), numero: 9, sacas: 30, tarifa: 900, valorFrete: 900, precoSaca: 30 };   // lançado no painel antigo
  d.ctes.push(v1novo);
  const m = migrarBase(d);
  const [a, b] = m.ctes;
  assert.equal("sacas" in a, false);
  assert.deepEqual([a.quantidade, a.pesoKg, a.precoTonelada, a.precoSaca], [40, 40000, 200, null]);
  assert.deepEqual([b.quantidade, b.produto, b.unidade, b.precoTonelada], [30, null, null, null]);
  assert.equal("sacas" in b, false);
});

test("classificar exige quantidade quando o peso sai da unidade", () => {
  const d = migrarBase({ versao: 2, ctes: [{ chave: "a", numero: 1, tarifa: 100, valorFrete: 100, quantidade: null }], cnpjs: [], lixeira: [], log: [] });
  const r = classificar(d, "a", { produto: "CAFE", unidade: "SC60" }, "Ana", AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.erros.quantidade, "Informe a quantidade.");
});

test("incluir produto ou unidade com nome existente é recusado", () => {
  const d = novaBase();
  assert.equal(cadastrarProduto(d, { nome: "cafe" }, "Ana", AGORA, { novo: true }).ok, false);
  assert.equal(produtoDe(d, "CAFE").nome, "Café");
  const r = cadastrarUnidade(d, { nome: "BAG", kg: 800, saca: false }, "Ana", AGORA, { novo: true });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Já existe/);
  assert.equal(unidadeDe(d, "BAG").kg, null);
  assert.equal(cadastrarUnidade(d, { nome: "big bag" }, "Ana", AGORA, { novo: true }).ok, false, "mesmo nome sem acento/caixa");
});

test("incluir grava o seguro informado e a taxa calculada", () => {
  const d = novaBase();
  const r = incluir(d, campos({ valorAssegurado: "917.213,08", valorSeguro: "458,61", valorFrete: 9208.61 }), "Ana", AGORA);
  assert.equal(r.cte.valorSeguro, 458.61);
  assert.equal(r.cte.taxaSeguro, 0.0005);
  assert.equal(r.cte.tarifa, 8750);
});

test("migrar v2 → v3 mantém o seguro e recalcula a taxa a partir dele", () => {
  const cte = { chave: "a", numero: 1, emissao: "2026-08-02", valorAssegurado: 917213.08, taxaSeguro: 0.0007, valorSeguro: 458.61,
    valorFrete: 1000, adicionais: 0, tarifa: 541.39, quantidade: 1, produto: null, unidade: null, pesoKg: null, pesoInformado: false };
  const r = migrarBase({ versao: 2, ctes: [cte, { ...cte, chave: "b", valorAssegurado: 0, valorSeguro: 0 }], cnpjs: [], lixeira: [], log: [] });
  assert.equal(r.ctes[0].valorSeguro, 458.61);
  assert.equal(r.ctes[0].taxaSeguro, 0.0005);
  assert.equal(r.ctes[1].taxaSeguro, null);
});

test("o CNPJ do transportador sai da chave; diferente da chave é erro", () => {
  const d = novaBase(), c = campos();
  const sem = validarCampos(d, { ...c, cnpjTransportador: "" });
  assert.equal(sem.ok, true);
  assert.equal(sem.campos.cnpjTransportador, "05780969000146");
  const outro = validarCampos(d, { ...c, cnpjTransportador: "11111111000100" });
  assert.equal(outro.erros.cnpjTransportador, "O CNPJ do transportador não bate com a chave de acesso.");
});

test("o itinerário é sempre o do cadastro do Rodopar", () => {
  const d = novaBase();
  assert.equal(incluir(d, campos({ origem: "Araras", destino: "Santos", itinerario: "XYZ" }), "Ana", AGORA).cte.itinerario, "ARRSAN");
  assert.equal(incluir(d, campos({ chave: chaveN(2), numero: 2, itinerario: "XYZ" }), "Ana", AGORA).cte.itinerario, "", "São Joaquim da Barra não está nas abas");
});

test("migrar v2 → v3 preenche o itinerário vazio e mantém o preenchido", () => {
  const cte = { chave: "a", numero: 1, emissao: "2026-08-02", origem: "ARARAS", destino: "SANTOS", itinerario: "", valorAssegurado: 0, valorSeguro: 0,
    valorFrete: 1000, adicionais: 0, tarifa: 1000, quantidade: 1, produto: null, unidade: null, pesoKg: null, pesoInformado: false };
  const r = migrarBase({ versao: 2, ctes: [cte, { ...cte, chave: "b", itinerario: "OUTRO" }], cnpjs: [], lixeira: [], log: [] });
  assert.equal(r.ctes[0].itinerario, "ARRSAN");
  assert.equal(r.ctes[1].itinerario, "OUTRO");
});

test("corrigir não apaga o itinerário guardado quando a rota não muda e a regra dá em branco", () => {
  const d = novaBase();
  const { cte } = incluir(d, campos({ origem: "Cacoal", destino: "Santos" }), "Ana", AGORA);
  assert.equal(cte.itinerario, "", "cidade fora do cadastro: a regra não tem código");
  cte.itinerario = "CCLSAN";   // código que veio da base antiga
  corrigir(d, cte.chave, campos({ origem: "Cacoal", destino: "Santos", quantidade: 60 }), "Ana", AGORA);
  assert.equal(d.ctes[0].itinerario, "CCLSAN");
  corrigir(d, cte.chave, campos({ origem: "Araras", destino: "Santos" }), "Ana", AGORA);
  assert.equal(d.ctes[0].itinerario, "ARRSAN", "rota mudou: vale a regra");
  corrigir(d, cte.chave, campos({ origem: "Cacoal", destino: "Santos" }), "Ana", AGORA);
  assert.equal(d.ctes[0].itinerario, "", "rota mudou para cidade sem código");
});

test("chave com 43 dígitos: só o erro da chave, sem erro no CNPJ que sairia dela", () => {
  const v = validarCampos(novaBase(), { ...campos(), chave: campos().chave.slice(1), cnpjTransportador: "" });
  assert.ok(v.erros.chave);
  assert.equal(v.erros.cnpjTransportador, undefined);
});

test("migrar v2 → v3 mantém a taxa digitada quando ela reproduz o seguro guardado", () => {
  const base = { numero: 1, emissao: "2026-08-02", origem: "A", destino: "B", itinerario: "", valorFrete: 1000, adicionais: 0, tarifa: 999.98,
    quantidade: 1, produto: null, unidade: null, pesoKg: null, pesoInformado: false };
  const r = migrarBase({ versao: 2, cnpjs: [], lixeira: [], log: [], ctes: [
    { ...base, chave: "a", valorAssegurado: 100, taxaSeguro: 0.00015, valorSeguro: 0.02 },
    { ...base, chave: "b", valorAssegurado: 386140, taxaSeguro: 0.0005, valorSeguro: 193 }] });
  assert.equal(r.ctes[0].taxaSeguro, 0.00015, "a taxa digitada dá o seguro guardado: fica");
  assert.equal(r.ctes[1].taxaSeguro, 0.0005, "seguro digitado diferente: taxa recalculada do seguro (193 / 386140 = 0,0005)");
});

test("salvar a mesma data de corte não vira alteração", () => {
  const d = novaBase(), antes = d.log.length;
  const r = definirCorte(d, "2026-08-01", "Ana", AGORA);
  assert.equal(r.ok, true);
  assert.equal(r.mudou, false);
  assert.equal(d.log.length, antes);
});

test("base v3 aberta preenche o itinerário em branco que a tabela atual já sabe", () => {
  const cte = { chave: "a", numero: 1, emissao: "2026-08-02", origem: "MACHADO", destino: "VARGINHA", itinerario: "", valorAssegurado: 0, valorSeguro: 0,
    valorFrete: 1000, adicionais: 0, tarifa: 1000, quantidade: 1, produto: null, unidade: null, pesoKg: null, pesoInformado: false };
  const r = migrarBase({ ...novaBase(), ctes: [cte, { ...cte, chave: "b", itinerario: "OUTRO" }], lixeira: [{ cte: { ...cte, chave: "c" } }] });
  assert.equal(r.ctes[0].itinerario, "MCHVGH");
  assert.equal(r.ctes[1].itinerario, "OUTRO");
  assert.equal(r.lixeira[0].cte.itinerario, "MCHVGH");
});

test("relancar tira da lixeira e lança de novo com os dados novos, registrando as duas coisas", () => {
  const d = novaBase();
  incluir(d, campos({ valorFrete: 8750 }), "Ana", AGORA);
  excluir(d, CHAVE, "Ana", AGORA);
  assert.equal(incluir(d, campos({ valorFrete: 9000 }), "Bia", AGORA).naLixeira, true, "lançar direto continua avisando");
  const r = relancar(d, campos({ valorFrete: 9000 }), "Bia", AGORA);
  assert.equal(r.ok, true);
  assert.equal(d.lixeira.length, 0);
  assert.equal(d.ctes.length, 1);
  assert.equal(d.ctes[0].tarifa, 9000);
  assert.equal(d.ctes[0].criadoPor, "Bia");
  assert.deepEqual(d.log.slice(-2).map(l => l.acao), ["tirar-lixeira", "incluir"]);
});

test("relancar com dados inválidos não mexe na lixeira", () => {
  const d = novaBase();
  incluir(d, campos(), "Ana", AGORA);
  excluir(d, CHAVE, "Ana", AGORA);
  const r = relancar(d, campos({ valorFrete: "" }), "Bia", AGORA);
  assert.equal(r.ok, false);
  assert.ok(r.erros.valorFrete);
  assert.equal(d.lixeira.length, 1);
});
