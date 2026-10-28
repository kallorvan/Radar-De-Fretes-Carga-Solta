# Implantação · Radar de Fretes · Carga Solta

O painel é um arquivo HTML só. Ele fica numa pasta compartilhada do SharePoint, ao lado do arquivo de dados. Quem abre o HTML pela pasta, no Chrome ou no Edge, lança e corrige. Quem abre por um link (fora da pasta) ou em outro navegador só consulta.

## Primeira instalação

1. No SharePoint, crie uma pasta para o painel (ex.: `Radar de Fretes - Carga Solta`) e sincronize-a com o OneDrive do computador.
2. Copie `dist/index.html` deste repositório para essa pasta. O arquivo pode ser renomeado, por exemplo para `Radar de Fretes - Carga Solta.html`.
3. Abra o HTML **a partir da pasta sincronizada**, com duplo clique, no **Chrome ou no Edge**.
4. Informe o seu nome quando o painel pedir. Ele fica guardado no navegador e vai junto com cada lançamento, correção e exclusão.
5. Vá em **Dados → Conectar a pasta** e escolha a pasta do passo 1. Como ela ainda não tem o `radar-carga-solta-dados.js`, o painel pergunta **"Criar a base nesta pasta?"**: confirme.
6. Em **Dados → Importar planilha**, escolha a `Radar_Fretes_Concorrentes_v2.10.xlsm`. O painel lê só as abas *BASE CARGA SOLTA 2026* e *BASE DE DADOS CNPJ*. Com a versão 2.10 o resultado esperado é **195 CT-e incluídos, 0 rejeitados e 125 CNPJ cadastrados**.
   - Um CT-e (nº 257219) tem o seguro digitado como R$ 193,00, e a conta dá R$ 193,07. Ele entra com o valor da planilha e aparece em **Exceções a tratar**.
7. Em **Dados → Classificar CT-e**, revise produto e unidade de cada CT-e importado (a planilha não tem esses campos). O painel já sugere:
   - **produto** pelo cliente (café: EISA, Stonex, Olam, Louis Dreyfus…; açúcar: usinas, U.S.J., Coplasa…);
   - **unidade** pela quantidade (até 100 = toneladas; acima, saca de 60 kg para café e de 50 kg para açúcar).
   
   Com a v2.10, a regra sugere 164 dos 195 CT-e. Os 31 restantes são de clientes que são transportadoras (Colombari, R S G, Agius…): escolha produto e unidade nessas linhas, ou defina o *produto padrão* do cliente na aba **Cadastro**. Confira também o CT-e **22875** (EISA, LEM → Machado): são 35 **sacas**, não toneladas. Ele aparece em "R$/t fora da faixa da rota".
8. A gravação é automática: a barra abaixo do menu mostra **Tudo salvo** quando o arquivo da pasta está em dia.

## Uso no dia a dia

- O preço principal é **R$/t**: tarifa (frete − seguro − adicionais) ÷ peso. O peso sai da quantidade × kg da unidade (saca de 60 kg, saca de 50 kg, tonelada). Para big bag, ou quando o CT-e traz outro peso, marque **Usar o peso do CT-e** e digite o peso bruto.
- Produtos e unidades novos são incluídos na aba **Cadastro**. O peso de uma unidade já usada não muda: para outro peso, crie outra unidade.
- Ao comparar uma rota que leva mais de um produto, escolha o produto no recorte. O painel avisa quando a rota mistura produtos.

- Cada pessoa abre o HTML pela pasta sincronizada no Chrome ou no Edge.
- Na primeira vez em cada computador, é preciso clicar em **Conectar a pasta** (aba Dados). Depois disso o navegador lembra.
- Se o navegador pedir permissão para gravar, clique em **Salvar agora** na barra de gravação.
- Se outra pessoa gravou depois que você abriu o painel, aparece o aviso **Outra pessoa gravou na pasta**. **Juntar e salvar** parte do arquivo da pasta e aplica por cima só o que você mudou: nada do que a outra pessoa lançou se perde.
- Alterações que ainda não foram gravadas ficam guardadas no navegador e voltam quando o painel é aberto de novo.
- O painel confere, imediatamente antes de gravar, se alguém gravou antes. Mas, se duas pessoas gravarem no mesmo minuto antes de o OneDrive sincronizar, o OneDrive pode criar uma cópia com o nome do computador (ex.: `radar-carga-solta-dados-PC01.js`). Se uma cópia assim aparecer na pasta, avise quem cuida do painel: o conteúdo dela precisa ser conferido e lançado de novo, e depois a cópia pode ser apagada.
- Em um computador novo, espere o OneDrive terminar de sincronizar a pasta antes de **Conectar a pasta**. O painel se recusa a criar uma base nova numa pasta que já tem `backups/` ou outro arquivo de dados.

## Atualizar o painel

Troque só o HTML na pasta pela versão nova de `dist/index.html`. Os dados ficam no `radar-carga-solta-dados.js` e não mudam.

Depois de trocar, todos devem **fechar as abas do painel antigo e abrir o HTML de novo**. A partir da versão com produto e unidade, o arquivo de dados é gravado num formato que o painel antigo não lê: uma aba antiga esquecida aberta mostra "ilegível, nada foi gravado" em vez de apagar os campos novos.

## Restaurar um backup

A cada gravação, a versão anterior do arquivo de dados vai para `backups/`, com data e hora no nome. O painel guarda as 60 mais recentes. Para voltar a uma delas:

1. Feche o painel em todos os computadores.
2. Copie o arquivo escolhido de `backups/` para a pasta do painel.
3. Renomeie a cópia para `radar-carga-solta-dados.js`, substituindo o arquivo atual.

## Requisitos

- Chrome ou Edge atualizados, para lançar.
- Internet para as fontes e para a biblioteca de leitura de planilhas (cdnjs). Sem internet, o painel abre e lança normalmente, mas a importação e a exportação de Excel ficam indisponíveis.
- Uso em computador: o painel não foi pensado para celular.

## Desenvolvimento

```bash
npm install
npm test                 # testes de unidade
npm run montar           # gera dist/index.html
npm run test:e2e         # testes no navegador (Chromium/Playwright)
node scripts/conferir-planilha.mjs caminho/Radar_Fretes_Concorrentes.xlsm   # confere a importação (a planilha não vai para o repositório)
```
