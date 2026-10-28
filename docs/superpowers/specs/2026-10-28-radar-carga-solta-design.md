# Radar de Fretes · Carga Solta — desenho

Data: 2026-10-28 · Status: aguardando revisão

## 1. Objetivo

Acompanhar a evolução do preço que os concorrentes cobram no frete de carga solta (sacas), a partir dos CT-e de concorrentes que a equipe já lança hoje na planilha `Radar_Fretes_Concorrentes_v2.10.xlsm`, aba **BASE CARGA SOLTA 2026**. O painel substitui a planilha como lugar de lançamento e passa a ser a base compartilhada da equipe.

Sucesso significa:

- a equipe lança CT-e de carga solta no painel, sem voltar à planilha;
- qualquer pessoa vê, por rota, quanto cada transportador cobra por saca, mês a mês, e se o preço está subindo ou caindo;
- os 195 CT-e já lançados (jan–ago/2026) entram no painel por importação, com os mesmos números da planilha.

## 2. Decisões tomadas

| # | Decisão |
|---|---|
| 1 | Métrica principal: **preço por saca** (R$/saca). Seletor alterna para **tarifa do frete** (R$). Valor total só no detalhe. |
| 2 | Entrada: **formulário no painel** + **importação única** do histórico da planilha. |
| 3 | Uso por **várias pessoas** sobre uma base compartilhada. |
| 4 | **Painel novo e independente** do Radar de Fretes Tóliman (container). |
| 6 | Base em **arquivo numa pasta compartilhada do OneDrive/SharePoint**, mesmo mecanismo do Radar atual. |
| 7 | Rota = **cidade origem → cidade destino**. Cód. itinerário e cliente são filtros. |
| 8 | Evolução **mensal**: mediana e faixa mín–máx por transportador. |
| 9 | Tarifa Tóliman de referência: **em espera** (ainda não existe tarifa de carga solta). Fora deste escopo. |
| 10 | Chave de acesso repetida é **bloqueada** no formulário e na importação. |
| 11/14 | Sem login. Cada pessoa informa o nome uma vez (guardado no navegador). Toda criação, correção e exclusão registra quem e quando. Exclusão pede confirmação e vai para uma **lixeira restaurável**. |
| 12 | Reaproveita o mecanismo de gravação em pasta do Radar (File System Access API, salvamento automático, backups, aviso de conflito). |
| 13 | Cliente e transportador são agrupados pela **raiz do CNPJ** (8 primeiros dígitos). O nome exibido vem do cadastro de CNPJ. |
| 15 | O formulário calcula seguro, tarifa e preço por saca; esses campos ficam travados. |
| 16 | Escopo só **carga solta**. A importação lê apenas as abas *BASE CARGA SOLTA 2026* e *BASE DE DADOS CNPJ*. |
| — | Visual: design system **Tóliman Painéis**. |

## 3. Fatos levantados da planilha

- *BASE CARGA SOLTA 2026* (tabela `Tabela7`, `A1:T196`): 195 CT-e, emissão de 01/2026 a 08/2026, nenhuma chave repetida.
- Colunas: Chave de acesso, Nº CT-e, Emissão CT-e, CNPJ do transportador, Transportador, CNPJ do cliente, Cliente, Cidade origem, Cidade destino, Cód. itinerário, Valor assegurado, Taxa do seguro, Valor do seguro, Valor do frete, Adicionais, Qt. sacas, Preço por sacas, Tarifa do frete, VPO, Observações.
- Fórmulas verificadas nas 195 linhas (tolerância R$ 0,05):
  - `tarifa = valor do frete − valor do seguro − adicionais`
  - `preço por saca = tarifa ÷ qt. sacas`
- Cód. itinerário vazio em 150 de 195 linhas. VPO é `SIM` ou vazio.
- Destinos incluem porto (Santos, Guarujá) e armazéns do interior (Machado, Varginha).
- O mesmo cliente aparece com grafias diferentes (ex.: "USINA ALTA MOGIANA" e "USINA ALTA MOGIANA S/A"); transportadores têm vários CNPJ de filial. Daí a decisão 13.
- *BASE DE DADOS CNPJ*: 125 pares CNPJ → nome; CNPJ guardado como número (zeros à esquerda perdidos), a importação recompõe os 14 dígitos.

## 4. Arquitetura

### 4.1 Repositório

```
src/
  calculos.js       fórmulas do CT-e, raiz do CNPJ, validação de chave
  agregacao.js      mediana/mín/máx por mês × transportador × rota, variação, exceções
  base.js           modelo de dados em memória: incluir, corrigir, excluir, restaurar, log
  importacao.js     leitura da planilha (.xlsm/.xlsx) via SheetJS → linhas normalizadas
  pasta.js          gravação na pasta (File System Access API), backups, conflito
  graficos.js       SVG embutido: linhas mensais com faixa, mini-gráficos
  telas/*.js        Evolução, Rotas, Lançamentos, Cadastro CNPJ, Dados
  estilo.css        tokens e componentes do Tóliman Painéis
  index.template.html
scripts/montar.mjs  junta tudo em dist/index.html (um arquivo só)
test/               testes de unidade (node:test) e de navegador (Playwright)
```

Um arquivo só porque o painel é aberto direto da pasta (`file://`), onde o navegador não carrega módulos ES separados. Os módulos de `src/` não dependem do DOM, exceto `telas/`, `graficos.js` e `pasta.js`, para que os cálculos sejam testados em Node.

Dependência externa em tempo de execução: SheetJS `xlsx@0.18.5` pelo cdnjs (só na importação) e as fontes do Google (Barlow Condensed, IBM Plex Sans, IBM Plex Mono).

### 4.2 Pasta compartilhada

```
<pasta do SharePoint>/
  index.html                       (cópia de dist/index.html)
  radar-carga-solta-dados.js       a base
  backups/                         últimas 60 versões, nome com data e hora
```

`radar-carga-solta-dados.js` contém `window.RADAR_CS = { ... }`. O formato `.js` (e não `.json`) é para o `index.html` conseguir lê-lo com uma tag `<script>` ao abrir pela pasta, sem pedir permissão.

### 4.3 Gravação

- Funciona em Chrome e Edge abertos pela pasta. A pessoa clica **Conectar a pasta** uma vez; o acesso fica lembrado (IndexedDB).
- Cada alteração agenda uma gravação automática (1 s após a última mudança).
- Antes de gravar: lê o arquivo da pasta; se `salvoEm` for mais novo que o da cópia carregada, não grava, mostra o aviso de conflito (quem salvou e quando) e oferece recarregar. As alterações locais pendentes ficam guardadas para reaplicar.
- Antes de sobrescrever, copia a versão atual para `backups/`, mantendo as 60 mais recentes.
- Aberto por link (fora da pasta) ou em outro navegador: só leitura, com aviso no topo dizendo isso.

## 5. Modelo de dados

```js
window.RADAR_CS = {
  versao: 1,
  salvoEm: "2026-10-28T14:03:11.000Z",
  salvoPor: "Eduardo",
  ctes: [Cte],
  cnpjs: [{ cnpj: "07668709000109", nome: "ATMA LOGISTICA E TRANSPORTES LTDA" }],
  lixeira: [{ cte: Cte, excluidoPor, excluidoEm }],
  log: [{ quando, quem, acao: "incluir"|"corrigir"|"excluir"|"restaurar"|"importar"|"cadastro", chave, resumo }]
}

Cte = {
  chave: "35260105780969000146570010000106001000120718",   // 44 dígitos, identificador único
  numero: 10600, emissao: "2026-01-10",
  cnpjTransportador: "05780969000146", cnpjCliente: "44209336003583",
  origem: "SAO JOAQUIM DA BARRA", destino: "SANTOS", itinerario: "",
  valorAssegurado: 119322.29, taxaSeguro: 0, valorFrete: 8750, adicionais: 0,
  sacas: 50, vpo: false, observacoes: "",
  // calculados, guardados para conferência e exportação:
  valorSeguro: 0, tarifa: 8750, precoSaca: 175,
  criadoPor, criadoEm, alteradoPor, alteradoEm, origemLancamento: "importacao"|"formulario"
}
```

Os nomes de transportador e cliente não ficam no CT-e: vêm do cadastro pela raiz do CNPJ. Na importação, um CNPJ sem cadastro gera um cadastro com o nome que estava na linha.

### Cálculos

- `valorSeguro = arred2(valorAssegurado × taxaSeguro)`.
- `tarifa = arred2(valorFrete − valorSeguro − adicionais)`.
- `precoSaca = arred2(tarifa ÷ sacas)`.
- Na importação, os valores de seguro, tarifa e preço por saca da planilha são conferidos contra o cálculo. Se divergirem mais de R$ 0,05, a linha entra com o valor da planilha e vira exceção "cálculo diverge da planilha", para não alterar silenciosamente um número histórico.
- Agrupamento: `raiz = cnpj.slice(0, 8)`. Nome do grupo = nome do cadastro da matriz (`/0001`) se existir, senão o primeiro cadastrado.
- Rota = `origem + " → " + destino`, em maiúsculas e sem acento para comparação.
- Mês = ano-mês da data de emissão.

## 6. Telas

Menu horizontal no topo; o nome da pessoa e o estado da gravação ficam à direita.

### 6.1 Evolução (abertura)

- **Topo azul-marinho** com o número grande: mediana do preço por saca (ou da tarifa, conforme o seletor) no último mês com dados do recorte, a variação contra o mês anterior com dados e uma linha de apoio: "N CT-e · M transportadores · período".
- **Filtros:** rota, transportador, cliente, cód. itinerário, período (mês inicial e final), seletor `R$/saca | Tarifa R$`. Os filtros ficam na URL (`#rota=…`) para dar para mandar um link já filtrado.
- **Gráfico mensal:** eixo x = meses do período; uma linha por transportador (mediana do mês). O cursor mostra mediana, mín, máx e nº de CT-e daquele transportador no mês. Mês sem CT-e = interrupção da linha, não zero. Com mais de 6 transportadores, os 6 com mais CT-e ganham cor e os demais ficam em `steel-l` com destaque no hover.
- **Grade de KPIs:** CT-e no período, sacas no período, transportadores, rotas.
- **Tabela "Transportadores nesta rota":** transportador, nº CT-e, último preço (data), mediana do período, variação primeiro → último mês. Ordenável. Sem rota selecionada, a tabela pede para escolher uma, porque comparar preço por saca entre rotas diferentes engana.

### 6.2 Rotas

Tabela com uma linha por rota: origem → destino, nº CT-e, nº transportadores, mediana do último mês com dados, variação contra o mês anterior com dados, mini-gráfico mensal. Ordenada por nº de CT-e. Clicar abre a Evolução filtrada naquela rota.

### 6.3 Lançamentos

- **Formulário**, na ordem da planilha. São obrigatórios chave, nº, emissão, CNPJs, origem, destino, valor do frete e sacas.
  - Chave: 44 dígitos.
  - Ao colar a chave, o nº do CT-e é preenchido a partir dela (posições 26–34) e a pessoa pode alterar.
  - Ao digitar o CNPJ, o nome aparece do cadastro. Um CNPJ novo pede o nome ali mesmo e o grava no cadastro.
  - Origem e destino são autocompletados com os municípios já usados na base.
  - Seguro, tarifa e preço por saca são calculados e travados.
  - Chave repetida: bloqueia e mostra o lançamento existente, com botão para abri-lo.
  - Em modo de correção, o formulário muda de cor e diz qual CT-e está sendo corrigido.
- **Base:** tabela com busca por nº ou chave, os mesmos filtros da Evolução, e Corrigir e Excluir em cada linha. Excluir pede confirmação e manda para a lixeira.

### 6.4 Cadastro CNPJ

Lista CNPJ → nome, com busca, edição do nome, uso (nº de CT-e) e inclusão. Mostra a raiz e o grupo resultante.

### 6.5 Dados

- Conectar a pasta; estado da gravação; última gravação (quem e quando).
- **Importar planilha** (`.xlsm` ou `.xlsx`). O resumo mostra:
  - CT-e incluídos;
  - pulados por chave já existente;
  - rejeitados, com linha e motivo;
  - CNPJs cadastrados.
- Exportar a base para Excel (`.xlsx`), nas mesmas colunas da planilha.
- Lixeira: restaurar.
- Histórico (log): últimas 500 ações.

### 6.6 Visual

Segue o Tóliman Painéis:

- Página `paper`, cartões `card` quadrados com borda `line`.
- Topo e rodapé em `navy`.
- `accent` como única cor de sinal.
- Barlow Condensed em títulos e números, IBM Plex Sans no texto e IBM Plex Mono em rótulos, valores e cabeçalhos de tabela.
- Sem ícones nem emoji; números em pt-BR.
- O rodapé diz de onde vêm os números: "Lançamentos do Radar de Fretes · Carga Solta; histórico importado de Radar_Fretes_Concorrentes_v2.10.xlsm".
- Tema claro e escuro; layout utilizável no celular (consulta), com o lançamento pensado para desktop.

## 7. Exceções e erros

**Cartão "Exceções a tratar"** na Evolução, com contagem e lista. Todas as exceções continuam nos totais, e o cartão diz isso. Os casos são:

- preço por saca acima de 3× ou abaixo de ⅓ da mediana da rota (exige pelo menos 3 CT-e na rota);
- CNPJ sem nome no cadastro;
- sacas zeradas ou ausentes, quando o preço por saca não existe e o CT-e fica fora da métrica por saca, mas conta na tarifa;
- cálculo da importação divergente da planilha.

**Erros:**

- **Importação:** o arquivo não tem a aba esperada → mensagem clara, nada importado. Linha sem chave, com chave inválida ou sem sacas/frete → rejeitada com o motivo; as demais entram.
- **Gravação:** falha ao gravar → aviso vermelho fixo até a próxima gravação bem-sucedida. As alterações ficam guardadas no navegador (IndexedDB) e nada é descartado.
- **Conflito:** como em 4.3.
- **Navegador sem suporte** (Firefox/Safari): o painel abre em leitura, com aviso.

## 8. Testes

- **Unidade** (`node --test`), com dados fictícios em `test/fixtures/`:
  - fórmulas e arredondamento;
  - raiz do CNPJ e recomposição de zeros;
  - número a partir da chave;
  - mediana, mín e máx por mês;
  - variação com meses vazios;
  - exceções;
  - bloqueio de duplicata;
  - lixeira e restauração;
  - log;
  - normalização das linhas da planilha;
  - detecção de conflito.
- **Conferência com a planilha real**, feita localmente e fora do repositório porque o arquivo tem CNPJs de clientes: importar `Radar_Fretes_Concorrentes_v2.10.xlsm` dá 195 CT-e, 0 rejeitados, e tarifa e preço por saca idênticos aos da planilha.
- **Navegador** (Playwright, Chromium):
  - abrir `dist/index.html`;
  - importar uma planilha fictícia;
  - lançar um CT-e;
  - tentar lançar a mesma chave (bloqueado);
  - corrigir, excluir, restaurar;
  - conferir o número do topo e a tabela da rota;
  - conferir que não há rolagem horizontal da página a 390 px.
- A gravação em pasta é testada com o sistema de arquivos simulado (o Playwright não abre o seletor de pasta real).

## 9. Fora do escopo

- Tarifa Tóliman de carga solta como referência (decisão 9, em espera). O modelo de dados não impede incluí-la depois como um cadastro de tarifa por rota.
- Container, tarifário e comparativo, que continuam no Radar de Fretes Tóliman.
- Login e permissões reais.
- Leitura automática de XML ou PDF do CT-e.
