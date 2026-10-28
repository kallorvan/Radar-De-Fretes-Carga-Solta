# Adendo 2 · Seguro, itinerário, CNPJ pela chave, corte de agosto, exceções e gráfico

Data: 2026-10-28 · Status: aguardando revisão · Altera: `2026-10-28-radar-carga-solta-design.md` e `2026-10-29-produto-unidade-preco-tonelada-design.md`

## 1. Decisões

| # | Assunto | Decisão |
|---|---|---|
| 1 | Seguro | O formulário pede **Valor assegurado** e **Valor do seguro**, como vêm no CT-e. A taxa vira um campo calculado e travado (seguro ÷ assegurado), só para conferência. |
| 2 | Cód. itinerário | É montado sozinho a partir das abas **LINHA SANTOS** e **LINHA GUARUJÁ** (cadastro do Rodopar): código da origem + código do destino, por exemplo ARARAS → SANTOS = `ARRSAN`. Se a cidade não está nas abas, o código fica **em branco**: é um itinerário que a Tóliman não faz. |
| 3 | CNPJ do transportador | Sai das posições 7 a 20 da chave de acesso. É preenchido e travado, como o nº do CT-e. Na importação vale o CNPJ da chave; quando a planilha traz outro, o CT-e entra em "diverge da planilha". |
| 4 | Corte de agosto | CT-e emitidos antes de **01/08/2026** ficam na base, em Lançamentos, na exportação e no cadastro. Ficam **fora** da Evolução, das Rotas, das exceções e de Classificar CT-e, e aparecem na base com o selo "antes do corte". A data de corte é ajustável em Dados e vale para todos. |
| 5 | Exceções → base | Cada exceção ganha o botão **Abrir na base**. Exceção de um CT-e abre esse CT-e para correção em Lançamentos. Exceção de CNPJ abre o Cadastro com esse CNPJ. |
| 6 | Gráfico da Evolução | **Um ponto por CT-e**: data de emissão no eixo horizontal, a métrica escolhida no vertical. Os pontos usam um gradiente de cor, do azul-marinho (frete barato) ao rosa Tóliman (frete caro). A mediana do mês aparece como uma linha fina e clara, que pode ser desligada. |
| 7 | Logos | Assinatura única, no formato da referência enviada: **símbolo Dínamo + nome Dínamo**, um fio vertical, **nome Tóliman + símbolo Tóliman** (espelhado), fechando o bloco. "Dínamo" e "Tóliman" com a mesma altura de letra. Depois vêm o nome do painel e as abas. Rodapé: a mesma assinatura em branco. |

## 2. Detalhes

### Seguro (1)
- `calcularCte` recebe `valorSeguro` e devolve `taxaSeguro = valorSeguro ÷ valorAssegurado`, com 6 casas; fica `null` sem assegurado.
- A tarifa continua: `tarifa = frete − seguro − adicionais`.
- **CT-e já lançados.** Mantêm o `valorSeguro` que têm (todos os da planilha já trazem os dois valores). A taxa é recalculada a partir do seguro.
- **Importação.** Lê VALOR DO SEGURO. Se ele vier vazio e houver taxa, usa assegurado × taxa.
- A comparação "diverge da planilha" deixa de olhar o seguro, que agora é entrada, e passa a olhar o CNPJ (item 3), a tarifa e o preço por saca.

### Itinerário (2)
- **A tabela.** Novo módulo `src/itinerarios.js` com as 334 cidades e seus códigos de 3 letras das abas, mais os portos: SANTOS = `SAN`, GUARUJA = `GJA`. O script `scripts/extrair-itinerarios.mjs` gera o módulo a partir da planilha. A tabela não tem dado de cliente e pode ir para o repositório; a planilha não vai.
- **A regra.** `codigoItinerario(origem, destino)` só devolve código quando um lado é Santos ou Guarujá e o outro está na tabela. A comparação ignora acentos e caixa. Fora disso devolve vazio.
- **No formulário** o campo fica travado e é preenchido ao digitar origem e destino.
- **Na importação** vale o código calculado. O CT-e entra em "diverge da planilha" quando a planilha traz um código diferente que não esteja em branco.
- **Na base atual.** Ao abrir a base, os CT-e sem código recebem o código calculado (migração).
- **Quando o Rodopar ganhar cidade nova**, basta rodar o script e montar o painel de novo.

### CNPJ pela chave (3)
- `cnpjDaChave(chave)` = dígitos 7 a 20 da chave (índices 6 a 19).
- `validarCampos` exige que o CNPJ informado bata com a chave. No formulário isso não acontece, porque o campo é travado; o caso real é a importação.

### Corte (4)
- **Na base:** `Dados.corte = "2026-08-01"`, gravado no arquivo e ajustável em Dados → *Data de corte*. Cada alteração vai para o histórico.
- **Regra:** `noCorte(d, cte)` = `cte.emissao >= d.corte`.
- **Ficam fora pelo corte:** `filtrar` (e, com ele, Evolução e Rotas), `excecoes` e `pendentesDeClassificacao`.
- **Continuam com todos os CT-e:** Lançamentos, exportação e importação.
- **Na Evolução**, o topo mostra "N CT-e antes de dd/mm/aaaa fora da análise".
- **Ao juntar duas sessões**, o corte segue a regra dos outros campos de configuração (`produtoPadrao`): vale a alteração da sessão, quando houver.

### Exceções → base (5)
- O botão leva a `#lancamentos?editar=<chave>`. Lançamentos abre o formulário de correção desse CT-e e rola até ele.
- Para CNPJ, o botão leva a `#cadastro?cnpj=<cnpj>`, que destaca a linha.
- Em "a classificar", o botão leva a Dados → Classificar CT-e.

### Gráfico (6)
- Novo `pontosCtes(pontos, medianas, {metrica})` em `graficos.js`, que substitui `linhasMensais` na Evolução.
  - Recebe `pontos = [{ data, valor, chave, rotulo }]`.
  - O eixo horizontal é por data. As marcas são os meses.
- **Cor.** A cor de cada ponto vem da posição do valor entre o mínimo e o máximo do recorte, interpolada de navy `#112346` a accent `#e4536c`, passando pelo plum. Uma legenda em barra de gradiente mostra "mais barato → mais caro" com os valores das pontas.
- **Escala.** O eixo vertical vai do percentil 5 ao 95, com folga. Pontos fora dela ficam presos na borda, com um contorno, e o valor real aparece na dica.
- **Dica:** CT-e, data, transportador, rota, produto e o valor.
- **Clique:** abre o CT-e na base, como no item 5.
- **Mediana.** Uma linha em degraus por mês, cinza claro e tracejada. O seletor "Mediana do mês: ligada | desligada" fica guardado no endereço (`&mediana=0`).
- **Saem:** a faixa mín–máx e as linhas por transportador. A tabela de transportadores logo abaixo continua com as medianas mensais.

### Logos (7)
- **Uma imagem só**, `logos-cor.png`, gerada pelo script `scripts/montar-logos.py` a partir da Dínamo atual e da Tóliman empilhada enviada (940 × 516):
  - **Dínamo** como está;
  - **fio vertical** navy, a 35% de opacidade;
  - **Tóliman horizontal:** o nome ("Tóliman / TRANSPORTES") e, à direita dele, o símbolo das três lâminas espelhado, com 70% da altura das letras e centrado nelas.
- **Alinhamento:** a Tóliman é escalada para que a altura das letras de "Tóliman" seja igual à de "Dínamo". O acento do "ó" sobe acima da linha.
- **Versão branca:** `logos-branco.png`, a mesma imagem com os pixels em branco, mantendo a transparência. Vai no rodapé.
- **Arquivos:** os dois PNG ficam em `referencia/toliman-paineis/` e substituem os quatro logos separados no `montar.mjs`.
- **Topo:** a assinatura com 44 px de altura (34 px com a barra rolada), depois o fio, o nome do painel e as abas.
- **Rodapé:** a assinatura com 28 px de altura.
- **Modo escuro:** continua o filtro que deixa a imagem clara.

## 3. Arquivo de dados

- A `versao` passa de 2 para 3, e o marcador do arquivo passa a ser `window.RADAR_CS3=`. Assim, um painel antigo que continue aberto não grava por cima de uma base nova; essa é a mesma proteção da versão 2.
- A migração v2 → v3:
  - acrescenta `corte`;
  - recalcula a taxa a partir do seguro;
  - preenche o itinerário vazio pela regra do item 2.
- Nada é perdido.

## 4. Testes

**Unidade:**
- taxa calculada a partir do seguro;
- tarifa com seguro informado;
- importação com seguro vazio e taxa preenchida;
- `codigoItinerario`:
  - ARARAS → SANTOS = `ARRSAN`;
  - SANTOS → ALFENAS = `SANALF`;
  - GUARUJA com acento;
  - cidade fora das abas, que fica vazio;
  - origem e destino que não são porto, que fica vazio;
- `cnpjDaChave` e divergência na importação;
- corte em `filtrar`, `excecoes` e `pendentesDeClassificacao`;
- migração v2 → v3;
- junção do corte;
- escala do gráfico de pontos (percentis, pontos presos na borda) e a cor do gradiente nas pontas.

**Navegador:**
- colar a chave preenche e trava o CNPJ;
- digitar origem e destino preenche o itinerário;
- o seguro calcula a taxa;
- "Abrir na base" a partir de uma exceção abre o CT-e certo;
- clicar num ponto do gráfico abre o CT-e;
- mudar a data de corte muda a Evolução.

**Conferência com a planilha real:**
- quantos CT-e ganham itinerário;
- quantos ficam fora pelo corte (155 esperados);
- quantos ficam a classificar depois do corte;
- quantas exceções sobram.

## 5. Revisão (2026-10-28, depois da entrega)

- **Itinerário:** a fonte passa a ser o relatório de itinerários do Rodopar (`itinerarios.xlsx`, 1.321 itinerários, 344 cidades com UF). O código é **origem + destino sempre que as duas cidades estão no cadastro**, mesmo sem itinerário próprio e sem porto. Homônimas em duas UF ficam com a UF de mais itinerários (no empate, a UF mais usada no relatório). Ao abrir a base, itinerários em branco que a tabela atual sabe montar são preenchidos.
