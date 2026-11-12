# Handoff · Radar de Fretes · Carga Solta

Atualizado em 12/11/2026. A última alteração foi o **layout do Radar de Fretes Container** (menu lateral azul-marinho), para padronizar os painéis de lançamento. Antes dela, o botão **Organizar PDFs por mês** (PR #1), testado pelo usuário na pasta real.

## Onde está

| O quê | Onde |
|---|---|
| Painel pronto para a pasta | `dist/index.html`. Na pasta do SharePoint o arquivo se chama `Radar de Fretes - Carga Solta.html`. |
| Código | branch `main`, igual a `claude/compassionate-hopper-b5gz9t` |
| Dados | `radar-carga-solta-dados.js`, na pasta do SharePoint (fora do repositório), com `backups/` ao lado (as 60 últimas versões) |
| PDFs dos CT-e | duas pastas dentro da pasta do painel: `PDFs Carga Solta`, onde a equipe salva os novos, e `Registrados`, com subpastas por mês de emissão (`1 - Janeiro_2026`, `2 - Fevereiro_2026`…). Nomes como `CTE 1234 - Oasis.pdf` |
| Guia de instalação e uso | `docs/IMPLANTACAO.md` |
| Desenho | `docs/superpowers/specs/` e `docs/superpowers/plans/`. São três etapas: o painel, depois produto e unidade com R$/t, depois o adendo 2. |

A planilha real (`Radar_Fretes_Concorrentes_v2.10.xlsm`) e o relatório de itinerários do Rodopar (`itinerarios.xlsx`) **não** vão para o repositório (`*.xlsm` e `*.xlsx` estão no `.gitignore`). Eles têm CNPJ de clientes.

## Como funciona

- **Um HTML só, aberto por `file://`** a partir da pasta sincronizada do OneDrive/SharePoint, no Chrome ou no Edge.
  - A gravação usa a File System Access API: o usuário conecta a pasta uma vez, em Dados → Conectar a pasta.
  - Quem abre por link ou em outro navegador só consulta.
- **Arquivo de dados:** base versão 3, gravada como `window.RADAR_CS3={…}`. O painel lê também as marcas antigas `RADAR_CS2` e `RADAR_CS` e migra na abertura (`migrarBase` em `src/base.js`). Um painel antigo ainda aberto não acha a marca nova e recusa gravar.
- **Concorrência:** cada gravação confere o `salvoEm` do arquivo. Se outra pessoa gravou antes, aparece o aviso **Juntar e salvar**: o painel parte do arquivo e aplica por cima só o que esta página mudou.
  - A sessão registra o que mudou: alterados, excluídos, restaurados, apagados da lixeira, cadastro, listas e configuração. Ver `src/arquivo.js` (`juntar`) e `src/pasta.js`.
  - O que ainda não foi gravado fica no IndexedDB do navegador e volta na próxima abertura.
- **Sem login:** cada pessoa informa o nome, e toda ação vai para o histórico (até 500 registros). Excluir manda o CT-e para a lixeira.

## Layout (igual ao do Radar de Fretes Container)

O usuário pediu os dois painéis de lançamento no mesmo layout. Referência: repositório `kallorvan/Radar-De-Fretes-Container` (`src/css/lateral.css`, `src/js/lateral.js`).

- **Menu lateral azul-marinho fixo à esquerda** (258 px): assinatura Dínamo | Tóliman com as logos oficiais (letras brancas, traços das marcas em cores; `logos-lateral.png`), título "Tóliman × mercado / Radar de fretes / Carga solta", abas em coluna (a aberta com fio coral à esquerda).
- **Recorte da Evolução no menu**, logo abaixo do botão Evolução (métrica, rota, transportador, cliente, produto, itinerário, período e Limpar recorte), como os filtros do Comparativo no Container. Nas outras telas ele some (`#filtros-lat`, preenchido por `renderEvolucao`, limpo em `App.render`). Clicar no botão Evolução com ela aberta **recolhe** o recorte e clicar de novo abre, com a seta ▾/▸ no botão (pedido do usuário, como o Comparativo do Container); vindo de outra tela, abre (`pintarRecorte` em `src/app.js`).
- **Quadro de gravação no pé do menu** (`#estado-gravacao`): estado, botão coral **Conectar a pasta** ou **Salvar agora**, e "Lançando como … · trocar". Gruda no pé quando o menu rola.
- **Conteúdo em quadros brancos** na largura toda, sem título de página; cada quadro tem o título com filete azul-marinho embaixo. Botões em texto normal (primário azul-marinho).
- **Evolução:** o número do recorte vai num quadro branco ao lado do gráfico (no Container, a posição e a distribuição dos gaps).
- **Formulário de lançamento em blocos:** Dados do CT-e · Cliente e transportador · Produto e peso · Valores.
- **Só computador:** o painel não tem layout de celular (decisão do usuário em 12/11/2026). Não gastar tempo com telas estreitas nas próximas mudanças.
- **Fontes** Barlow Condensed, IBM Plex Sans e IBM Plex Mono por `<link>` no `<head>`, como no Container. O `@import` do `bundle.css` não vale: fica no meio da folha montada e o navegador o ignora (o painel caía em Arial).
- Diferença que ficou: o Carga Solta continua com tema escuro automático; o Container é só claro.

## O que o painel faz hoje

- **Lançamentos (formulário)**
  - **Campos que se preenchem sozinhos:**
    - o CNPJ do transportador sai da chave de acesso (posições 7–20);
    - o nº do CT-e também sai da chave;
    - o cód. itinerário é o código da origem + o do destino, pelo cadastro do Rodopar.
    
    Os dois primeiros ficam travados.
  - **Seguro:** o usuário informa valor assegurado e valor do seguro; a taxa é calculada.
  - **Contas:** tarifa = frete − seguro − adicionais. Peso = quantidade × kg da unidade, ou o peso do CT-e. R$/t e R$/saca saem daí.
  - **Cidades:** ao digitar, aparecem sugestões, primeiro as mais usadas da base e depois os municípios do Brasil. Nome fora da lista ganha aviso, sem bloquear.
  - **Produto e unidade novos** se cadastram sem sair do lançamento, pela opção "+ Cadastrar…" da lista.
  - **Calculadora** (botão **Calc**) nos campos Adicionais e Quantidade.
  - **Chave de acesso:** é conferida assim que tem 44 dígitos. Se o CT-e já está na base, o painel oferece **Abrir o registro**; se está na lixeira, **Lançar de novo**.
  - **Envio:** só pelo botão Lançar CT-e; Enter nos campos não envia.
- **Base (Lançamentos)**
  - Busca por número ou chave.
  - Corrigir e excluir.
  - Seleção e exclusão em massa.
  - Botão **PDF**, que abre o arquivo do CT-e procurando em `PDFs Carga Solta` e em `Registrados`, e **Atualizar PDFs**.
  - **Organizar PDFs por mês** (escondido no modo consulta): move cada PDF para `Registrados/<n> - <Mês>_<ano>/`, na pasta do painel.
    - O mês sai da emissão do CT-e ligado ao PDF (o mesmo vínculo do botão PDF). Sem CT-e na base, sai da chave de acesso no nome do arquivo (dígitos 3 a 6, AAMM). Sem nenhum dos dois, o PDF fica onde está.
    - Antes de mover, mostra quantos vão para cada pasta e pede confirmação.
    - Não sobrescreve: arquivo com o mesmo nome na pasta do mês faz o PDF ficar onde está, com aviso.
    - Usa `move()` do navegador; se falhar, copia, confere o tamanho e só então apaga o original.
    - Código em `src/pdfs.js` (`pastaDoMes`, `mesDaChave`, `planejarOrganizacao`, `executarOrganizacao`) e o botão em `src/telas/lancamentos.js` (`organizarPdfs`).
  - Selo "antes do corte" nos CT-e anteriores à data de corte.
- **Evolução**
  - Um ponto por CT-e, com gradiente navy → plum → rosa conforme o preço, e a mediana do mês, que pode ser desligada.
  - Filtros por rota, transportador, cliente, produto, itinerário e período.
  - Métricas R$/t (padrão), R$/saca e Tarifa.
  - Tabela por transportador.
  - **Exceções a tratar**, com o botão Abrir na base.
- **Rotas:** resumo por rota, com filtro de produto.
- **Cadastro:** nomes de CNPJ (agrupados pela raiz de 8 dígitos), produto padrão do cliente e listas de produtos e unidades.
- **Dados**
  - Pasta compartilhada.
  - Exportar .xlsx.
  - Data de corte (01/08/2026; vazia = todos entram).
  - Classificar CT-e.
  - Lixeira: restaurar e Esvaziar lixeira.
  - Histórico e nome de quem lança.

A importação de planilha saiu da tela a pedido do usuário. Ela foi usada só na implantação. O código continua em `src/importacao.js`, que também faz a exportação e é usado por `scripts/conferir-planilha.mjs`.

## Tabelas geradas (regerar quando a fonte mudar)

| Arquivo | Fonte | Comando |
|---|---|---|
| `src/dados-itinerarios.js` (344 cidades, 1.321 itinerários) | relatório de itinerários do Rodopar | `node scripts/extrair-itinerarios.mjs caminho/itinerarios.xlsx` |
| `src/dados-municipios.js` (5.291 nomes) | aba MUNICÍPIOS da planilha | `node scripts/extrair-municipios.mjs caminho/Radar_Fretes_Concorrentes.xlsm` |
| `referencia/toliman-paineis/logos-cor.png` e `logos-branco.png` | `logo-dinamo-cor.png` + `logo-toliman-empilhada.png` | `python3 scripts/montar-logos.py` (Pillow) |
| `referencia/toliman-paineis/logos-lateral.png` (a do menu: letras brancas, traços das marcas em cores) | logos oficiais `logo-dinamo-horizontal.png` + `logo-toliman-horizontal.png`, enviadas pelo usuário em 12/11/2026 | `python3 scripts/montar-logos-lateral.py` (Pillow e numpy) |

Depois de regerar, rode `npm run montar` e troque o HTML na pasta. Ao abrir, o painel preenche sozinho os itinerários em branco que a tabela nova já sabe montar.

## Desenvolvimento

```bash
npm install
npm test                 # 180 testes de unidade (node:test)
npm run montar           # gera dist/index.html (esbuild + CSS + logos embutidos)
npm run test:e2e         # 59 testes no navegador (Playwright/Chromium), com uma pasta simulada
```

- **Código:** ES modules em `src/` e as telas em `src/telas/`. O build é IIFE e vai inteiro para dentro do HTML. Bibliotecas externas: SheetJS 0.18.5 (cdnjs, só para exportar) e Google Fonts.
- **Visual:** design system Tóliman Painéis (`referencia/toliman-paineis/`), tokens gerados em `build/tokens.css`. Sem ícones, tudo em pt-BR. Claro e escuro.
- **Testes:**
  - pasta simulada em `test/fakes/pasta-falsa.js`;
  - bases de exemplo em `test/fixtures/base-exemplo.js`, com `corte = null` porque os CT-e de exemplo são de janeiro a abril;
  - em `test/ajuda.js`, `campos()` monta a chave com o CNPJ do transportador dentro.
- **Fluxo de trabalho:** a cada mudança, o usuário recebe só o HTML (ou um zip com o HTML e o `LEIA-ME`, gerado a partir do `IMPLANTACAO.md`). Push na branch de trabalho e na `main`.

## Decisões tomadas pelo caminho (confirmar se alguma estiver errada)

- **Uso exclusivo no computador** (pedido do usuário, 12/11/2026): sem adaptação para celular; testes de tela só em largura de computador.

- **Cidades com o mesmo nome em duas UF:** o CT-e não guarda a UF, então vale o código da UF com mais itinerários: Boa Esperança/MG (BLP), Campestre/MG (BYV), Itapeva/MG (INO) e São Simão/SP (SWZ, escolhida no desempate pela UF mais usada).
- **Cidade sem cadastro no Rodopar:** fica sem itinerário. Ao corrigir um CT-e sem mudar a rota, o itinerário que ele já tinha é mantido.
- **Taxa do seguro:** 0% quando há valor assegurado e o seguro é zero; fica vazia só sem valor assegurado. Na migração, a taxa digitada é mantida quando reproduz o seguro guardado.
- **PDF:** se dois PDFs têm o mesmo número de CT-e, o nome depois do traço é comparado com o nome do transportador no cadastro. Sem como decidir, o botão fica apagado com a dica.
- **Pastas de mês:** `Registrados` fica direto na pasta do painel, a pedido do usuário (a primeira versão punha dentro de `PDFs Carga Solta`; o botão leva essas para a nova). O nome `1 - Janeiro_2026` põe o número do mês na frente para o Explorador ordenar; com mais de um ano, os meses iguais de anos diferentes ficam lado a lado.
- **Janelas com formulário** (nome, produto, unidade, calculadora): o Enter no campo confirma. Por padrão o navegador acionaria o primeiro botão, que é o Cancelar.

## Pendências e pontos em aberto

1. **Tarifa de referência da Tóliman para carga solta:** em espera; o usuário ainda não tem a tarifa. Ela entraria como comparação na Evolução e nas Rotas.
2. **Linha estranha no relatório do Rodopar:** o itinerário `MCHBYU` está como Machado → Campestre/MG, mas BYU é o código de Campestre/AL. Vale conferir no Rodopar.
3. **CT-e com origem "JOAQUIM DA BARRA"** (nº 2848): o usuário ia corrigir para São Joaquim da Barra pelo painel. Conferir se foi feito.
4. **PDFs:** abrir e organizar por mês foram testados pelo usuário na pasta real e funcionaram. Pastas antigas que ficarem vazias em `PDFs Carga Solta` não são apagadas pelo painel; a equipe apaga à mão.
5. **Pequenos, conhecidos e não corrigidos:**
   - duas pessoas mudando o kg da mesma unidade ao mesmo tempo: vale a última gravação;
   - o aviso de "rota com produtos misturados" aparece só na Evolução, não em Rotas;
   - trocar o cliente no formulário não troca o produto já escolhido (o produto padrão só preenche quando o campo está vazio);
   - o nome do banco no IndexedDB é fixo: duas cópias do HTML em pastas diferentes, no mesmo navegador, dividem as pendências e a última pasta conectada;
   - tarifa negativa (adicionais maiores que o frete) é aceita sem aviso.
