# Adendo · Produto, unidade de medida e preço por tonelada

Data: 2026-10-29 · Status: aguardando revisão · Altera: `2026-10-28-radar-carga-solta-design.md`

## 1. Por quê

O campo "Qt. sacas" da planilha mistura unidades. Os números pequenos são toneladas:

| Rota (produto) | Como estava | Por tonelada |
|---|---|---|
| Usina → Santos (açúcar) | 50 "sacas" × R$ 175 | R$ 175/t |
| Usina → Santos (açúcar) | 1.080 sacas de 50 kg × R$ 8,90 (54 t) | R$ 178/t |
| LEM → Machado (café) | 20 "sacas" × R$ 541 | R$ 541/t |
| LEM → Machado (café) | 540 sacas de 60 kg × R$ 32,14 (32,4 t) | R$ 536/t |

Em R$/saca esses CT-e parecem fora de faixa (27 exceções hoje). Em R$/t eles se alinham. Por isso:

- cada CT-e passa a ter **produto**, **unidade** e **peso**;
- a métrica principal passa a ser **R$/t**.

## 2. Decisões

| # | Decisão |
|---|---|
| 1 | Métrica principal: **R$/t**. O seletor fica `R$/t \| R$/saca \| Tarifa R$`. R$/saca só considera CT-e lançados em unidade do tipo saca. |
| 2 | **Peso total (kg)** = quantidade × kg da unidade, preenchido sozinho. Pode ser sobrescrito pelo peso do CT-e. |
| 3 | Produtos e unidades em **listas cadastráveis** no painel. Começam com: **Café** e **Açúcar**; **Saca 60 kg**, **Saca 50 kg**, **Tonelada** (1.000 kg) e **Big bag** (sem peso padrão: o peso é obrigatório no CT-e). |
| 4 | Os 195 CT-e importados recebem produto e unidade por uma **regra automática revisada antes de aplicar**: produto pelo cliente; unidade pela quantidade (≤ 100 → Tonelada; > 100 → saca de 60 kg para café e de 50 kg para açúcar). O que a regra não classifica fica "a classificar". |
| 5 | **Filtro de produto** na Evolução e nas Rotas. Uma rota com mais de um produto mostra aviso sugerindo filtrar. |

## 3. Suposições (corrija se alguma estiver errada)

- **Produto padrão do cliente.** O cadastro de CNPJ ganha o campo opcional *produto padrão*. É ele que a regra do item 4 usa, e ele também preenche o produto no formulário quando o cliente é escolhido. A sugestão inicial vem do nome e do histórico:
  - café: EISA, Stonex, Olam, Louis Dreyfus, Sucafina, Expocacer, Unicafé, Cofco, RS Trade, Novo Rumo, Alto Cafezal;
  - açúcar: as usinas, U.S.J., Coplasa, Central Energética, Bioenergética Vale do Paracatu, Colombo, Nardini.
  
  Os clientes que são transportadoras (Colombari, R S G, Das Neves, Agius, Ochiliski, JF Pereira, Sandrin, Nelcar) ficam sem produto padrão. Os CT-e deles entram em "a classificar" e você decide um a um na revisão.
- **Importações futuras** da planilha passam pela mesma revisão. A planilha não tem colunas de produto e unidade; se um dia tiver (`PRODUTO`, `UNIDADE`, `PESO (KG)`), elas são lidas e valem sobre a regra.
- **Nomes dos campos.** "Qt. sacas" vira **Quantidade**. O nome antigo continua aceito na importação.
- **A exceção de preço fora da faixa** passa a ser calculada em R$/t, por **rota + produto**. Ganha uma exceção nova: *a classificar* (sem produto ou sem peso).
- **Exportação para Excel:** acrescenta no fim as colunas `PRODUTO`, `UNIDADE`, `PESO (KG)` e `PREÇO POR TONELADA`. As colunas antigas ficam iguais.
- **Arquivo de dados:** a `versao` passa de 1 para 2. Ao abrir uma base versão 1, o painel acrescenta os campos vazios (produto e unidade "a classificar") e pede a revisão. Nada é perdido.

## 4. Modelo de dados (alterações)

```js
Cte += {
  produto: "CAFE" | "ACUCAR" | … | null,   // id do cadastro de produtos
  unidade: "SC60" | "SC50" | "TON" | "BAG" | … | null,
  quantidade: 540,            // substitui `sacas`; a base v1 é migrada
  pesoKg: 32400,              // quantidade × kg da unidade, ou o informado
  pesoInformado: false,       // true quando sobrescrito pelo peso do CT-e
  precoTonelada: 535.60,      // tarifa ÷ (pesoKg / 1000); null sem peso
  precoSaca: 32.14,           // só quando a unidade é do tipo saca; null nas demais
}
Dados += {
  produtos: [{ id: "CAFE", nome: "Café" }, { id: "ACUCAR", nome: "Açúcar" }],
  unidades: [{ id: "SC60", nome: "Saca 60 kg", kg: 60, saca: true }, { id: "SC50", nome: "Saca 50 kg", kg: 50, saca: true },
             { id: "TON", nome: "Tonelada", kg: 1000, saca: false }, { id: "BAG", nome: "Big bag", kg: null, saca: false }],
  cnpjs: [{ cnpj, nome, produtoPadrao? }],
}
```

Cálculos (arredondar a 2 casas em cada passo):

- `pesoKg = pesoInformado ? pesoKg : quantidade × kg da unidade`
- `precoTonelada = tarifa ÷ (pesoKg ÷ 1000)`
- `precoSaca = tarifa ÷ quantidade`, só para unidade do tipo saca

## 5. Telas (alterações)

- **Evolução e Rotas:**
  - seletor `R$/t | R$/saca | Tarifa R$`, com R$/t como padrão;
  - filtro **Produto**;
  - aviso "Esta rota tem café e açúcar; filtre o produto para comparar" quando aplicável.
- **Lançamentos:**
  - novos campos **Produto** (lista; vem do produto padrão do cliente), **Unidade** (lista), **Quantidade**, **Peso total (kg)** (calculado, com a opção "Usar o peso do CT-e" que libera o campo) e **R$/t** (travado);
  - com Big bag o peso é obrigatório;
  - a base ganha as colunas Produto e R$/t.
- **Cadastro CNPJ:** a coluna *Produto padrão* (lista) e as seções **Produtos** e **Unidades**, para incluir e renomear. Uma unidade em uso não muda de kg: o painel avisa e pede para criar outra.
- **Dados → Classificar CT-e:** a tela da revisão (decisão 4).
  - Ela lista os CT-e sem produto ou sem unidade, cada um com a sugestão da regra (produto, unidade, peso, R$/t resultante) e listas para trocar.
  - **Aplicar sugestões** aplica as linhas marcadas. Cada aplicação fica no histórico.

## 6. Testes (acréscimos)

**Unidade:**
- cálculo de peso e de R$/t;
- R$/saca só em unidade do tipo saca;
- migração da base v1 → v2;
- regra de sugestão: os casos da tabela do item 1 dão as unidades certas, e transportadora como cliente fica "a classificar";
- exceção por rota + produto em R$/t;
- importação com e sem as colunas novas;
- exportação com as colunas novas.

**Navegador:**
- lançar café em sacas de 60 kg e açúcar em toneladas: os R$/t batem;
- sobrescrever o peso;
- Big bag exige peso;
- revisar e aplicar a classificação.

**Conferência local com a planilha real:**
- 195 CT-e classificados pela regra, com a contagem de "a classificar";
- a exceção "preço fora da faixa" deve cair de 27 para um número pequeno. O número esperado sai da própria conferência e vai para o relatório.
