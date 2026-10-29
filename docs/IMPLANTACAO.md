# Implantação · Radar de Fretes · Carga Solta

O painel é um arquivo HTML só. Ele fica numa pasta compartilhada do SharePoint, ao lado do arquivo de dados. Quem abre o HTML pela pasta, no Chrome ou no Edge, lança e corrige. Quem abre por um link (fora da pasta) ou em outro navegador só consulta.

## Primeira instalação

1. No SharePoint, crie uma pasta para o painel (ex.: `Radar de Fretes - Carga Solta`) e sincronize-a com o OneDrive do computador.
2. Copie `dist/index.html` deste repositório para essa pasta. O arquivo pode ser renomeado, por exemplo para `Radar de Fretes - Carga Solta.html`.
3. Abra o HTML **a partir da pasta sincronizada**, com duplo clique, no **Chrome ou no Edge**.
4. Informe o seu nome quando o painel pedir. Ele fica guardado no navegador e vai junto com cada lançamento, correção e exclusão.
5. Vá em **Dados → Conectar a pasta** e escolha a pasta do passo 1. Como ela ainda não tem o `radar-carga-solta-dados.js`, o painel pergunta **"Criar a base nesta pasta?"**: confirme.
6. **Data de corte.** A base começa com corte em **01/08/2026**: CT-e emitidos antes dessa data ficam na base, mas fora da Evolução, das Rotas, das exceções e da classificação. A data pode ser mudada em **Dados → Data de corte**; vazia, todos entram.
7. Lance os CT-e na aba **Lançamentos**. (A importação da planilha antiga foi usada só na implantação e saiu do painel.)
8. A gravação é automática: a barra abaixo do menu mostra **Tudo salvo** quando o arquivo da pasta está em dia.

## Uso no dia a dia

- No lançamento, digite o **valor assegurado** e o **valor do seguro** como vêm no CT-e; a taxa do seguro é calculada só para conferência. O **CNPJ do transportador** sai da chave de acesso e o **cód. itinerário** sai da origem e do destino (cadastro do Rodopar): os dois campos ficam travados.
- O preço principal é **R$/t**: tarifa (frete − seguro − adicionais) ÷ peso. O peso sai da quantidade × kg da unidade (saca de 60 kg, saca de 50 kg, tonelada). Para big bag, ou quando o CT-e traz outro peso, marque **Usar o peso do CT-e** e digite o peso bruto.
- Produtos e unidades novos são incluídos na aba **Cadastro**. O peso de uma unidade já usada não muda: para outro peso, crie outra unidade.
- Ao comparar uma rota que leva mais de um produto, escolha o produto no recorte. O painel avisa quando a rota mistura produtos.
- Na **Evolução**, cada ponto do gráfico é um CT-e, na data de emissão, com a cor do azul (mais barato) ao rosa (mais caro). A linha tracejada é a mediana do mês e pode ser desligada. Clique num ponto para abrir o CT-e.
- **PDFs dos CT-e:** salve os PDFs na pasta **`PDFs Carga Solta`**, dentro da pasta do painel (pode ter subpastas), com o nome no formato `CTE 1234 - Oasis.pdf`. O botão **PDF** da base abre o arquivo do CT-e. Quando dois CT-e têm o mesmo número, o nome depois do traço é comparado com o transportador. Sem PDF, o botão fica apagado. Depois de salvar PDFs novos com o painel aberto, clique em **Atualizar PDFs**. Os PDFs só abrem para quem conectou a pasta (Chrome ou Edge pela pasta sincronizada).
- **Lançar de novo um CT-e excluído:** se a chave está na lixeira, o formulário avisa e oferece **Lançar de novo**: o lançamento antigo sai da lixeira e entra o novo, com os dados digitados. O histórico registra as duas coisas. Para trazer o lançamento antigo de volta como estava, use **Restaurar** na aba Dados.
- **Exclusão em massa:** marque as caixas da base (ou **Selecionar todos**, que marca os CT-e da busca e do recorte na tela) e clique em **Excluir selecionados**. Tudo vai para a lixeira e pode ser restaurado na aba Dados.
- Em **Exceções a tratar**, o botão **Abrir na base** leva direto à correção do CT-e (ou ao CNPJ no Cadastro, ou à classificação).

- Cada pessoa abre o HTML pela pasta sincronizada no Chrome ou no Edge.
- Na primeira vez em cada computador, é preciso clicar em **Conectar a pasta** (aba Dados). Depois disso o navegador lembra.
- Se o navegador pedir permissão para gravar, clique em **Salvar agora** na barra de gravação.
- Se outra pessoa gravou depois que você abriu o painel, aparece o aviso **Outra pessoa gravou na pasta**. **Juntar e salvar** parte do arquivo da pasta e aplica por cima só o que você mudou: nada do que a outra pessoa lançou se perde.
- Alterações que ainda não foram gravadas ficam guardadas no navegador e voltam quando o painel é aberto de novo.
- O painel confere, imediatamente antes de gravar, se alguém gravou antes. Mas, se duas pessoas gravarem no mesmo minuto antes de o OneDrive sincronizar, o OneDrive pode criar uma cópia com o nome do computador (ex.: `radar-carga-solta-dados-PC01.js`). Se uma cópia assim aparecer na pasta, avise quem cuida do painel: o conteúdo dela precisa ser conferido e lançado de novo, e depois a cópia pode ser apagada.
- Em um computador novo, espere o OneDrive terminar de sincronizar a pasta antes de **Conectar a pasta**. O painel se recusa a criar uma base nova numa pasta que já tem `backups/` ou outro arquivo de dados.

## Atualizar o painel

Troque só o HTML na pasta pela versão nova de `dist/index.html`. Os dados ficam no `radar-carga-solta-dados.js` e não mudam.

Depois de trocar, todos devem **fechar as abas do painel antigo e abrir o HTML de novo**. A cada versão que muda o arquivo de dados (a última: seguro informado, itinerário e data de corte), ele passa a ser gravado num formato que o painel antigo não lê: uma aba antiga esquecida aberta mostra "ilegível, nada foi gravado" em vez de apagar os campos novos. A base existente é atualizada sozinha na primeira abertura: o seguro de cada CT-e fica como está, a taxa é recalculada a partir dele, os itinerários em branco são preenchidos e a data de corte começa em 01/08/2026.

## Restaurar um backup

A cada gravação, a versão anterior do arquivo de dados vai para `backups/`, com data e hora no nome. O painel guarda as 60 mais recentes. Para voltar a uma delas:

1. Feche o painel em todos os computadores.
2. Copie o arquivo escolhido de `backups/` para a pasta do painel.
3. Renomeie a cópia para `radar-carga-solta-dados.js`, substituindo o arquivo atual.

## Requisitos

- Chrome ou Edge atualizados, para lançar.
- Internet para as fontes e para a biblioteca de leitura de planilhas (cdnjs). Sem internet, o painel abre e lança normalmente, mas a exportação para Excel fica indisponível.
- Uso em computador: o painel não foi pensado para celular.

## Desenvolvimento

```bash
npm install
npm test                 # testes de unidade
npm run montar           # gera dist/index.html
npm run test:e2e         # testes no navegador (Chromium/Playwright)
node scripts/conferir-planilha.mjs caminho/Radar_Fretes_Concorrentes.xlsm   # confere a importação (a planilha não vai para o repositório)
node scripts/extrair-itinerarios.mjs caminho/itinerarios.xlsx                  # regera src/dados-itinerarios.js (relatório de itinerários do Rodopar)
python3 scripts/montar-logos.py                                              # regera a assinatura Dínamo | Tóliman
```

Quando o Rodopar ganhar cidade nova, exporte de novo o relatório de itinerários, rode `extrair-itinerarios` com ele, depois `npm run montar`, e troque o HTML na pasta. Ao abrir, o painel preenche sozinho o itinerário dos CT-e que estavam em branco e agora têm as duas cidades no cadastro. Quatro cidades existem em duas UF (Boa Esperança, Campestre, Itapeva e São Simão); como o CT-e não guarda a UF, vale o código da UF com mais itinerários cadastrados (Boa Esperança/MG, Campestre/MG, Itapeva/MG e São Simão/SP).
