# Radar de Fretes · Carga Solta — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel HTML de um arquivo só, aberto de uma pasta do SharePoint, onde a equipe lança CT-e de concorrentes de carga solta e acompanha, por rota, a evolução mensal do preço por saca de cada transportador.

**Architecture:** Módulos ES pequenos em `src/`, sem DOM nos módulos de regra (testados em Node). O `esbuild` junta tudo num IIFE que o `scripts/montar.mjs` embute, com CSS e logos em base64, em `dist/index.html`. Os dados ficam em `radar-carga-solta-dados.js` ao lado do HTML, gravados pela File System Access API com trava por `salvoEm`, junção, backups e salvamento automático, no mesmo mecanismo do Radar de Fretes Tóliman.

**Tech Stack:** JavaScript (ES2022, sem framework), Node 22 (`node --test`), esbuild 0.24.0 (dev), xlsx 0.18.5 (dev, nos testes; em produção via cdnjs), Playwright 1.63 (já instalado globalmente; `require('playwright')`), Chromium.

**Spec:** `docs/superpowers/specs/2026-10-28-radar-carga-solta-design.md` (ler inteira antes da Task 1).

**Referência:**
- `referencia/toliman-paineis/` tem tokens, bundle.css, README do design system e os logos brancos.
- `referencia/radar-fretes/gravacao-pasta.js` é o código de gravação do Radar, a portar na Task 6.

## Global Constraints

- Todo texto de interface em **português do Brasil**. Números em pt-BR: `1.234,56`, `R$ 175,00`, `18,4%`. Sem emoji, sem ponto de exclamação, sem ícones.
- Visual Tóliman Painéis:
  - fontes Barlow Condensed (`--font-disp`), IBM Plex Sans (`--font-body`) e IBM Plex Mono (`--font-mono`), pelo Google Fonts;
  - cartões quadrados (`radius-none`);
  - `accent` (#e4536c) é a única cor de sinal; quando o acento é texto sobre branco, usar `accent-d` (#c63e56);
  - topo e rodapé `navy` (#112346).
- Arquivo de dados: `radar-carga-solta-dados.js`, conteúdo `window.RADAR_CS=` + JSON + `;`, com `"</"` escapado como `"<\/"`. Backups em `backups/`, máximo **60**.
- Fórmulas (arredondar a 2 casas em cada passo):
  - `valorSeguro = valorAssegurado × taxaSeguro`
  - `tarifa = valorFrete − valorSeguro − adicionais`
  - `precoSaca = tarifa ÷ sacas`
- Tolerância de conferência com a planilha: **R$ 0,05**.
- Agrupamento por **raiz do CNPJ** = 8 primeiros dígitos. Nome do grupo = nome do cadastro da matriz (`/0001`, dígitos 9–12 = `0001`), senão o primeiro cadastrado em ordem de CNPJ.
- Rota = `origem + " → " + destino`. Comparação de cidades em maiúsculas sem acento. Mês = `AAAA-MM` da emissão.
- Exceção de preço: fora de **[⅓ × mediana, 3 × mediana]** da rota, só com **≥ 3** CT-e com preço por saca na rota.
- Log: guarda as **500** últimas ações.
- Gráfico: os **6** transportadores com mais CT-e no recorte ganham cor; os demais ficam em `steel-l`.
- Gravação automática **1 s** após a última alteração. A gravação só existe em `file:` com `window.showDirectoryPicker`; fora disso o painel é somente leitura e diz isso no topo.
- A planilha real `Radar_Fretes_Concorrentes_v2.10.xlsm` **nunca** entra no repositório (tem CNPJs de clientes). Os testes usam dados fictícios.
- Sem dependências em tempo de execução além de SheetJS `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` e Google Fonts.

## Review Focus

1. **Planilha com valores como texto ou com CNPJ numérico sem zeros à esquerda** (ex.: `7668709000109`, `"1.234,56"`). A importação deve recompor os 14 dígitos e converter número pt-BR; teste na Task 4 (`normalizarLinha aceita texto pt-BR e CNPJ numérico`).
2. **Dois usuários gravando quase ao mesmo tempo.** O segundo não pode sobrescrever o primeiro: o conflito é detectado e "Juntar e salvar" preserva os dois lados. Testes na Task 6 (`salvar detecta conflito` e `juntar preserva lançamento do outro e exclusão local`).
3. **Mês sem CT-e no meio do período.** A linha do gráfico interrompe em vez de cair a zero, e a variação compara com o último mês *com dados*. Testes na Task 3 (`variacao pula meses vazios`) e na Task 7 (`linhasMensais quebra a linha em mês vazio`).
4. **CT-e com sacas = 0 ou vazio.** `precoSaca` fica `null` (nunca `Infinity` ou `NaN`); o CT-e conta na tarifa e vira exceção. Testes nas Tasks 1 e 3.
5. **Texto do usuário com `</script>` ou aspas** em observações ou nomes. Não pode quebrar o arquivo de dados nem injetar HTML na tela. Teste na Task 6 (`montarDadosJs escapa </`) e regra de `esc()` em toda interpolação de HTML (Task 8, teste `esc escapa < > & "`).

---

## Estrutura de arquivos

```
package.json                 scripts: test, test:e2e, montar
src/calculos.js              fórmulas, CNPJ, chave, texto, mês, rota
src/formato.js               formatação pt-BR, esc()
src/base.js                  estado em memória: incluir/corrigir/excluir/restaurar/cadastro/log
src/agregacao.js             filtros, séries mensais, rotas, transportadores, exceções
src/importacao.js            planilha → linhas normalizadas; aplicar importação na base
src/arquivo.js               texto do arquivo de dados ↔ objeto; nome de backup; juntar
src/pasta.js                 File System Access: conectar, salvar, backups, fila automática
src/graficos.js              SVG em texto: linhas mensais com faixa; mini-gráfico
src/app.js                   ponto de entrada: carrega dados, menu, estado global, roteamento por hash
src/telas/evolucao.js
src/telas/rotas.js
src/telas/lancamentos.js
src/telas/cadastro.js
src/telas/dados.js
src/estilo/app.css           layout do painel sobre o bundle do Tóliman Painéis
src/index.template.html      esqueleto com marcadores /*CSS*/ /*JS*/ e {{LOGO_*}}
scripts/tokens-css.mjs       referencia/toliman-paineis/tokens.json → build/tokens.css
scripts/montar.mjs           esbuild + CSS + logos → dist/index.html
test/*.test.js               unidade (node:test)
test/e2e/painel.test.js      navegador (Playwright)
test/fixtures/planilha.js    gera planilha fictícia com xlsx
docs/IMPLANTACAO.md          como instalar na pasta do SharePoint
```

---

### Task 1: Projeto, cálculos e formatação

**Files:**
- Create: `package.json`, `.gitignore`, `src/calculos.js`, `src/formato.js`, `test/calculos.test.js`, `test/formato.test.js`

**Interfaces:**
- Produces (`src/calculos.js`):
  - `arred2(n: number): number`
  - `calcularCte(c: {valorAssegurado, taxaSeguro, valorFrete, adicionais, sacas}): {valorSeguro: number, tarifa: number, precoSaca: number|null}`
  - `soDigitos(v: any): string`
  - `normalizarCnpj(v: string|number): string`: 14 dígitos com zeros à esquerda; `""` se vazio.
  - `raizCnpj(cnpj: string): string`
  - `ehMatriz(cnpj: string): boolean`
  - `chaveValida(chave: string): boolean`: 44 dígitos.
  - `numeroDaChave(chave: string): number|null`: posições 26–34 (1-based), ou seja, `chave.slice(25, 34)`.
  - `normalizarCidade(s: string): string`: maiúsculas, sem acento, espaços colapsados.
  - `rotaDe(cte): string` → `"ORIGEM → DESTINO"`.
  - `mesDe(isoData: string): string` → `"AAAA-MM"`.
  - `numeroBR(v: any): number|null`: aceita number, `"1.234,56"`, `"1234.56"`, `""`/null→null.
- Produces (`src/formato.js`):
  - `fmtNum(n, casas = 0): string`
  - `fmtMoeda(n): string` → `"R$ 1.234,56"`
  - `fmtPct(n, casas = 1): string`: recebe fração, ex. 0.184 → `"18,4%"`.
  - `fmtCnpj(cnpj): string` → `"07.668.709/0001-09"`
  - `fmtData(iso): string` → `"10/01/2026"`
  - `fmtMes(aaaaMm): string` → `"jan/26"`
  - `fmtMesLongo(aaaaMm): string` → `"Janeiro de 2026"`
  - `fmtQuando(iso): string` → `"28/10/2026 14:03"` (hora local)
  - `esc(s): string`: escapa `& < > "`.

- [ ] **Step 1: Criar `package.json`.**
  - `"type": "module"`, `"private": true`.
  - Scripts: `"test": "node --test test/"`, `"test:e2e": "node --test test/e2e/"`, `"montar": "node scripts/tokens-css.mjs && node scripts/montar.mjs"`.
  - devDependencies `esbuild@0.24.0` e `xlsx@0.18.5`; rodar `npm install`.
  - `.gitignore`: `node_modules/`, `build/`, `*.xlsm`, `*.xlsx`, `test-results/`. `dist/` **é** versionado, porque é o que vai para a pasta.

- [ ] **Step 2: Escrever os testes que falham** em `test/calculos.test.js`. Casos tirados da planilha real:

```js
test("calcularCte reproduz a planilha", () => {
  assert.deepEqual(calcularCte({ valorAssegurado: 917213.08, taxaSeguro: 0.0005, valorFrete: 29141.78, adicionais: 0, sacas: 666 }),
    { valorSeguro: 458.61, tarifa: 28683.17, precoSaca: 43.07 });
  assert.deepEqual(calcularCte({ valorAssegurado: 119322.29, taxaSeguro: 0, valorFrete: 8750, adicionais: 0, sacas: 50 }),
    { valorSeguro: 0, tarifa: 8750, precoSaca: 175 });
});
test("sacas zeradas ou vazias dão precoSaca null", () => {
  assert.equal(calcularCte({ valorAssegurado: 1, taxaSeguro: 0, valorFrete: 100, adicionais: 0, sacas: 0 }).precoSaca, null);
  assert.equal(calcularCte({ valorAssegurado: 1, taxaSeguro: 0, valorFrete: 100, adicionais: 0, sacas: null }).precoSaca, null);
});
test("normalizarCnpj recompõe zeros e aceita máscara", () => {
  assert.equal(normalizarCnpj(7668709000109), "07668709000109");
  assert.equal(normalizarCnpj("07.668.709/0001-09"), "07668709000109");
  assert.equal(normalizarCnpj(""), "");
});
test("raiz e matriz", () => {
  assert.equal(raizCnpj("07668709000290"), "07668709");
  assert.equal(ehMatriz("07668709000109"), true);
  assert.equal(ehMatriz("07668709000290"), false);
});
test("numeroDaChave", () => {
  assert.equal(numeroDaChave("35260105780969000146570010000106001000120718"), 10600);
  assert.equal(chaveValida("3526"), false);
});
test("cidade, rota e mês", () => {
  assert.equal(normalizarCidade("  São  Joaquim da Barra "), "SAO JOAQUIM DA BARRA");
  assert.equal(rotaDe({ origem: "Cacoal", destino: "santos" }), "CACOAL → SANTOS");
  assert.equal(mesDe("2026-01-10"), "2026-01");
});
test("numeroBR", () => {
  assert.equal(numeroBR("1.234,56"), 1234.56);
  assert.equal(numeroBR(1234.56), 1234.56);
  assert.equal(numeroBR(""), null);
});
```

  Em `test/formato.test.js`: `fmtMoeda(1234.5) === "R$ 1.234,50"`, `fmtPct(0.184) === "18,4%"`, `fmtCnpj("07668709000109") === "07.668.709/0001-09"`, `fmtMes("2026-01") === "jan/26"`, `fmtMesLongo("2026-07") === "Julho de 2026"`, e:

```js
test("esc escapa < > & \"", () => assert.equal(esc(`<b a="1">&`), "&lt;b a=&quot;1&quot;&gt;&amp;"));
```

  O nome do teste `esc escapa < > & "` é referenciado pela Review Focus 5.

- [ ] **Step 3: Rodar `npm test`.** Esperado: FAIL, módulos inexistentes.
- [ ] **Step 4: Implementar `src/calculos.js` e `src/formato.js`** com as assinaturas acima. Usar `Intl.NumberFormat("pt-BR")`. `fmtMoeda` deve produzir espaço comum entre `R$` e o número (trocar o NBSP de `Intl` por `" "`).
- [ ] **Step 5: Rodar `npm test`.** Esperado: PASS.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Cálculos e formatação do CT-e de carga solta"`.

---

### Task 2: Base em memória (lançar, corrigir, excluir, restaurar, cadastro, log)

**Files:**
- Create: `src/base.js`, `test/base.test.js`

**Interfaces:**
- Consumes: `calcularCte`, `normalizarCnpj`, `chaveValida`, `normalizarCidade`, `raizCnpj`, `ehMatriz` (Task 1).
- Produces:
  - `novaBase(): Dados`: `{versao:1, salvoEm:null, salvoPor:null, ctes:[], cnpjs:[], lixeira:[], log:[]}`. Formato `Cte` conforme a spec §5.
  - `validarCampos(campos): {ok: boolean, erros: {[campo]: string}}`.
    - Obrigatórios: `chave` (44 dígitos), `numero`, `emissao` (AAAA-MM-DD), `cnpjTransportador`, `cnpjCliente` (14 dígitos), `origem`, `destino`, `valorFrete > 0`, `sacas > 0`.
    - Mensagens, por exemplo: `"Chave de acesso precisa ter 44 dígitos."`, `"Informe as sacas."`.
  - `incluir(d: Dados, campos, quem: string, agora: string, origemLancamento = "formulario"): {ok: true, cte} | {ok: false, erros?, existente?: Cte}`.
    - Normaliza CNPJ e cidades e calcula os campos derivados.
    - Chave já existente (em `ctes`): `{ok:false, existente}`. Chave na lixeira também bloqueia, com `existente` e `naLixeira: true`.
    - Grava log `incluir`.
  - `corrigir(d, chave, campos, quem, agora)`: mesmas regras; não permite mudar a chave; log `corrigir`.
  - `excluir(d, chave, quem, agora)`: move para `lixeira` como `{cte, excluidoPor, excluidoEm}`; log `excluir`.
  - `restaurar(d, chave, quem, agora)`: volta para `ctes`; log `restaurar`.
  - `cadastrarCnpj(d, cnpj, nome, quem, agora)`: inclui ou renomeia (nome em maiúsculas, aparado); log `cadastro`.
  - `nomeDoCnpj(d, cnpj): string|null`
  - `grupoDoCnpj(d, cnpj): {raiz: string, nome: string}`: regra da matriz (Global Constraints); sem cadastro, o nome é `"CNPJ " + fmtCnpj(cnpj)`.
  - `registrar(d, acao, quem, agora, chave, resumo)`: empurra no log e corta em 500.

- [ ] **Step 1: Escrever os testes que falham** em `test/base.test.js`:
  - `incluir calcula e registra quem e quando`: `cte.precoSaca === 175`, `cte.criadoPor === "Ana"`, `d.log.at(-1).acao === "incluir"`.
  - `incluir bloqueia chave repetida e devolve o existente`: segundo `incluir` com a mesma chave → `ok:false` e `existente.numero === 10600`.
  - `chave na lixeira também bloqueia`: `naLixeira === true`.
  - `validarCampos exige sacas e frete`: `erros.sacas` e `erros.valorFrete` definidos.
  - `corrigir recalcula e não troca a chave`: `alteradoPor` é preenchido.
  - `excluir manda para a lixeira e restaurar devolve`.
  - `grupo usa o nome da matriz e junta filiais`: cadastro `07668709000290 → "ATMA FILIAL"` e `07668709000109 → "ATMA LOGISTICA"`; `grupoDoCnpj(d, "07668709000290")` deve dar `{raiz: "07668709", nome: "ATMA LOGISTICA"}`.
  - `log guarda só as 500 últimas`.
- [ ] **Step 2: Rodar `npm test`.** Esperado: FAIL.
- [ ] **Step 3: Implementar `src/base.js`.**
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Base em memória: lançar, corrigir, lixeira, cadastro e log"`.

---

### Task 3: Agregação (filtros, séries mensais, rotas, exceções)

**Files:**
- Create: `src/agregacao.js`, `test/agregacao.test.js`

**Interfaces:**
- Consumes: `rotaDe`, `mesDe`, `raizCnpj` (Task 1); `grupoDoCnpj` (Task 2).
- Produces:
  - `Filtros = {rota?: string, transportador?: raiz, cliente?: raiz, itinerario?: string, mesIni?: "AAAA-MM", mesFim?: "AAAA-MM", metrica: "saca"|"tarifa"}`
  - `valorMetrica(cte, metrica): number|null`: `precoSaca` ou `tarifa`.
  - `filtrar(d, filtros): Cte[]`
  - `mediana(nums: number[]): number|null`
  - `mesesEntre(ini, fim): string[]`: inclusivo.
  - `serieMensal(d, ctes, metrica): {meses: string[], series: [{raiz, nome, n, pontos: {[mes]: {mediana, min, max, n}}}]}`.
    - Uma série por transportador (raiz), ordenada por `n` decrescente.
    - `meses` vai do primeiro ao último mês do recorte.
  - `resumoGeral(ctes, metrica): {ultimoMes, valor, mesAnterior, variacao, nCtes, nSacas, nTransportadores, nRotas}`.
    - `valor` = mediana do último mês com dados.
    - `variacao` = valor ÷ mediana do mês anterior **com dados** − 1, ou `null`.
  - `resumoRotas(d, metrica): [{rota, nCtes, nTransportadores, ultimoMes, valor, variacao, porMes: {[mes]: mediana}}]`, ordenado por `nCtes` decrescente.
  - `transportadoresNaRota(d, ctes, metrica): [{raiz, nome, nCtes, ultimo: {valor, emissao}, mediana, variacao}]`. Aqui `variacao` = mediana do último mês ÷ mediana do primeiro mês com dados − 1.
  - `excecoes(d): [{tipo: "preco-fora"|"sem-cadastro"|"sem-sacas"|"diverge-planilha", cte?, cnpj?, detalhe: string}]`. As regras estão na spec §7 e nos Global Constraints. `diverge-planilha` vem de `cte.divergencia` (definido na Task 4).

- [ ] **Step 1: Escrever os testes que falham.** A base fictícia tem a rota A→B com 3 transportadores e os meses `2026-01`, `2026-02`, *(sem 03)* e `2026-04`. Casos:
  - `mediana de pares e ímpares`: `[1,3]→2`, `[1,2,9]→2`, `[]→null`.
  - `filtrar por rota, raiz e período`.
  - `serieMensal agrupa filiais na mesma série`: dois CNPJ com a mesma raiz geram uma série com `n` somado.
  - `variacao pula meses vazios`: o resumo com último mês `2026-04` compara contra `2026-02` (nome referenciado pela Review Focus 3).
  - `sem sacas fica fora da métrica saca e dentro da tarifa`: `valorMetrica(cteSemSacas, "saca") === null`, e o CT-e é contado em `serieMensal(..., "tarifa")`.
  - `excecao preço fora só com 3 ou mais na rota`: na rota com 2 CT-e não sinaliza; com 4 CT-e (175, 170, 180, 900) sinaliza o de 900.
  - `excecao sem cadastro e sem sacas`.
- [ ] **Step 2: Rodar `npm test`.** Esperado: FAIL.
- [ ] **Step 3: Implementar `src/agregacao.js`.**
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Agregação mensal, rotas e exceções"`.

---

### Task 4: Importação da planilha

**Files:**
- Create: `src/importacao.js`, `test/fixtures/planilha.js`, `test/importacao.test.js`

**Interfaces:**
- Consumes: Task 1 inteira; `incluir`, `cadastrarCnpj` (Task 2).
- Produces:
  - `ABA_BASE = "BASE CARGA SOLTA 2026"`, `ABA_CNPJ = "BASE DE DADOS CNPJ"`.
  - `lerPlanilha(XLSX, dados: ArrayBuffer): {linhas: object[], cnpjs: [{cnpj, nome}], erro?: string}`.
    - Usa `XLSX.read(buf, {type:"array", cellDates:true})` e `sheet_to_json(ws, {defval:null})`.
    - Sem a aba base: `erro = "A planilha não tem a aba BASE CARGA SOLTA 2026."`.
    - A aba de CNPJ é opcional.
  - `normalizarLinha(linha, numLinha): {ok: true, campos, planilha: {valorSeguro, tarifa, precoSaca}, nomes: {transportador, cliente}} | {ok: false, numLinha, motivo}`.
    - Mapeia os cabeçalhos exatos da planilha (`"CHAVE DE ACESSO"`, `"N° CT-e"`, `"EMISSÃO CT-e"`, …, `"PREÇO POR SACAS"`, `"TARIFA DO FRETE"`, `"VPO"`, `"OBSERVAÇÕES"`).
    - `vpo = valor === "SIM"`.
    - `emissao` aceita `Date` ou `"dd/mm/aaaa"`.
  - `aplicarImportacao(d, resultado, quem, agora): {incluidos, pulados, rejeitados: [{numLinha, motivo}], cadastrados, divergentes}`.
    - Cadastra os CNPJ da aba de CNPJ e, para os que faltarem, o nome que veio na linha.
    - Chave já existente → `pulados++`.
    - Se o cálculo divergir da planilha em mais de 0,05 em qualquer um dos três campos: mantém os valores da planilha no CT-e e grava `cte.divergencia = {calculado: {...}, planilha: {...}}`, contando em `divergentes`.
    - Usa `origemLancamento = "importacao"`.
    - Uma só entrada de log `importar`, com o resumo em texto.
- `test/fixtures/planilha.js` exporta `gerarPlanilha(linhas, cnpjs?, opcoes?) → ArrayBuffer`. Monta com `xlsx` (dev) as duas abas, com os cabeçalhos exatos de `referencia` (spec §3).

- [ ] **Step 1: Escrever os testes que falham:**
  - `importa as linhas e cadastra os CNPJ`: 3 linhas válidas → `incluidos === 3`.
  - `pula chave repetida na segunda importação`: `pulados === 3`.
  - `rejeita linha sem chave e sem sacas com o motivo`: `rejeitados[0].numLinha === 2` (linha da planilha, contando o cabeçalho como 1).
  - `normalizarLinha aceita texto pt-BR e CNPJ numérico`: `"VALOR DO FRETE": "8.750,00"` e `"CNPJ DO CLIENTE": 44209336003583` (nome referenciado pela Review Focus 1).
  - `divergência mantém o número da planilha`: `"TARIFA DO FRETE"` 8700 com frete 8750 e sem seguro → `cte.tarifa === 8700` e `divergentes === 1`.
  - `planilha sem a aba base dá erro claro`.
- [ ] **Step 2: Rodar `npm test`.** Esperado: FAIL.
- [ ] **Step 3: Implementar `src/importacao.js` e a fixture.**
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS.
- [ ] **Step 5: Conferência local com a planilha real (não versionar).**
  - Criar `scripts/conferir-planilha.mjs <caminho.xlsm>`, que imprime o resumo de `aplicarImportacao` e o número de linhas cuja tarifa ou preço por saca difere da planilha.
  - Rodar com o arquivo do usuário em `/root/.claude/uploads/4734fbf5-a53f-503e-93a8-706ffdcec108/666696e9-Radar_Fretes_Concorrentes_v2.10.xlsm`.
  - Esperado: `incluidos: 195, pulados: 0, rejeitados: 0, divergentes: 0`.
  - O script é versionado; a planilha não.
- [ ] **Step 6: Commit** `"Importação da planilha Radar de Fretes (carga solta)"`.

---

### Task 5: Arquivo de dados e junção

**Files:**
- Create: `src/arquivo.js`, `test/arquivo.test.js`

**Interfaces:**
- Produces:
  - `ARQ_DADOS = "radar-carga-solta-dados.js"`, `PASTA_BKP = "backups"`, `MAX_BKP = 60`, `MARCA = "window.RADAR_CS="`.
  - `lerDadosJs(texto: string): Dados|null`: `null` se faltar a marca, o JSON for inválido ou não houver `ctes` array.
  - `montarDadosJs(d: Dados): string`. Cabeçalho em comentário com "Radar de Fretes · Carga Solta — arquivo de dados. Não edite à mão." e `salvoEm`, depois `MARCA + JSON + ";\n"`, com `"</"` → `"<\\/"`.
  - `nomeBackup(iso: string): string` → `"radar-carga-solta-dados 2026-10-28 14h03m11s.js"` (hora local).
  - `ehBackup(nome): boolean`
  - `podar(nomes: string[], max = MAX_BKP): string[]`: devolve os nomes a remover, os mais antigos.
  - `Sessao = {alterados: Set<chave>, excluidos: Set<chave>, restaurados: Set<chave>, cadastro: Map<cnpj, nome>, log: LogEntry[]}`, criado por `novaSessao()`.
  - `juntar(arquivo: Dados, tela: Dados, sessao: Sessao): Dados`.
    - Parte do `arquivo`.
    - Para cada chave em `alterados ∪ restaurados`, usa o CT-e da `tela` e o retira da lixeira do arquivo.
    - Para cada chave em `excluidos`, move do `ctes` do arquivo para a lixeira, usando a entrada de lixeira da `tela`.
    - Aplica `cadastro` por cima de `cnpjs`.
    - Acrescenta `sessao.log` ao log do arquivo e corta em 500.
    - Não muda `salvoEm`.
  - `resumoConflito(arquivo, tela, sessao): string`, em pt-BR, no estilo do Radar (`referencia/radar-fretes/gravacao-pasta.js`, função `resumoConflito`): quantos CT-e entram, mudaram e saem, e quantas alterações desta página.

- [ ] **Step 1: Escrever os testes que falham:**
  - `montarDadosJs e lerDadosJs fazem ida e volta`.
  - `montarDadosJs escapa </` (Review Focus 5): observação `"x</script><b>"` → o texto não contém `"</script>"` e `lerDadosJs` devolve a observação original.
  - `lerDadosJs rejeita texto sem marca`.
  - `podar mantém os 60 mais novos`: com 62 nomes, remove os 2 mais antigos.
  - `juntar preserva lançamento do outro e exclusão local` (Review Focus 2): o arquivo tem o CT-e X lançado por outra pessoa; a tela excluiu Y e lançou Z. O resultado tem X e Z, Y está na lixeira, e o log tem as entradas dos dois lados.
  - `juntar aplica correção local sobre o arquivo`.
- [ ] **Step 2: Rodar `npm test`.** Esperado: FAIL.
- [ ] **Step 3: Implementar `src/arquivo.js`.**
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Arquivo de dados, backups e junção"`.

---

### Task 6: Gravação na pasta

**Files:**
- Create: `src/pasta.js`, `test/pasta.test.js`, `test/fakes/pasta-falsa.js`

**Interfaces:**
- Consumes: Task 5 inteira.
- Produces:
  - `criarGravador({ obterTela: () => Dados, obterSessao: () => Sessao, aoMudar: (estado) => void, idb? })` retorna um objeto com:
    - `pasta: FileSystemDirectoryHandle|null`
    - `baseSalvoEm: string|null`: carimbo carregado.
    - `estado: "somente-leitura"|"desconectado"|"salvo"|"pendente"|"salvando"|"conflito"|"erro"`
    - `mensagem: string`
    - `async conectar(handle?)`: sem argumento, chama `showDirectoryPicker({id:"radar-carga-solta", mode:"readwrite"})`. Exige `ARQ_DADOS` na pasta; ao conectar, guarda o handle no IndexedDB `radar-carga-solta`/`arq`/`"pasta"`.
    - `async reconectar()`: lê o handle do IndexedDB.
    - `async salvar({juntar=false, quem}): {ok, conflito?, msg}`.
    - `marcarAlterado()`: estado `pendente` e agenda `salvar` em 1 s, numa fila serial.
    - `async criarArquivoInicial(handle)`: para a primeira instalação, grava uma base vazia se a pasta não tiver o arquivo, com confirmação na tela da Task 12.
  - O algoritmo de `salvar` segue `salvarNaPasta` da referência:
    1. permissão;
    2. ler o arquivo;
    3. `lerDadosJs`, com erro claro se estiver ilegível;
    4. se `arquivo.salvoEm !== baseSalvoEm` e não pediu para juntar → estado `conflito`, `mensagem = resumoConflito(...)`, retorna `{ok:false, conflito:true}`;
    5. se pediu para juntar → `juntar`;
    6. backup com `nomeBackup(arquivo.salvoEm)` (se o nome já existir, não regrava) e `podar`;
    7. `salvoEm = new Date().toISOString()`, `salvoPor = quem`;
    8. gravar;
    9. `baseSalvoEm = salvoEm`; zerar a sessão (o chamador recebe a base gravada pelo retorno `{ok:true, dados}`).
  - Detecção: `podeGravar = location.protocol === "file:" && !!window.showDirectoryPicker`. Quando falso, estado `somente-leitura`. Exportar `podeGravar(env = globalThis)` para teste.
  - Alterações pendentes ficam também no IndexedDB (`pendentes`: `{tela, sessao}` serializados) para sobreviver a fechar a aba. `restaurarPendentes()` devolve-as ao abrir.
- `test/fakes/pasta-falsa.js`: diretório falso em memória com `getFileHandle`, `getDirectoryHandle`, `entries`, `removeEntry`, `queryPermission` e `requestPermission` → `"granted"`, `getFile().text()` e `createWritable().write/close`.

- [ ] **Step 1: Escrever os testes que falham** com a pasta falsa:
  - `salvar grava o arquivo e faz backup do anterior`.
  - `salvar detecta conflito` (Review Focus 2): outra "página" grava antes → `{ok:false, conflito:true}`, e o arquivo continua o da outra.
  - `salvar com juntar preserva os dois lados`.
  - `arquivo ilegível não é sobrescrito`.
  - `fila automática não grava duas vezes ao mesmo tempo`: duas chamadas de `marcarAlterado` seguidas resultam em uma escrita por vez (contar escritas simultâneas na pasta falsa).
  - `podeGravar é falso fora de file:`.
  - IndexedDB: injetar `idb` falso (objeto com `get/put`) para não depender do navegador.
- [ ] **Step 2: Rodar `npm test`.** Esperado: FAIL.
- [ ] **Step 3: Implementar `src/pasta.js`**, portando de `referencia/radar-fretes/gravacao-pasta.js` sem acoplar ao DOM (a tela observa `aoMudar`).
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Gravação na pasta compartilhada com trava, junção e backups"`.

---

### Task 7: Gráficos em SVG

**Files:**
- Create: `src/graficos.js`, `test/graficos.test.js`

**Interfaces:**
- Consumes: `serieMensal` output (Task 3), `fmtMes`, `esc` (Task 1).
- Produces:
  - `CORES_SERIES = ["var(--navy)", "var(--accent)", "var(--plum)", "var(--yard-20)", "var(--pie-6)", "var(--pie-5)"]`
  - `linhasMensais({meses, series}, {largura = 760, altura = 300, formatar}): string`. Devolve um `<svg viewBox>` com:
    - grade horizontal (`class="gl"`), com 5 marcas em valores "redondos";
    - eixo de meses (`class="ax"`, `fmtMes`);
    - para cada série: `<path class="serie" data-raiz>` da mediana, com um segmento novo após mês vazio (comando `M` em vez de `L`);
    - um `<circle class="ponto" data-raiz data-mes data-mediana data-min data-max data-n>` por ponto, que o tooltip lê;
    - para cada ponto, uma linha vertical fina mín–máx (`class="faixa"`, opacidade .35);
    - séries a partir da 7ª em `var(--steel-l)` com `class="serie resto"`.
  - `miniGrafico(porMes: {[mes]: number}, meses: string[], {largura = 120, altura = 28}): string`: polyline `navy` com o último ponto em `accent`, quebrando em mês vazio.

- [ ] **Step 1: Escrever os testes que falham:**
  - `linhasMensais quebra a linha em mês vazio` (Review Focus 3): uma série com pontos em 01, 02 e 04 de 4 meses → o `d` do path contém exatamente 2 comandos `M`.
  - `sétima série fica em steel-l`.
  - `pontos carregam min, max e n`.
  - `escapa nome do transportador no title` (`<title>` usa `esc`).
  - `miniGrafico sem dados devolve svg vazio sem NaN`.
- [ ] **Step 2: Rodar `npm test`.** Esperado: FAIL.
- [ ] **Step 3: Implementar `src/graficos.js`.** Escala y de `min(mín)` a `max(máx)` com 8% de folga. Os rótulos y usam `formatar` (`fmtMoeda` ou `fmtNum`).
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Gráfico mensal por transportador e mini-gráfico"`.

---

### Task 8: Montagem, estilo e casca do painel

**Files:**
- Create: `scripts/tokens-css.mjs`, `scripts/montar.mjs`, `src/estilo/app.css`, `src/index.template.html`, `src/app.js`, `test/montar.test.js`
- Create: `dist/index.html` (gerado, versionado)

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces:
  - `scripts/tokens-css.mjs`:
    - lê `referencia/toliman-paineis/tokens.json` e escreve `build/tokens.css`;
    - em `:root`, `--<nome>` para cada token de `color`, `spacing`, `radius`, `shadow` e `size`;
    - `--font-disp`, `--font-body` e `--font-mono` vêm de `type.families`.
  - `src/estilo/app.css`:
    - Tema escuro sob `@media (prefers-color-scheme: dark)` e `[data-theme="dark"]`. Redefine `paper #0b1222`, `card #121b30`, `line #24304a`, `row-rule #1a2439`, `ink #e6ebf3`, `navy #9fb4dc` (texto e números), `steel #9aa7bd`, `mist #1d2840`, `track #1a2439`, `tint #172036`. O topo e o rodapé continuam com fundo `#112346`, usando a variável `--hero-bg` em vez de `--navy`.
    - Componentes do painel: barra de menu com abas (`.abas button[aria-selected]`), filtros, formulário, aviso fixo de gravação (`.aviso-gravacao`), diálogo de confirmação, tooltip `#tip` do bundle.
  - `scripts/montar.mjs`:
    - roda `esbuild` em `src/app.js` (`bundle:true, format:"iife", target:"es2020", minify:false`);
    - lê `build/tokens.css`, `referencia/toliman-paineis/bundle.css` e `src/estilo/app.css`;
    - substitui `/*CSS*/` e `/*JS*/` no template e `{{LOGO_TOLIMAN}}` e `{{LOGO_DINAMO}}` por data URIs dos PNG brancos;
    - escreve `dist/index.html`;
    - no JS embutido, troca `</script` por `<\/script` antes de inserir.
  - `src/index.template.html`:
    - `<title>Radar de Fretes · Carga Solta</title>`;
    - `<script src="radar-carga-solta-dados.js"></script>` **antes** do app (se faltar, `window.RADAR_CS` fica indefinido e o app usa `novaBase()`);
    - `<script src=".../xlsx/0.18.5/xlsx.full.min.js" defer>`.
  - `src/app.js`:
    - estado global `App = {dados, sessao, filtros, gravador, quem}`;
    - `quem` vem de `localStorage["radar-carga-solta:quem"]` (try/catch); sem nome, abre um diálogo pedindo o nome antes de permitir lançar;
    - menu: Evolução, Rotas, Lançamentos, Cadastro CNPJ, Dados;
    - aba e filtros no `location.hash` (`#evolucao?rota=…&metrica=saca`);
    - `App.alterar(fn)`: aplica `fn(dados, sessao)`, re-renderiza e chama `gravador.marcarAlterado()`;
    - barra de estado de gravação à direita do menu;
    - aviso fixo vermelho quando o estado é `erro`;
    - painel de conflito com "Juntar e salvar" e "Cancelar";
    - rodapé `navy` com logos brancos e a origem dos números (texto exato na spec §6.6).

- [ ] **Step 1: Escrever o teste que falha** `test/montar.test.js`. Roda `npm run montar` e confere que `dist/index.html`:
  - existe;
  - contém `Radar de Fretes · Carga Solta`;
  - contém `--accent:#e4536c`;
  - não contém `</script` dentro do bloco do app além do fechamento.
- [ ] **Step 2: Rodar `npm test`.** Esperado: FAIL.
- [ ] **Step 3: Implementar** tokens-css, montar, template, app.css e app.js, com telas vazias (`<section>` com o título de cada uma).
- [ ] **Step 4: Rodar `npm test` e abrir `dist/index.html`** no Chromium (Playwright, screenshot em `test-results/casca.png`). Esperado: PASS; o menu troca de aba; o topo `navy` aparece; não há erro no console.
- [ ] **Step 5: Commit** `"Montagem em arquivo único, estilo Tóliman Painéis e casca do painel"`.

---

### Task 9: Tela Evolução

**Files:**
- Create: `src/telas/evolucao.js`
- Modify: `src/app.js` (registrar a tela), `src/estilo/app.css`

**Interfaces:**
- Consumes: `filtrar`, `serieMensal`, `resumoGeral`, `transportadoresNaRota`, `excecoes` (Task 3); `linhasMensais` (Task 7); formatação (Task 1); `App` (Task 8).
- Produces: `renderEvolucao(raiz: HTMLElement, App)`.

**Conteúdo** (marcação e classes do bundle: `.hero`, `.eyebrow`, `.bignum`, `.bigcap`, `.split`, `.sec-head`, `.kpis`, `.card`, `.exc`, `.limpo`, `table`):

- **Topo:**
  - eyebrow `fmtMesLongo(ultimoMes)` + `" · último mês com dados"`;
  - h1 `PREÇO POR SACA` com `<em>` mostrando a rota selecionada ou "todas as rotas";
  - `.bignum` com `fmtMoeda(valor)`;
  - `.bigcap` `"Mediana do mês"`;
  - `.split` com variação (`fmtPct`, com sinal), CT-e, transportadores;
  - à direita, o seletor `.modes` `R$/saca | Tarifa R$` (com `aria-pressed`) e os filtros.
- **Filtros:** `<select>` de rota (ordenado por nº de CT-e), transportador (por nome de grupo), cliente, itinerário, mês inicial e final. Mudança → atualizar o hash.
- **Card "Evolução mensal":** o SVG de `linhasMensais`, a legenda (`.legend` adaptada para fundo branco) e a dica *"Mediana do mês por transportador. Passe o cursor para ver mínimo, máximo e número de CT-e."* O tooltip `#tip` mostra nome, mês, mediana, mín–máx e n.
- **KPIs:** CT-e no período, sacas no período, transportadores, rotas.
- **Card "Transportadores nesta rota":**
  - Sem rota escolhida: o texto *"Escolha uma rota para comparar transportadores. Preço por saca de rotas diferentes não se compara."*
  - Com rota: tabela ordenável (clique no `th`) com transportador, CT-e, último preço (data), mediana do período e variação.
- **Seção "Exceções a tratar":**
  - um `.exc` por tipo, com contagem e as 20 primeiras linhas mais "ver todas";
  - a frase *"Todas entram nos totais do painel; ficam aqui para que a correção volte ao lançamento."*;
  - sem exceções, `.limpo` com "Nenhuma exceção".
- **Base vazia:** um card com "Nenhum CT-e lançado ainda" e botões para Lançamentos e Dados (importar).

- [ ] **Step 1: Escrever o teste e2e que falha.** Em `test/e2e/painel.test.js`, o teste `evolução mostra mediana da rota`:
  - injeta via `page.addInitScript` um `window.RADAR_CS` fictício com a rota A→B;
  - abre `dist/index.html#evolucao?rota=A%20%E2%86%92%20B`;
  - espera `.bignum` = `"R$ 175,00"` e 3 `path.serie`.
- [ ] **Step 2: Rodar `npm run montar && npm run test:e2e`.** Esperado: FAIL.
- [ ] **Step 3: Implementar `renderEvolucao`.** Toda interpolação de texto em HTML passa por `esc()`.
- [ ] **Step 4: Rodar de novo.** Esperado: PASS. Conferir o screenshot a 1280 px (celular fora do escopo, decisão do usuário em 28/10/2026).
- [ ] **Step 5: Commit** `"Tela Evolução"`.

---

### Task 10: Tela Rotas

**Files:**
- Create: `src/telas/rotas.js`
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `resumoRotas` (Task 3), `miniGrafico` (Task 7), `App` (Task 8).
- Produces: `renderRotas(raiz, App)`.

- [ ] **Step 1: Escrever o teste e2e que falha** `rotas abre evolução filtrada`: clicar na linha da rota A→B leva a `#evolucao?rota=…` e o `<em>` do topo mostra a rota.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar a tela.**
  - `.sec-head` "Rotas" + dica *"Uma linha por origem → destino. Clique para ver a evolução."*
  - Tabela: rota, CT-e, transportadores, mediana do último mês (com o mês), variação contra o mês anterior com dados, mini-gráfico.
  - O seletor de métrica é compartilhado com a Evolução (`App.filtros.metrica`).
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Tela Rotas"`.

---

### Task 11: Tela Lançamentos

**Files:**
- Create: `src/telas/lancamentos.js`
- Modify: `src/app.js`, `src/estilo/app.css`

**Interfaces:**
- Consumes: `validarCampos`, `incluir`, `corrigir`, `excluir`, `nomeDoCnpj`, `cadastrarCnpj` (Task 2); `calcularCte`, `numeroDaChave` (Task 1); `filtrar` (Task 3); `App.alterar`, `App.sessao` (Tasks 5 e 8).
- Produces: `renderLancamentos(raiz, App)`. Toda mudança passa por `App.alterar`, e a sessão registra a chave em `alterados` (incluir e corrigir), `excluidos` ou `cadastro`.

- [ ] **Step 1: Escrever os testes e2e que falham:**
  - `lança CT-e e calcula preço por saca`: preencher o formulário (frete 8750, sacas 50) → o campo travado mostra `R$ 175,00`; ao lançar, a linha aparece na base.
  - `chave repetida é bloqueada e mostra o existente`.
  - `colar a chave preenche o número`.
  - `CNPJ novo pede nome e cadastra`.
  - `corrigir muda a cor do formulário e salva`.
  - `excluir pede confirmação e vai para a lixeira`.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - **Formulário:**
    - Grade nas colunas da planilha.
    - Rótulos obrigatórios marcados com `*` em `accent-d`.
    - Seguro, tarifa e preço por saca em `<output>` travados, recalculados a cada `input`.
    - Erros por campo com `aria-invalid` e a mensagem de `validarCampos` abaixo.
    - Ao sair do campo de CNPJ, mostra o nome do cadastro. Se não houver, aparece o campo "Nome para o cadastro" (obrigatório para lançar) e o painel chama `cadastrarCnpj` junto do `incluir`.
    - `<datalist>` de cidades com as cidades da base.
    - No modo de correção, o formulário ganha a classe `.editando` (fio `accent` à esquerda, como o `.exc`) e o aviso "Corrigindo o CT-e Nº …", com Cancelar.
  - **Base:**
    - Busca por número ou chave e os filtros de `App.filtros`.
    - Tabela com emissão, Nº, transportador, cliente, rota, sacas, tarifa, R$/saca, quem lançou e ações Corrigir e Excluir.
    - Paginação de 100 linhas.
    - Excluir abre um `<dialog>` de confirmação.
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `"Tela Lançamentos: formulário com cálculo travado e base"`.

---

### Task 12: Telas Cadastro CNPJ e Dados

**Files:**
- Create: `src/telas/cadastro.js`, `src/telas/dados.js`
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `cadastrarCnpj`, `grupoDoCnpj`, `restaurar` (Task 2); `lerPlanilha`, `aplicarImportacao` (Task 4); `criarGravador` (Task 6); `window.XLSX`.
- Produces: `renderCadastro(raiz, App)`, `renderDados(raiz, App)`, `exportarXlsx(d, XLSX): ArrayBuffer` (em `src/importacao.js`, mesma ordem de colunas da planilha, nomes vindos do cadastro).

- [ ] **Step 1: Escrever os testes que falham:**
  - Unidade `exportarXlsx usa as colunas da planilha` (em `test/importacao.test.js`): reimportar o arquivo exportado dá os mesmos CT-e.
  - E2e `importa planilha e mostra o resumo`: `setInputFiles` com a planilha fictícia da fixture → o resumo mostra "3 CT-e incluídos".
  - E2e `restaura da lixeira`.
  - E2e `cadastro renomeia e o nome muda na Evolução`.
  - E2e `aberto por http é somente leitura`: servir `dist/` por http → o topo avisa e os botões de lançar ficam desabilitados.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - **Cadastro:** busca; tabela com CNPJ formatado, raiz, nome editável (salva ao sair do campo), grupo resultante, nº de CT-e; incluir novo.
  - **Dados:**
    1. Card "Pasta compartilhada": estado do gravador, Conectar ou Trocar pasta, Salvar agora, última gravação (quem e quando). Se a pasta escolhida não tiver o arquivo de dados, perguntar "Criar a base nesta pasta?" → `criarArquivoInicial`.
    2. "Importar planilha" (`.xlsm,.xlsx`): resumo com incluídos, pulados, rejeitados (tabela de linha e motivo) e divergentes.
    3. "Exportar para Excel" → download `radar-carga-solta AAAA-MM-DD.xlsx`.
    4. Lixeira com Restaurar.
    5. Histórico (log) com as 500 últimas ações, da mais recente para a mais antiga.
    6. "Seu nome": editar o nome guardado no navegador.
- [ ] **Step 4: Rodar `npm test && npm run montar && npm run test:e2e`.** Esperado: tudo PASS.
- [ ] **Step 5: Commit** `"Telas Cadastro CNPJ e Dados: importar, exportar, lixeira e histórico"`.

---

### Task 13: Fluxo completo, conferência final e implantação

**Files:**
- Modify: `test/e2e/painel.test.js`
- Create: `docs/IMPLANTACAO.md`

- [ ] **Step 1: Escrever o teste e2e de ponta a ponta** `fluxo completo com pasta simulada`.
  - Usar `page.addInitScript` para instalar um `showDirectoryPicker` falso, apoiado na mesma pasta falsa da Task 6, servida para a página por `exposeBinding`, e abrir por `file://`.
  - Passos: conectar; importar a planilha fictícia; lançar; corrigir; excluir; restaurar.
  - Conferir que o arquivo gravado tem 4 CT-e, que `backups/` tem cópias e que o log tem as ações em ordem.
  - Simular outra gravação (alterar `salvoEm` no arquivo falso) e verificar que aparece o painel de conflito e que "Juntar e salvar" preserva as duas mudanças.
- [ ] **Step 2: Rodar.** Esperado: PASS.
- [ ] **Step 3: Conferência visual.** Screenshots das 5 telas a 1280 px, nos temas claro e escuro, em `test-results/`. Checar:
  - sem rolagem horizontal da página a 1280 px;
  - números legíveis;
  - nenhum texto em inglês.
- [ ] **Step 4: Escrever `docs/IMPLANTACAO.md`** em pt-BR:
  1. criar a pasta no SharePoint e sincronizar com o OneDrive;
  2. copiar `dist/index.html` (pode renomear para `Radar de Fretes - Carga Solta.html`);
  3. abrir pelo Chrome ou Edge a partir da pasta sincronizada;
  4. Dados → Conectar a pasta → "Criar a base nesta pasta";
  5. importar `Radar_Fretes_Concorrentes_v2.10.xlsm`;
  6. cada pessoa informa o nome na primeira vez;
  7. versão nova do painel = trocar só o HTML (os dados ficam no `.js`);
  8. restaurar um backup = copiar o arquivo de `backups/` por cima do `radar-carga-solta-dados.js`.
- [ ] **Step 5: Rodar `npm test && npm run montar && npm run test:e2e`** e a conferência com a planilha real (Task 4, Step 5). Esperado: tudo PASS e `195 / 0 / 0 / 0`.
- [ ] **Step 6: Commit e push** `"Fluxo completo testado e guia de implantação"`, depois `git push -u origin claude/compassionate-hopper-b5gz9t`.
