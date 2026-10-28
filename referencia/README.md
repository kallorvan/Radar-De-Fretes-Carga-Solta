# Material de referência

Não entra no painel montado; serve de fonte para a implementação.

- `toliman-paineis/` — design system Tóliman Painéis (tokens.json, bundle.css, README) e as logos:
  - `logo-dinamo-cor.png` e `logo-toliman-empilhada.png` são as originais enviadas pela Tóliman;
  - `logos-cor.png` (topo) e `logos-branco.png` (rodapé) são a assinatura "Dínamo | Tóliman" que o painel usa,
    geradas por `python3 scripts/montar-logos.py` (precisa do Pillow). Rode de novo se uma logo original mudar
    e depois `npm run montar`.
- `radar-fretes/gravacao-pasta.js` — trecho do Radar de Fretes Tóliman com a gravação na pasta compartilhada
  (trava por `salvoEm`, juntar e salvar, backups, salvamento automático).
