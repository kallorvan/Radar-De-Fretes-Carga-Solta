# Ajustes: seguro, itinerário, CNPJ pela chave, corte, exceções, gráfico e logos · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar os sete ajustes do adendo 2 ao painel Radar de Fretes · Carga Solta sem perder nenhum dado das bases já gravadas.

**Architecture:** A base passa para a versão 3, com a marca `window.RADAR_CS3=` e um campo `corte`. As regras ficam nos módulos puros, cada uma com teste unitário:
- seguro, itinerário e CNPJ pela chave em `calculos.js` e `base.js`;
- corte em `agregacao.js` e `classificacao.js`;
- junção em `arquivo.js`.

As telas só consomem essas regras. O gráfico novo fica em `graficos.js`. As logos são geradas por script e embutidas pelo `montar.mjs`.

**Tech Stack:** ES modules, esbuild 0.24.0, node:test, Playwright (global), SheetJS 0.18.5, Python 3 + Pillow (só no script das logos).

**Spec:** `docs/superpowers/specs/2026-10-28-ajustes-seguro-itinerario-corte-grafico-design.md`, que altera `2026-10-28-radar-carga-solta-design.md` e `2026-10-29-produto-unidade-preco-tonelada-design.md`.

## Global Constraints

- **Interface em pt-BR**, sem ícones; tokens Tóliman Painéis: navy `#112346`, accent `#e4536c`, accent-d `#c63e56`, plum `#8e5aa8`.
- **Arredondamento:** 2 casas em cada passo dos cálculos; a taxa do seguro com 6 casas.
- **Corte padrão:** `"2026-08-01"`. Entra no corte o CT-e com `emissao >= corte`. Corte `null` = sem corte.
- **Itinerário:** portos SANTOS = `SAN` e GUARUJA = `GJA`. O código só existe quando um lado é porto e o outro está nas abas LINHA SANTOS / LINHA GUARUJÁ.
- **CNPJ do transportador:** os dígitos 7 a 20 da chave (`slice(6, 20)`).
- **Arquivo de dados:**
  - grava com `window.RADAR_CS3=`;
  - lê também `RADAR_CS2=` e `RADAR_CS=`, migrando;
  - `versao: 3`.
- **Planilha real:** nunca entra no repositório (`*.xlsm` e `*.xlsx` seguem no `.gitignore`).
- **O painel continua um arquivo único** (`dist/index.html`), aberto por file://.
- **Comandos de verificação:**
  - `npm test` (unidade);
  - `npm run montar && npm run test:e2e` (navegador);
  - os dois precisam passar ao fim de cada task.

## Review Focus

1. **CT-e emitido exatamente na data de corte** entra na análise. Teste na Task 1.
2. **Data de corte apagada** (campo vazio em Dados): todos os CT-e voltam para a análise. Testes nas Tasks 1 e 5.
3. **Assegurado zero ou vazio com seguro informado:** taxa `null`, sem divisão por zero, e a tarifa continua certa. Teste na Task 2.
4. **Chave colada com espaços ou pontos:** o CNPJ sai do mesmo jeito. Com 43 dígitos, o CNPJ não é preenchido e o erro é o da chave. Teste na Task 3.
5. **Gráfico com um único CT-e, ou todos com o mesmo valor:**
   - nenhum `NaN` no SVG;
   - a cor do ponto fica no meio do gradiente.
   Teste na Task 7.

---

### Task 1: Base v3, data de corte e junção

**Files:**
- Modify: `src/base.js` (`novaBase`, `migrarBase`, nova `definirCorte`, nova `noCorte`)
- Modify: `src/agregacao.js` (`filtrar`, `produtosDaRota`, `excecoes`)
- Modify: `src/classificacao.js` (`pendentesDeClassificacao`)
- Modify: `src/arquivo.js` (`MARCA`, `lerDadosJs`, `novaSessao`, `sessaoVazia`, `juntar`, `resumoConflito`)
- Modify: `src/pasta.js` (serializar a sessão e baixá-la)
- Modify: `src/acoes.js` (nova `definirCorte`)
- Modify: `src/app.js:109` (lê `window.RADAR_CS3 || window.RADAR_CS2 || window.RADAR_CS`)
- Modify: `test/fixtures/base-exemplo.js` e qualquer fixture com emissão antes de agosto: `d.corte = null` ao fim de cada base de exemplo, para não mudar o que os testes atuais conferem
- Test: `test/base.test.js`, `test/agregacao.test.js`, `test/classificacao.test.js`, `test/arquivo.test.js`, `test/pasta.test.js`

**Interfaces:**
- Produces:
  - `CORTE_PADRAO = "2026-08-01"`;
  - `noCorte(d, cte) -> boolean`;
  - `ctesNoCorte(d) -> Cte[]`;
  - `definirCorte(d, valor: "aaaa-mm-dd" | "" | null, quem, agora) -> {ok, corte}`, que registra a ação `"corte"` no histórico;
  - `filtrar(d, f, { aplicarCorte = true } = {})`;
  - em `acoes.js`: `definirCorte(d, s, valor, quem, agora)`, que anota `s.config.set("corte", valor)`;
  - na sessão: `config: Map<string, any>`.
- The v2 → v3 migration step lives in `migrarBase`, inside an `if ((d.versao || 1) < 3)` block. Tasks 2 and 3 add their lines to it.

- [ ] **Step 1: Write the failing tests**
  - `novaBase().versao === 3` e `novaBase().corte === "2026-08-01"`.
  - `migrarBase({versao: 2, ctes: [...]})`:
    - devolve `versao === 3` e `corte === "2026-08-01"`;
    - com `corte: null` já gravado, mantém `null` (só preenche quando é `undefined`).
  - `noCorte`:
    - `emissao "2026-08-01"` → true;
    - `"2026-07-31"` → false;
    - `corte null` → true.
  - `filtrar(d, {})` numa base com 2 CT-e (julho e agosto) devolve só o de agosto; `filtrar(d, {}, { aplicarCorte: false })` devolve os dois.
  - `excecoes` ignora um CT-e de julho sem produto. Nenhuma "a-classificar" para ele.
  - `pendentesDeClassificacao` também ignora o CT-e de julho.
  - `definirCorte`:
    - com `"2026-09-01"`: `ok`, `d.corte` muda e há registro `"corte"`;
    - com `""`: `d.corte === null`;
    - com `"31/08/2026"`: `ok: false`.
  - `lerDadosJs`:
    - de um texto com `window.RADAR_CS2=` devolve base v3;
    - `montarDadosJs` grava `window.RADAR_CS3=`.
  - `juntar(arquivo, tela, sessao)` com `sessao.config = new Map([["corte", "2026-09-01"]])` devolve `corte === "2026-09-01"`. Sem a chave na sessão, mantém o corte do arquivo.
  - `sessaoVazia` é false quando só `config` tem item.
  - **Teste do gravador:** depois de salvar, `config` sai da sessão quando o valor gravado é o mesmo (mesma regra de `listas`).

- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement**
  - `migrarBase` também aceita v2 vinda de `RADAR_CS2`.
  - `excecoes` aplica o corte a todos os tipos; "sem-cadastro" só olha os CT-e no corte.
  - `produtosDaRota` usa `ctesNoCorte`.

- [ ] **Step 4: Run** `npm test`. Expected: PASS (todos, inclusive os antigos com `corte = null` nas fixtures).

- [ ] **Step 5: Commit** — `Base v3: data de corte, junção da configuração e nova marca do arquivo`

### Task 2: Seguro informado, taxa calculada

**Files:**
- Modify: `src/calculos.js` (`calcularCte`)
- Modify: `src/base.js` (`NUMERICOS`, `normalizar`, migração v3)
- Modify: `src/importacao.js` (`normalizarLinha`, conferência de divergência)
- Modify: `src/telas/lancamentos.js` (`CAMPOS`, `NUM`, outputs)
- Test: `test/calculos.test.js`, `test/base.test.js`, `test/importacao.test.js`, `test/e2e/lancamentos.test.js`; `test/ajuda.js` (`campos()` troca `taxaSeguro: 0` por `valorSeguro: 0`)

**Interfaces:**
- Produces: `calcularCte({ valorAssegurado, valorSeguro, valorFrete, adicionais, quantidade, unidade, pesoKg, pesoInformado }) -> { taxaSeguro, valorSeguro, tarifa, pesoKg, precoTonelada, precoSaca }`
  - `taxaSeguro = valorAssegurado > 0 ? round6(valorSeguro / valorAssegurado) : null`.
  - `valorSeguro` vazio → 0.

- [ ] **Step 1: Write the failing tests**
  - `calcularCte({ valorAssegurado: 917213.08, valorSeguro: 458.61, valorFrete: 20000, adicionais: 0, ... })`:
    - `taxaSeguro === 0.0005`;
    - `tarifa === 19541.39`.
  - Review Focus 3: `valorAssegurado: 0, valorSeguro: 100, valorFrete: 1000`:
    - `taxaSeguro === null`;
    - `tarifa === 900`.
  - `incluir` com `valorSeguro: "458,61"` grava `valorSeguro 458.61` e `taxaSeguro 0.0005`.
  - Migração v2 → v3: um CT-e com `valorAssegurado 917213.08, taxaSeguro 0.0005, valorSeguro 458.61` mantém o `valorSeguro` e fica com `taxaSeguro 0.0005`. Com `valorSeguro 0` e `assegurado 0`, a taxa fica `null`.
  - Importação:
    - uma linha com `VALOR DO SEGURO` vazio e `TAXA DO SEGURO 0.0005` sobre `VALOR ASSEGURADO 917213.08` dá `valorSeguro 458.61`;
    - uma linha com seguro 193,00 e taxa que daria 193,07 **não** fica divergente (o seguro agora é entrada; a divergência olha só tarifa e preço por saca).
  - **E2E (lancamentos):** preencher Valor assegurado `917.213,08` e Valor do seguro `458,61` mostra Taxa do seguro `0,0500%`, travada (`output`), e a tarifa certa.

- [ ] **Step 2: Run** `npm test`. Expected: FAIL nos testes novos.

- [ ] **Step 3: Implement**
  - Form: o campo `taxaSeguro` vira `["valorSeguro", "Valor do seguro", false, "", "text", ""]`.
  - Novo `<output name="taxaSeguro">`, formatado como percentual com 4 casas (`fmtPct`, ou `fmtNum(v*100, 4) + "%"`), no lugar do output de valor do seguro.
  - A exportação mantém as colunas da planilha; `TAXA DO SEGURO` sai de `c.taxaSeguro`.

- [ ] **Step 4: Run** `npm test && npm run montar && npm run test:e2e`. Expected: PASS.

- [ ] **Step 5: Commit** — `Seguro: o CT-e informa o valor do seguro e a taxa é calculada`

### Task 3: Cód. itinerário automático e CNPJ do transportador pela chave

**Files:**
- Create: `scripts/extrair-itinerarios.mjs`. Uso: `node scripts/extrair-itinerarios.mjs <planilha.xlsm>`. Lê as colunas A (`CIDADE`) e B (`CODIGO`) das abas `LINHA SANTOS` e `LINHA GUARUJÁ` (as duas, unidas; o bloco da direita das abas é ignorado) e escreve `src/dados-itinerarios.js`.
- Create: `src/dados-itinerarios.js` (gerado, commitado). Contém `export const CODIGOS_CIDADE = { "ABADIA DOS DOURADOS": "ADD", … }`, com chaves por `normalizarCidade` e em ordem alfabética, mais um comentário de cabeçalho dizendo de onde veio e como regerar.
- Modify: `src/calculos.js` (novas `codigoItinerario` e `cnpjDaChave`)
- Modify: `src/base.js` (`normalizar`, `validarCampos`, migração v3)
- Modify: `src/importacao.js`, `src/telas/lancamentos.js`
- Modify: `test/ajuda.js` e `test/fixtures/planilha.js`. `campos()` e `linhaPadrao()` montam a chave com o CNPJ do transportador nas posições 7 a 20, para que as fixtures existentes continuem válidas: `chave.slice(0, 6) + cnpj + chave.slice(20)`.
- Test: `test/calculos.test.js`, `test/base.test.js`, `test/importacao.test.js`, `test/e2e/lancamentos.test.js`

**Interfaces:**
- Produces:
  - `cnpjDaChave(chave) -> string` (14 dígitos, ou `""` se a chave não tiver 44 dígitos depois de `soDigitos`);
  - `codigoItinerario(origem, destino) -> string` (`""` quando não há código);
  - `PORTOS = { SANTOS: "SAN", GUARUJA: "GJA" }`.

- [ ] **Step 1: Write the failing tests**
  - `codigoItinerario`:
    - `("Araras", "Santos") === "ARRSAN"`;
    - `("SANTOS", "ALFENAS") === "SANALF"`;
    - `("Alfenas", "Guarujá") === "ALFGJA"`;
    - `("São Joaquim da Barra", "Santos") === ""`;
    - `("Araras", "Alfenas") === ""`.
  - `cnpjDaChave`:
    - `cnpjDaChave("35260105780969000146570010000106001000120718") === "05780969000146"`;
    - Review Focus 4: com espaços e pontos no meio dá o mesmo resultado; com 43 dígitos dá `""`.
  - `validarCampos`:
    - sem `cnpjTransportador` e com chave válida, preenche o CNPJ da chave;
    - com um CNPJ diferente do da chave, dá o erro `cnpjTransportador: "O CNPJ do transportador não bate com a chave de acesso."`.
  - `incluir` ignora o `itinerario` recebido e grava `codigoItinerario(origem, destino)`.
  - A migração v2 → v3 preenche o itinerário vazio de um CT-e Araras → Santos com `ARRSAN` e não mexe num itinerário já preenchido.
  - Importação:
    - uma linha com `CNPJ DO TRANSPORTADOR` diferente do da chave é incluída com o CNPJ da chave e `divergencia.planilha.cnpjTransportador` igual ao da planilha;
    - uma linha com `COD. ITINERÁRIO "XYZSAN"` para Araras → Santos grava `ARRSAN` e fica divergente (`divergencia.planilha.itinerario`);
    - a mesma linha com o código em branco não fica divergente.
  - `classificar` num CT-e cuja divergência é só de CNPJ ou itinerário recalcula tarifa e preços normalmente. Só restaura `valorSeguro`/`tarifa` da planilha quando essas chaves estão em `divergencia.planilha`.
  - **E2E:**
    - colar a chave preenche o CNPJ do transportador, e o campo fica `readonly`;
    - digitar origem `Araras` e destino `Santos` mostra `ARRSAN` no itinerário `readonly`.

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Generate the table.** Run `node scripts/extrair-itinerarios.mjs /root/.claude/uploads/4734fbf5-a53f-503e-93a8-706ffdcec108/666696e9-Radar_Fretes_Concorrentes_v2.10.xlsm`. Expected: `334 cidades` impresso e `src/dados-itinerarios.js` criado.

- [ ] **Step 4: Implement**
  - Na exceção "diverge-planilha", o texto passa a ser "Na importação, o CNPJ do transportador, o itinerário ou a tarifa não bateram; vale o CNPJ da chave e o itinerário do cadastro do Rodopar, e a tarifa da planilha." A tabela dessa exceção ganha a coluna "O que divergiu".

- [ ] **Step 5: Run** `npm test && npm run montar && npm run test:e2e`. Expected: PASS.

- [ ] **Step 6: Commit** — `Itinerário pelo cadastro do Rodopar e CNPJ do transportador pela chave de acesso`

### Task 4: Exceções e gráfico abrem o CT-e na base

**Files:**
- Modify: `src/telas/lancamentos.js` (export `abrirNaBase(chave)`)
- Modify: `src/telas/cadastro.js` (export `abrirNoCadastro(cnpj)`)
- Modify: `src/app.js` (`App.abrirCte(chave)` e `App.abrirCnpj(cnpj)`)
- Modify: `src/telas/evolucao.js` (`excecoesHtml` + ouvintes)
- Test: `test/e2e/evolucao.test.js`

**Interfaces:**
- Produces: `App.abrirCte(chave)`.
  - Põe a chave em `estado.editando`, só quando não é somente leitura, e o número em `estado.busca` de Lançamentos.
  - Depois chama `App.irPara("lancamentos", { metrica: App.filtros.metrica })`, sem o recorte, para o CT-e aparecer na base.
- Produces: `App.abrirCnpj(cnpj)`. Põe os 14 dígitos em `estado.busca` do Cadastro e vai para `cadastro`.
- Não usa o endereço (`#…?editar=`): abrir é uma ação de uma vez só, e um parâmetro no endereço reabriria a correção a cada redesenho. É a única diferença em relação à spec.

- [ ] **Step 1: Write the failing e2e tests** (com base de exemplo e `gravavel: true`):
  - Em Evolução, na exceção "R$/t fora da faixa", o botão `[data-abrir-cte]` da linha leva a Lançamentos com `#form-cte.editando` e o título "Corrigindo o CT-e Nº <n>".
  - Em "CNPJ sem nome no cadastro", `[data-abrir-cnpj]` leva ao Cadastro com a busca preenchida.
  - Em "CT-e a classificar", o botão do grupo `[data-ir-classificar]` leva a Dados, com `#classificar` visível.

- [ ] **Step 2: Run** `npm run montar && npm run test:e2e`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - Rótulos:
    - "Abrir na base" (CT-e);
    - "Abrir no cadastro" (CNPJ);
    - "Classificar CT-e" (grupo a-classificar).
  - Somente leitura: o botão continua e leva à base filtrada pelo número, sem abrir o formulário.

- [ ] **Step 4: Run** the e2e suite. Expected: PASS.

- [ ] **Step 5: Commit** — `Exceções a tratar abrem o CT-e na base ou o CNPJ no cadastro`

### Task 5: Data de corte nas telas

**Files:**
- Modify: `src/telas/dados.js` (card "Data de corte")
- Modify: `src/telas/evolucao.js` (aviso no topo; as `listas()` dos filtros usam `ctesNoCorte`)
- Modify: `src/telas/rotas.js` (só se usar `d.ctes` direto)
- Modify: `src/telas/lancamentos.js`:
  - `filtrar(..., { aplicarCorte: false })`;
  - selo `antes do corte` na coluna Emissão, `<span class="sub">antes do corte</span>`.
- Test: `test/e2e/dados.test.js`, `test/e2e/evolucao.test.js`

**Interfaces:**
- Consumes: `definirCorte`, `ctesNoCorte`, `noCorte` (Task 1).

- [ ] **Step 1: Write the failing e2e tests** (base com 1 CT-e de julho e 3 de agosto, `corte "2026-08-01"`):
  - Evolução mostra "3 CT-e no recorte" e o aviso "1 CT-e emitido antes de 01/08/2026 fora da análise".
  - Lançamentos lista os 4, e o de julho tem o selo "antes do corte".
  - Em Dados, trocar a data de corte para `2026-07-01` e salvar faz a Evolução mostrar 4.
  - Review Focus 2: apagar a data e salvar também mostra 4, sem aviso.

- [ ] **Step 2: Run** the e2e suite. Expected: FAIL.

- [ ] **Step 3: Implement**
  - Card em Dados:
    - título "Data de corte";
    - texto "CT-e emitidos antes desta data ficam na base, mas fora da Evolução, das Rotas, das exceções e da classificação. Vazio = todos entram.";
    - `input type=date` mais o botão "Salvar data de corte" (`data-escreve`);
    - a mudança vai por `App.alterar(... acoes.definirCorte ...)`.

- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.

- [ ] **Step 5: Commit** — `Data de corte ajustável em Dados; CT-e antes do corte ficam fora da análise`

### Task 6: Gráfico de pontos por CT-e com gradiente

**Files:**
- Modify: `src/graficos.js`:
  - novas `corGradiente`, `escalaPercentil`, `pontosCtes`;
  - remove `linhasMensais` e `CORES_SERIES` se nada mais os usar.
- Modify: `src/hash.js` (chave `mediana`; só `"0"` é gravado)
- Modify: `src/telas/evolucao.js` (card do gráfico, legenda em gradiente, seletor da mediana, dica e clique)
- Modify: `src/estilo/app.css` (`.legenda-gradiente`, `circle.cte`, `circle.cte.preso`, `path.mediana`)
- Test: `test/graficos.test.js`, `test/hash.test.js`, `test/e2e/evolucao.test.js`

**Interfaces:**
- Produces:
  - `corGradiente(t: number) -> "#rrggbb"`. `t` é cortado em [0, 1]: 0 → `#112346`, 0,5 → `#8e5aa8`, 1 → `#e4536c`, interpolação linear em RGB entre as paradas.
  - `escalaPercentil(valores: number[]) -> { min, max }`. Do percentil 5 ao 95 (interpolação linear nos ordenados), com 8% de folga em cada lado, passado pelas marcas "redondas" que já existem (`marcas`).
  - `pontosCtes(pontos: {data, valor, chave}[], { medianas = [] as {mes, valor}[], largura = 760, altura = 300, formatar }) -> svg string`:
    - `circle.cte` com `data-chave`, `r="4.5"`, `fill` = `corGradiente` da posição do valor entre o menor e o maior do recorte;
    - ponto fora da escala: preso na borda, com classe `preso` e contorno;
    - mediana: `path.mediana` em degraus, um patamar por mês, do dia 1 ao último dia;
    - eixo horizontal por data, do 1º dia do primeiro mês ao último dia do último mês, com uma marca por mês (`fmtMes`).

- [ ] **Step 1: Write the failing tests**
  - `corGradiente`:
    - `(0) === "#112346"`;
    - `(1) === "#e4536c"`;
    - `(0.5) === "#8e5aa8"`;
    - `(-1) === "#112346"`.
  - `escalaPercentil` de `[100, 101, …, 119, 5000]` (21 valores):
    - `max < 5000`;
    - `min <= 100`.
  - `pontosCtes`:
    - com 21 pontos, inclusive o de 5000, tem 21 `circle.cte` e exatamente 1 `preso`;
    - Review Focus 5: com um único ponto, ou com 3 pontos de mesmo valor, não contém `NaN`, e o `fill` é `#8e5aa8`;
    - com `medianas` de 2 meses, tem um `path.mediana`; sem `medianas`, nenhum.
  - Hash:
    - `lerHash("#evolucao?mediana=0").filtros.mediana === "0"`;
    - `escreverHash("evolucao", { metrica: "tonelada", mediana: "0" })` contém `mediana=0`.
  - **E2E:**
    - a Evolução tem `circle.cte` em número igual ao de CT-e com a métrica no recorte;
    - a legenda mostra "mais barato" e "mais caro" com os valores das pontas;
    - clicar no seletor "Mediana do mês: desligada" remove o `path.mediana`;
    - passar o mouse num ponto mostra a dica com o nº do CT-e;
    - clicar no ponto abre o CT-e em Lançamentos (`App.abrirCte`, da Task 4).

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - Texto do card:
    - título "Evolução por CT-e";
    - dica "Cada ponto é um CT-e, na data de emissão. A cor vai do azul (frete mais barato do recorte) ao rosa (mais caro). A linha tracejada é a mediana do mês. Clique num ponto para abrir o CT-e.";
    - pontos presos na borda: "fora da escala; o valor real aparece ao passar o mouse".
  - A mediana mensal vem de `serieMensal`/`medianasPorMes`; exportar `medianasPorMes` de `agregacao.js`, se preciso.
  - A tabela de transportadores fica como está.

- [ ] **Step 4: Run** `npm test && npm run montar && npm run test:e2e`. Expected: PASS.

- [ ] **Step 5: Commit** — `Evolução: um ponto por CT-e em gradiente, com a mediana do mês opcional`

### Task 7: Logos Dínamo | Tóliman

**Files:**
- Create: `referencia/toliman-paineis/logo-toliman-empilhada.png` (cópia da imagem enviada, 940 × 516)
- Create: `scripts/montar-logos.py`. Entradas: `logo-dinamo-cor.png` e `logo-toliman-empilhada.png`. Saídas: `logos-cor.png` e `logos-branco.png`, todas em `referencia/toliman-paineis/`.
- Delete: `referencia/toliman-paineis/logo-toliman-cor.png`, `logo-toliman-branco.png` e `logo-dinamo-branco.png` (não usadas mais)
- Modify: `src/index.template.html` (topo e rodapé com um `<img>` cada)
- Modify: `scripts/montar.mjs` (placeholders `{{LOGOS_COR}}` e `{{LOGOS_BRANCO}}`)
- Modify: `src/estilo/app.css` (`.logos-cor img`: altura 44px, 34px com a barra rolada; `.logos-branco img`: 28px)
- Modify: `referencia/README.md` (de onde vêm as logos e como regerar)
- Test: `test/montar.test.js`, `test/e2e/casca.test.js`

**Interfaces:**
- O script segue a montagem aprovada na prévia:
  - **Tóliman:**
    - o símbolo é a região com alfa > 20 em `x ∈ [360, 600)`, `y < 262`; o nome é o resto;
    - o nome é escalado por `k = 117 / 138` (altura das letras de "Dínamo" ÷ altura das letras de "Tóliman", medidas nas imagens);
    - o símbolo é espelhado, fica com 70% da altura das letras e é centrado nelas, a 14 px do nome.
  - **Montagem:** a Dínamo é deslocada para baixo pela sobra do acento (`round(59 * k)`). Separação de 70 px em cada lado do fio, que é navy com alfa 90 e 4 px de largura.
  - **Branca:** a mesma imagem com RGB = 255 e o alfa mantido.

- [ ] **Step 1: Write the failing tests**
  - `montar.test.js`: `dist/index.html` não contém `{{`, tem exatamente 2 `<img` de logo com `data:image/png;base64`, e não referencia `LOGO_TOLIMAN`.
  - `casca.test.js`: no topo, `.logos-cor img` tem `alt="Grupo Dínamo e Tóliman Transportes"` e altura renderizada de 44 px.

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Generate**
  - Run `python3 scripts/montar-logos.py`. Expected: `logos-cor.png 1914x252` impresso.
  - Read the image to compare it against the approved preview.

- [ ] **Step 4: Implement** the template, CSS and `montar.mjs`. Run `npm test && npm run montar && npm run test:e2e`. Expected: PASS.

- [ ] **Step 5: Commit** — `Assinatura Dínamo | Tóliman no topo e no rodapé`

### Task 8: Conferência com a planilha real, documentação e pacote

**Files:**
- Modify: `scripts/conferir-planilha.mjs`. Novos números impressos:
  - CT-e com itinerário;
  - CNPJ divergente da chave;
  - itinerários divergentes;
  - CT-e fora pelo corte;
  - a classificar no corte;
  - exceções por tipo no corte.
- Modify: `docs/IMPLANTACAO.md`:
  - seguro informado;
  - itinerário e CNPJ automáticos;
  - data de corte;
  - "Abrir na base";
  - aviso de que um painel antigo aberto não grava na base v3 (feche as abas antigas).
- Modify: `README.md` (como regerar itinerários e logos)

- [ ] **Step 1: Run** `node scripts/conferir-planilha.mjs <xlsm>`. Expected:
  - 195 incluídos e 0 rejeitados;
  - 155 fora pelo corte.
  - Anote os outros números para o relatório.

- [ ] **Step 2: Update the docs** with those numbers. The "Classificar CT-e" step changes: só os CT-e de agosto em diante aparecem.

- [ ] **Step 3: Run** `npm test && npm run montar && npm run test:e2e`. Expected: tudo PASS. Then look at `dist/index.html` in the browser: Evolução, Lançamentos, Dados, light and dark, 1280 px.

- [ ] **Step 4: Commit and push** to `claude/compassionate-hopper-b5gz9t`, then update `main` (`git push origin claude/compassionate-hopper-b5gz9t:main`, fast-forward).
  - Gere de novo o zip "Radar de Fretes - Carga Solta.zip" no scratchpad, com o HTML e o LEIA-ME atualizados.
  - Entregue o zip ao usuário.
