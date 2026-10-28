# Produto, unidade e preço por tonelada — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada CT-e passa a ter produto, unidade e peso, e o painel compara preços em R$/t (com R$/saca e tarifa no seletor), filtrando por produto. Os CT-e já lançados são classificados por uma regra revisada pelo usuário.

**Architecture:** O código existente é estendido sem quebrar a estrutura.
- `calculos.js` ganha o peso e o R$/t.
- `base.js` ganha as listas de produtos e unidades, a migração v1→v2 e o produto padrão do CNPJ.
- Um módulo novo, `classificacao.js`, sugere produto e unidade.
- `agregacao.js` troca a métrica e o filtro.
- As telas recebem os campos novos, e a aba Dados ganha "Classificar CT-e".

**Tech Stack:** o mesmo da etapa anterior (JS ES2022, `node --test`, esbuild 0.24.0, xlsx 0.18.5, Playwright).

**Spec:** `docs/superpowers/specs/2026-10-29-produto-unidade-preco-tonelada-design.md` (adendo), sobre `docs/superpowers/specs/2026-10-28-radar-carga-solta-design.md`.

## Global Constraints

- Tudo que valia na etapa anterior continua valendo: pt-BR, Tóliman Painéis, `esc()` em toda interpolação de HTML, ouvintes presos à seção desenhada (nunca ao `#conteudo`), toda alteração por `App.alterar` + `src/acoes.js`.
- `versao` do arquivo de dados = **2**.
- Unidades iniciais (ids fixos):
  - `SC60` "Saca 60 kg", 60 kg, saca: sim;
  - `SC50` "Saca 50 kg", 50 kg, saca: sim;
  - `TON` "Tonelada", 1.000 kg, saca: não;
  - `BAG` "Big bag", kg null, saca: não.
- Produtos iniciais: `CAFE` "Café" e `ACUCAR` "Açúcar".
- Fórmulas, arredondando a 2 casas em cada passo:
  - `pesoKg = quantidade × kg` (a menos que `pesoInformado`);
  - `precoTonelada = tarifa ÷ (pesoKg ÷ 1000)`;
  - `precoSaca = tarifa ÷ quantidade`, só se a unidade for do tipo saca.
- Sem peso ou com peso ≤ 0, `precoTonelada` é `null` (nunca `Infinity` ou `NaN`).
- Métricas: `"tonelada"` (padrão), `"saca"` e `"tarifa"`. No endereço, `metrica` só aparece quando não é `tonelada`.
- Regra de sugestão para os CT-e sem classificação:
  - produto = `produtoPadrao` do CNPJ do cliente;
  - unidade: quantidade ≤ 100 → `TON`; > 100 → `SC60` se o produto for `CAFE`, `SC50` se for `ACUCAR`; sem produto → sem unidade.
- Produto padrão inicial dos clientes, por nome (normalizado, sem acento, maiúsculas, "contém"):
  - **Café:** EISA, STONEX, OLAM, LOUIS DREYFUS, SUCAFINA, EXPOCACER, UNICAFE, COFCO, RS TRADE, NOVO RUMO, ALTO CAFEZAL;
  - **Açúcar:** USINA, ACUCAR, COPLASA, CENTRAL ENERGETICA, BIOENERGETICA, COLOMBO AGROINDUSTRIA, NARDINI.
- Exceção de preço: R$/t fora de [⅓ × mediana, 3 × mediana] por **rota + produto**, com ≥ 3 CT-e no grupo. Exceção nova `a-classificar`: sem produto, sem unidade ou sem peso.
- Exportação: colunas antigas iguais e, no fim, `PRODUTO`, `UNIDADE`, `PESO (KG)` e `PREÇO POR TONELADA`. A coluna `QT. SACAS` continua com esse nome na exportação e recebe a quantidade.
- Importação: aceita `QT. SACAS` ou `QUANTIDADE`. `PRODUTO`, `UNIDADE` e `PESO (KG)` são opcionais e, quando presentes, valem (casando pelo nome, sem acento).
- A planilha real nunca entra no repositório.

## Review Focus

1. **Base v1 gravada por outra pessoa com o painel antigo, aberta pelo novo.** Migra na leitura, sem perder CT-e, e a junção com uma tela v2 não volta para v1. Testes na Task 1 (`migrarBase converte v1 sem perder nada`) e na Task 5 (`juntar com arquivo v1 migra antes`).
2. **Big bag sem peso, ou peso zerado.** O lançamento bloqueia com mensagem; na importação o CT-e entra como `a-classificar`, e o R$/t nunca vira Infinity. Testes nas Tasks 1 e 2.
3. **Unidade renomeada ou com kg alterado depois de usada.** O kg de unidade em uso não muda (o painel recusa); o nome pode mudar. Teste na Task 1 (`unidade em uso não muda de kg`).
4. **Duas pessoas classificando ou cadastrando produto ao mesmo tempo.** A junção preserva as listas de produtos e unidades dos dois lados. Teste na Task 5 (`juntar une produtos e unidades`).
5. **Rota com café e açúcar sem filtro de produto.** O aviso aparece e a exceção é calculada por grupo, não pela rota misturada. Testes nas Tasks 2 e 7.

---

## Estrutura de arquivos

```
src/calculos.js        + calcularCte com unidade/peso (assinatura nova)
src/base.js            + produtos, unidades, migrarBase, produtoPadrao, cadastros
src/classificacao.js   NOVO: sugerirProdutoCliente, sugerirClassificacao, pendentesDeClassificacao
src/agregacao.js       métrica tonelada/saca/tarifa, filtro produto, exceções por rota+produto
src/importacao.js      colunas novas, QUANTIDADE, exportação
src/arquivo.js         lerDadosJs migra; juntar une produtos/unidades; sessão registra listas
src/acoes.js           + classificar, cadastrarProduto, cadastrarUnidade, definirProdutoPadrao
src/hash.js            métrica padrão tonelada; filtro produto
src/app.js             migra a base carregada
src/telas/*.js         campos e filtros novos; Dados → Classificar CT-e
scripts/conferir-planilha.mjs  + classificação e contagem de exceções
```

---

### Task 1: Cálculos, listas e migração

**Files:**
- Modify: `src/calculos.js`, `src/base.js`
- Test: `test/calculos.test.js`, `test/base.test.js`, `test/ajuda.js`, `test/fixtures/base-exemplo.js`

**Interfaces:**
- Produces (`calculos.js`):
  - `calcularCte({valorAssegurado, taxaSeguro, valorFrete, adicionais, quantidade, unidade: {kg, saca}|null, pesoKg?, pesoInformado?}): {valorSeguro, tarifa, pesoKg: number|null, precoTonelada: number|null, precoSaca: number|null}`
- Produces (`base.js`):
  - `UNIDADES_INICIAIS`, `PRODUTOS_INICIAIS` (Global Constraints).
  - `novaBase()` → `versao: 2` e as listas iniciais.
  - `migrarBase(d): Dados` (pura; devolve uma cópia):
    - `sacas` → `quantidade`;
    - `produto` e `unidade` `null`; `pesoKg` `null`; `pesoInformado` `false`;
    - `precoTonelada` `null`; `precoSaca` `null`;
    - as listas iniciais, se faltarem;
    - `versao` 2;
    - vale também para os CT-e da lixeira.
    - Numa base já v2, não muda nada.
  - `unidadeDe(d, id)`, `produtoDe(d, id)`.
  - `validarCampos(d, campos)`:
    - ⚠ ganha o parâmetro `d` (precisa das listas);
    - exige `produto` e `unidade` existentes e `quantidade > 0`;
    - exige `pesoKg > 0` quando a unidade não tem kg ou quando `pesoInformado`;
    - mensagens: `"Escolha o produto."`, `"Escolha a unidade."`, `"Informe a quantidade."`, `"Informe o peso total do CT-e (kg)."`.
  - `incluir`, `corrigir`: usam o `calcularCte` novo, com a unidade da lista.
  - `classificar(d, chave, {produto, unidade, pesoKg?, pesoInformado?}, quem, agora)`:
    - grava a classificação e recalcula;
    - log `classificar`;
    - não exige os outros campos (serve para CT-e importado).
  - `cadastrarProduto(d, {id?, nome}, quem, agora)`: `id` gerado do nome (maiúsculas, sem acento, sem espaço) quando ausente; renomeia se já existir.
  - `cadastrarUnidade(d, {id?, nome, kg, saca}, quem, agora)`: recusa mudar o `kg` de unidade em uso, com `{ok:false, erro:"Unidade em uso: crie outra para um peso diferente."}`.
  - `definirProdutoPadrao(d, cnpj, produto|null, quem, agora)`.
  - O log ganha as ações `classificar`, `produto` e `unidade`.

- [ ] **Step 1: Atualizar os ajudantes de teste.**
  - `campos()` em `test/ajuda.js` passa a ter `produto: "ACUCAR", unidade: "TON", quantidade: 50` no lugar de `sacas: 50`.
  - Em `base-exemplo.js`, a rota A→B é de açúcar em toneladas, com preços = frete/50 por t, iguais aos de hoje.
- [ ] **Step 2: Escrever os testes que falham:**
  - `calcularCte por tonelada e por saca`:
    - `{valorFrete: 17353.56, quantidade: 540, unidade: {kg: 60, saca: true}}` → `pesoKg: 32400`, `precoTonelada: 535.60`, `precoSaca: 32.14`;
    - `{valorFrete: 8750, quantidade: 50, unidade: {kg: 1000, saca: false}}` → `precoTonelada: 175`, `precoSaca: null`.
  - `peso informado vale sobre a unidade`: `pesoInformado: true, pesoKg: 25000` → `precoTonelada = tarifa / 25`.
  - `sem peso dá precoTonelada null`: unidade com `kg: null` e sem `pesoKg`.
  - `big bag exige peso`: `validarCampos(d, campos({unidade: "BAG"})).erros.pesoKg`.
  - `migrarBase converte v1 sem perder nada` (Review Focus 1): uma base v1 com 2 CT-e (um na lixeira) → v2 com `quantidade`, `produto: null`, as listas, e o mesmo número de CT-e.
  - `classificar recalcula e registra`.
  - `unidade em uso não muda de kg` (Review Focus 3): renomear passa; mudar o kg dá `ok:false`.
  - `cadastrarProduto gera id e renomeia`.
  - Ajustar os testes existentes de `base`, `calculos`, `agregacao`, `importacao`, `acoes`, `arquivo` e `pasta` que usam `sacas` ou `validarCampos(campos)`.
- [ ] **Step 3: Rodar `npm test`.** Esperado: FAIL nos testes novos.
- [ ] **Step 4: Implementar.**
- [ ] **Step 5: Rodar `npm test`.** Esperado: os testes de `calculos` e `base` passam. Os de outros módulos podem continuar falhando até as Tasks 2–5; a Task só fecha com `calculos` e `base` verdes.
- [ ] **Step 6: Commit** `"Produto, unidade, peso e R$/t no modelo; migração da base v1"`.

### Task 2: Agregação por tonelada e produto

**Files:** Modify `src/agregacao.js`. Test `test/agregacao.test.js`.

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `valorMetrica(cte, "tonelada"|"saca"|"tarifa")`.
  - `filtrar(d, {…, produto})`.
  - `produtosDaRota(d, rota): string[]`.
  - `excecoes(d)`:
    - `preco-fora` em R$/t por `rota + " · " + produto`, com a mediana e o produto no `detalhe`;
    - `a-classificar` (sem produto, unidade ou peso; substitui `sem-sacas`);
    - mantém `sem-cadastro` e `diverge-planilha`.
  - Os demais (`serieMensal`, `resumoGeral`, `resumoRotas`, `transportadoresNaRota`) aceitam a métrica nova sem mudar de assinatura. `resumoGeral` troca `nSacas` por `pesoT` (soma de `pesoKg`/1000).

- [ ] **Step 1: Escrever os testes que falham** (ajustando os existentes de `sacas` para `quantidade`):
  - `métrica tonelada é a padrão do valor`.
  - `filtrar por produto`.
  - `rota com dois produtos lista os dois` (Review Focus 5).
  - `exceção por rota e produto`: na mesma rota, café a R$ 536/t (3 CT-e) e açúcar a R$ 175/t (3 CT-e) → nenhuma exceção; um café a R$ 2.000/t → exatamente 1.
  - `a classificar quando falta produto ou peso` (Review Focus 2): sem `Infinity` em nenhuma métrica.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar.** Esperado: PASS em `agregacao`.
- [ ] **Step 5: Commit** `"Agregação em R$/t, filtro de produto e exceções por rota e produto"`.

### Task 3: Classificação sugerida

**Files:** Create `src/classificacao.js`, `test/classificacao.test.js`.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `sugerirProdutoCliente(nome): "CAFE"|"ACUCAR"|null`, pela lista dos Global Constraints.
  - `semeiaProdutosPadrao(d): number`: preenche `produtoPadrao` dos CNPJ sem um (sem log) e devolve quantos preencheu.
  - `sugerirClassificacao(d, cte): {produto, unidade, pesoKg, precoTonelada, motivo}`. `motivo` é um texto curto, por exemplo `"cliente de café; 540 ≤ 100? não → saca 60 kg"`; sem produto, `"cliente sem produto padrão"`.
  - `pendentesDeClassificacao(d): Cte[]`: sem produto ou sem unidade.
- [ ] **Step 1: Escrever os testes que falham.** Os casos da tabela do adendo:
  - açúcar 50 → TON, R$ 175/t;
  - açúcar 1.080 → SC50, R$ 178/t (com frete 9.612);
  - café 20 → TON;
  - café 540 → SC60, R$ 535,60/t;
  - cliente "COLOMBARI SERVIÇOS DE TRANSPORTES LTDA" → produto null;
  - `sugerirProdutoCliente("USINA ALTA MOGIANA S/A") === "ACUCAR"`, `("U.S.J AÇUCAR E ALCOOL S/A") === "ACUCAR"`, `("EISA") === "CAFE"`.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Sugestão de produto e unidade para classificar CT-e"`.

### Task 4: Importação e exportação

**Files:** Modify `src/importacao.js`, `scripts/conferir-planilha.mjs`. Test `test/importacao.test.js`, `test/fixtures/planilha.js`.

**Interfaces:**
- Consumes: Tasks 1 e 3.
- Produces:
  - `normalizarLinha(d, linha, numLinha)`: ⚠ ganha `d`.
    - aceita `QUANTIDADE` ou `QT. SACAS`;
    - lê `PRODUTO`, `UNIDADE` e `PESO (KG)` quando houver, casando o nome com as listas (sem acento); valor desconhecido → `null`;
    - não exige produto e unidade (o CT-e importado pode ficar `a-classificar`).
  - `aplicarImportacao`:
    - inclui sem exigir produto e unidade;
    - depois chama `semeiaProdutosPadrao`;
    - a divergência compara `valorSeguro` e `tarifa`, e `precoSaca` só quando a unidade é saca.
    - O retorno ganha `aClassificar`.
  - `exportarXlsx`: colunas novas no fim; a reimportação devolve produto, unidade e peso.
  - `incluir` (Task 1) ganha a opção `{exigirClassificacao: false}`, usada só pela importação.
  - Conferência real: imprime `incluidos`, `aClassificar`, a contagem de `pendentesDeClassificacao` depois de aplicar as sugestões, e a contagem de `preco-fora` antes e depois.
- [ ] **Step 1: Escrever os testes que falham:**
  - `importa planilha sem colunas novas como a classificar`.
  - `importa colunas PRODUTO UNIDADE PESO quando existem`.
  - `aceita QUANTIDADE no lugar de QT. SACAS`.
  - `exportar e reimportar preserva produto, unidade e peso`.
  - `semeia produto padrão dos clientes conhecidos`.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Conferência real.** Esperado: `incluidos 195`; aplicando as sugestões, só os CT-e de clientes transportadores ficam pendentes; `preco-fora` cai de 27. Anotar os números no ledger.
- [ ] **Step 6: Commit** `"Importação e exportação com produto, unidade e peso"`.

### Task 5: Arquivo, sessão, ações e endereço

**Files:** Modify `src/arquivo.js`, `src/acoes.js`, `src/hash.js`, `src/app.js`. Test `test/arquivo.test.js`, `test/acoes.test.js`, `test/hash.test.js`, `test/pasta.test.js`.

**Interfaces:**
- Consumes: Tasks 1, 3 e 4.
- Produces:
  - `lerDadosJs` devolve a base já migrada (`migrarBase`).
  - `novaSessao()` ganha `listas: Map<"produto:ID"|"unidade:ID", objeto>`.
  - `juntar` aplica `sessao.listas` por cima das listas do arquivo, unindo por id, e migra o arquivo antes.
  - `acoes.js` ganha `classificar`, `cadastrarProduto`, `cadastrarUnidade` e `definirProdutoPadrao` (que vai em `cadastro` como o nome); todas registram na sessão e tocam a chave.
  - `hash.js`: `metrica` padrão `tonelada`; aceita `saca` e `tarifa`; chave nova `produto`.
  - `app.js`: `App.dados = migrarBase(...)` ao carregar; também nas pendências restauradas.
- [ ] **Step 1: Escrever os testes que falham:**
  - `juntar com arquivo v1 migra antes` (Review Focus 1).
  - `juntar une produtos e unidades` (Review Focus 4).
  - `acao classificar registra a sessão`.
  - `hash: tonelada é a padrão e produto vai no endereço`.
  - `pendências v1 no IndexedDB são migradas`.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar `npm test`.** Esperado: **toda a suíte de unidade verde**.
- [ ] **Step 5: Commit** `"Base v2 no arquivo, na junção e no endereço"`.

### Task 6: Lançamentos e Cadastro

**Files:** Modify `src/telas/lancamentos.js`, `src/telas/cadastro.js`, `src/estilo/app.css`. Test `test/e2e/lancamentos.test.js`, `test/e2e/dados.test.js`.

- **Lançamentos:**
  - campos Produto (select), Unidade (select), Quantidade, Peso total (kg) (travado, com a caixa "Usar o peso do CT-e" que o libera e marca `pesoInformado`), e o travado R$/t ao lado de R$/saca;
  - com Big bag, a caixa vem marcada e travada;
  - ao preencher o CNPJ do cliente com produto padrão, o select Produto vem preenchido se estiver vazio;
  - a base ganha as colunas Produto e R$/t (R$/saca continua).
- **Cadastro:**
  - coluna Produto padrão (select com "—"), que salva ao mudar;
  - cartões "Produtos" e "Unidades" com tabela e formulário de inclusão;
  - renomear na própria tabela;
  - kg de unidade em uso desabilitado, com dica.
- [ ] **Step 1: Escrever os testes e2e que falham:**
  - `lança café em sacas de 60 kg e açúcar em toneladas`: R$/t travados = `R$ 535,60` e `R$ 175,00`.
  - `peso do CT-e sobrescreve o calculado`.
  - `big bag exige peso`.
  - `produto padrão do cliente preenche o produto`.
  - `cadastra produto e unidade novos e eles aparecem no formulário`.
  - Ajustar os testes e2e existentes ao formulário novo.
- [ ] **Step 2: Rodar `npm run montar && npm run test:e2e`.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Lançamento e cadastro com produto, unidade e peso"`.

### Task 7: Evolução, Rotas e Classificar CT-e

**Files:** Modify `src/telas/evolucao.js`, `src/telas/rotas.js`, `src/telas/dados.js`. Test `test/e2e/evolucao.test.js`, `test/e2e/rotas.test.js`, `test/e2e/dados.test.js`, `test/e2e/fluxo.test.js`.

- **Evolução:**
  - seletor `R$/t | R$/saca | Tarifa R$`;
  - h1 "Preço por tonelada" (ou "Preço por saca" / "Tarifa do frete");
  - filtro Produto;
  - aviso `.exc` curto acima do gráfico quando a rota escolhida tem mais de um produto e não há filtro de produto;
  - o KPI "Sacas" vira "Toneladas";
  - a tabela de exceções mostra produto e R$/t.
- **Rotas:** o mesmo seletor e o filtro de produto (lido de `App.filtros`); coluna Produtos.
- **Dados → Classificar CT-e:**
  - cartão com a contagem de pendentes e a tabela: CT-e, cliente, quantidade, sugestão (produto e unidade em selects já preenchidos), peso, R$/t resultante (recalculado ao trocar) e motivo;
  - caixa de marcar por linha (marcada quando a sugestão tem produto e unidade);
  - botões **Aplicar marcados** e **Marcar todos com sugestão**;
  - aplica por `acoes.classificar` numa só chamada de `App.alterar`;
  - depois de importar, o resumo da importação leva a este cartão.
- [ ] **Step 1: Escrever os testes e2e que falham:**
  - `evolução abre em R$/t`.
  - `rota com café e açúcar mostra o aviso e o filtro resolve` (Review Focus 5).
  - `classificar aplica as sugestões marcadas`: base fictícia v1 com 4 CT-e → 3 com sugestão aplicados e 1 fica pendente.
  - O fluxo completo passa a importar, classificar e só então lançar.
  - Ajustar os testes existentes à métrica nova.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar `npm test && npm run montar && npm run test:e2e`.** Esperado: tudo PASS.
- [ ] **Step 5: Conferência visual com a planilha real** (local, fora do repositório).
  - Importar, aplicar as sugestões e tirar screenshots de Evolução (LEM → Machado), Rotas e Classificar.
  - Conferir que as exceções "preço fora" caíram e que a curva LEM → Machado fica perto de R$ 536/t sem pontos fora.
- [ ] **Step 6: Atualizar `docs/IMPLANTACAO.md`:** passo "classificar o histórico" depois da importação, e o resultado esperado. Commit `"Evolução e Rotas em R$/t, filtro de produto e tela de classificação"`; push.
