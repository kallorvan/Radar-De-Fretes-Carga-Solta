A linguagem visual dos painéis de operação do Grupo Dínamo · Tóliman Transportes: um topo azul-marinho com um único número grande e, abaixo, cartões brancos e calmos sobre uma página cinza-azulada, onde todo número é composto numa fonte condensada de destaque e todo rótulo em versaletes monoespaçados. Lê-se como o livro-razão de um pátio portuário: quadrado, denso, exato.

## Fundamentos de conteúdo

- **O idioma é o português do Brasil**, escrito para as equipes de operação e comercial. Números no formato pt-BR: `7.237`, `R$ 1.204.000`, `18,4%`, `412 t`.
- **A voz é direta e factual**, sem excesso de "você". Diga o que é o número e de onde ele vem: *"Apurado do relatório de Carga Geral e confrontado, container a container, com as minutas de Santos."*
- **Títulos são locuções nominais curtas**, em caixa alta na fonte de destaque: *"Containers por cliente"*, *"Concentração da carteira"*, *"Exceções a tratar"*. Títulos do topo e dos cartões podem ser um pouco mais calorosos: *"O pátio do mês"*, *"O mês em números"*.
- **As dicas dizem como ler ou usar o bloco**, em uma frase: *"Ordenado por volume. A barra mostra a composição entre 20 e 40 pés."* / *"Passe o cursor para ver peso e frete."*
- **A origem sempre aparece.** As etiquetas nomeiam o relatório de origem (`Relatório 457`); o rodapé lista cada relatório usado e o que cada um contribuiu. Nunca mostre um número cuja origem a página não nomeia.
- **Exceções são nomeadas, contadas e mantidas nos totais.** Diga isso explicitamente: *"Todos entram integralmente nos totais do painel; ficam aqui para que a correção volte à origem."*
- Unidades em minúsculas depois do número (`20 pés`, `40 pés`, `t`). Períodos como *"Julho de 2026 · fechamento"*, separados por ponto médio `·`.
- Sem emoji, sem pontos de exclamação, sem adjetivos de marketing.

## Fundamentos visuais

### Cor
- O fundo da página é `paper`; as superfícies são `card` com borda de 1px em `line`. Texto corrido em `ink`; títulos, números e valores em `navy`; texto secundário em `steel`.
- O topo (hero) e o rodapé são `navy` sólido. O texto sobre o azul-marinho desce em quatro níveis: `on-navy` (números, títulos) → `on-navy-strong` → `on-navy-2` (linha de apoio) → `on-navy-3` (descrições, legendas). `steel-l` é a cor do subtítulo do topo.
- `accent` é a única cor de sinal: botão ativo, etiquetas, sobretítulo, hover da navegação, anel de foco, a série de 40 pés e o dia de pico. Use `accent-d` sempre que o acento precisar ser **texto** sobre branco.
- As cores das séries têm significado fixo e nunca se trocam: **20 pés = `navy`** (`yard-20` no pátio), **40 pés = `accent`**, **sem tipo = `steel-l`** (`yard-sem-tipo` no pátio). O fluxo de frete usa `navy` → `plum` → `accent`; as fatias da pizza seguem `navy`, `accent`, `yard-20`, `plum`, `pie-5`, `pie-6`, `steel-l`; a intensidade do calendário usa `ramp-1` … `ramp-5`.
- Preenchimentos discretos vêm da escala neutra: `row-rule` (divisórias de linha), `track` (barra vazia), `mist` (linhas de grade, etiquetas de alerta), `tint` (botão inativo do seletor claro, linha de total), `hover-tint`, `highlight-tint`.
- `ok` é reservado ao título "limpo" (nenhuma exceção) e sempre vem acompanhado da palavra.
- `mark-red` e `mark-yellow` existem só no símbolo do logo. Não use na interface.
- **Notas de contraste mantidas da origem:** `steel` sobre `card` dá 4,34:1 e sobre `paper` 3,87:1; branco sobre `accent` dá 3,65:1 (usado só em versaletes de 10px em etiquetas e seletores); `steel-l` sobre branco dá 2,47:1 (rótulos de eixo, sub-rótulos). Esses pares são exatos à origem e ficam abaixo de 4,5:1 para texto pequeno. Não os estenda a texto corrido novo: use `ink` ou `navy` para tudo o que precisa ser lido.

### Tipografia
- Três famílias hospedadas no Google Fonts: **Barlow Condensed** (`disp`) para todo título e número, **IBM Plex Sans** (`body`) para texto e nomes de linha, **IBM Plex Mono** (`mono`) para rótulos, valores, cabeçalhos de tabela, eixos e etiquetas.
- Números: `big-number` (96px, um por página, no topo), `tile-figure`, `kpi-figure`, `split-figure`. Cada um tem um `caps-label` monoespaçado embaixo dizendo o que conta.
- Títulos: `hero-title`, `section-title`, `card-title` e `yard-title` em caixa alta; `exception-title` em caixa de frase.
- Rótulos mono em caixa alta com espaçamento largo (`eyebrow` .2em, `caps-label` .13em). Valores no fim de uma linha usam `value` (mono 12px, `navy`), seguidos da participação em `steel`, como `18%`.
- O texto corrido é 15px/1.55; o texto de trabalho do painel é menor (`body-sm` 13px, `hint` 12px, `label` 12.5px).

### Espaço e grade
- O conteúdo fica num `.wrap` de `container-max` (1220px) com margem lateral `space-26` (`gutter-mobile` 16px abaixo de 640px).
- As seções ficam a `space-56` umas das outras. Cada seção abre com um **cabeçalho de seção**: h2 + descrição + etiqueta opcional, sobre um fio `navy` de 2px, `space-26` acima do conteúdo.
- Cartões têm respiro `space-24` × `space-26`; cartões lado a lado ficam a `space-22`. As grades de KPI, terminais e unidades são **grades de fio**: blocos em `card` com vão `space-1` sobre fundo `line`, de modo que as divisórias são o fundo aparecendo.
- Quebras: 1000px (4 colunas → 2, o topo empilha), 640px (→ 1 coluna, barras empilham, navegação some).

### Forma, bordas, profundidade
- **Quadrado.** Cartões, blocos, barras e tabelas usam `radius-none`. Só coisas pequenas arredondam: `radius-xs` (marcas do pátio, células do calendário), `radius-sm` (etiquetas, pílulas, seletores), `radius-md` (dica flutuante).
- A estrutura é desenhada com bordas `line` de 1px e divisórias `row-rule`, não com sombras. As únicas sombras são `shadow-sticky` / `shadow-sticky-scrolled` no cabeçalho e `shadow-tip` na dica flutuante.
- O cartão de exceção é o único lugar com borda colorida: um fio `accent` de 3px à esquerda marca um registro que altera um número.

### Movimento e estados
- Transições de 0,12s (brilho no hover das marcas, surgimento da dica) e 0,5s para a revelação ao rolar. Todo movimento é desligado com `prefers-reduced-motion`.
- Hover: as trilhas das barras ganham contorno `accent` de 1px; as marcas do pátio crescem 1,55× e clareiam; os blocos de terminal ganham `hover-tint`; os links da navegação ficam `accent` com sublinhado de 2px.
- Foco: `:focus-visible` é um contorno sólido `accent` de 2px com afastamento de 2px, em todo lugar.
- Seletores: um grupo segmentado `.modes` com `aria-pressed`. Sobre o azul-marinho o botão ativo é `accent`; sobre branco (`.modes.light`) é `navy`.

## Iconografia e imagens

- **Não há conjunto de ícones.** Os painéis não usam ícones: o significado vem das palavras, dos rótulos mono e das amostras de cor (`legend`, `pielegend`). Não acrescente ícones.
- As marcas de dados são a imagem: o **pátio** (uma marca de 11px por container, 25px de largura para 40 pés), a grade de calor do calendário, barras, barras de fluxo e o gráfico de rosca, todos em SVG embutido ou divs com cores dos tokens.
- Logos: veja o grupo Logos. Use `logo-dinamo-toliman.png` sobre branco (cabeçalho, `logo-height` 34px) e `logo-dinamo-toliman-light.png` sobre `navy` (rodapé, 26px). `dinamo-mark.svg` é o símbolo quadrado (favicon).

## Como usar a folha de estilo

`components/bundle.css` é a folha de estilo do próprio painel, com toda cor, fonte e sombra apontando para os tokens. Carregue as três famílias do Google (a primeira linha já as importa), depois tokens.css, depois bundle.css, e escreva a marcação e as classes da origem (`.wrap`, `.sec-head`, `.card`, `.kpis`, `.bar-row`…). Cada cartão de componente mostra a marcação exata.

## Não sincronizado

- Construído a partir de `kallorvan/Painel-Containers`, a única interface do repositório: um painel HTML gerado. Não há biblioteca de componentes nem pacote JS, então os componentes são **reproduções estáticas** da marcação da origem, estilizadas pelo bundle.css. O desenho dos gráficos (pátio, calendário, rosca, barras mensais, ritmo diário) vive no script embutido da página e não foi empacotado.
- As fontes são servidas pelo Google Fonts; o repositório não tem arquivos de fonte.
- `navy2`, `navy3` e `navy-mid` estão declarados na origem mas quase não são usados; foram mantidos por completude.
