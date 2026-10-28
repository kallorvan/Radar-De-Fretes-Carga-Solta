// Produto de costume pelo nome do cliente: a sugestão inicial do "produto padrão" de cada CNPJ.
// Sem dependências, para a base (migração) e a classificação poderem usar.

const CLIENTES = {
  CAFE: ["EISA", "STONEX", "OLAM", "LOUIS DREYFUS", "SUCAFINA", "EXPOCACER", "UNICAFE", "COFCO", "RS TRADE", "NOVO RUMO", "ALTO CAFEZAL"],
  ACUCAR: ["USINA", "ACUCAR", "COPLASA", "CENTRAL ENERGETICA", "BIOENERGETICA", "COLOMBO AGROINDUSTRIA", "NARDINI"],
};
const semAcento = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

export function sugerirProdutoCliente(nome) {
  const n = semAcento(nome);
  for (const [produto, chaves] of Object.entries(CLIENTES)) if (chaves.some(k => n.includes(k))) return produto;
  return null;
}
