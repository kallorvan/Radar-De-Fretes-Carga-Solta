"""Monta a assinatura Dínamo | Tóliman do menu lateral azul-marinho, como a do Radar de Fretes Container:
letras em branco e os traços coloridos das marcas nas cores originais, fundo transparente.

Uso: python3 scripts/montar-logos-lateral.py   (precisa do Pillow e do numpy)
Entradas em referencia/toliman-paineis/: logo-dinamo-horizontal.png e logo-toliman-horizontal.png
(as logos oficiais em cores, sobre fundo branco). Saída na mesma pasta: logos-lateral.png.

Cada pixel é separado do fundo branco ("cor para alfa"): o que é da família do azul-marinho
(vermelho <= verde <= azul, as letras e o "GRUPO" / "TRANSPORTES") vira branco com a mesma
opacidade; o resto (vermelho, amarelo, roxo, rosa dos símbolos) mantém a cor.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

PASTA = Path(__file__).resolve().parent.parent / "referencia" / "toliman-paineis"
NAVY = np.array([17, 35, 70], dtype=float)
ALFA_MIN = 0.04            # abaixo disto é fundo
COR_SOLIDA = 90            # pixel colorido que se afasta do branco tanto assim (no canal mais baixo) é sólido
VAO_FIO = 34               # de cada lado do fio entre as duas marcas
FIO = (255, 255, 255, 90)  # fio branco translúcido, como no Container
FIO_LARGURA = 3


def sem_fundo(caminho):
    p = np.array(Image.open(caminho).convert("RGB")).astype(float)
    r, g, b = p[..., 0], p[..., 1], p[..., 2]
    familia_navy = (r <= g + 6) & (g <= b + 6)
    # azul-marinho: a opacidade é quanto o pixel escureceu do branco até o navy
    lum = p.mean(axis=2)
    a_navy = np.clip((255 - lum) / (255 - NAVY.mean()), 0, 1)
    # cores: sólidas por dentro (a cor original), e só a borda, onde a cor se mistura com o branco, fica
    # translúcida, com a cor separada do branco ("cor para alfa"). Sem isso o símbolo ficava translúcido e
    # escurecia sobre o azul-marinho.
    a_cor = np.clip((255 - p.min(axis=2)) / COR_SOLIDA, 0, 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        cor = np.where(a_cor[..., None] > 0, (p - (1 - a_cor[..., None]) * 255) / a_cor[..., None], 255)
    a = np.where(familia_navy, a_navy, a_cor)
    rgb = np.where(familia_navy[..., None], 255, np.clip(cor, 0, 255))
    a = np.where(a < ALFA_MIN, 0, a)
    out = np.dstack([rgb, a * 255]).round().astype(np.uint8)
    ys, xs = np.where(out[..., 3] > 0)
    return Image.fromarray(out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], "RGBA")


def main():
    dinamo = sem_fundo(PASTA / "logo-dinamo-horizontal.png")
    toliman = sem_fundo(PASTA / "logo-toliman-horizontal.png")
    altura = max(dinamo.height, toliman.height)
    largura = dinamo.width + 2 * VAO_FIO + FIO_LARGURA + toliman.width
    out = Image.new("RGBA", (largura, altura), (0, 0, 0, 0))
    out.paste(dinamo, (0, (altura - dinamo.height) // 2), dinamo)
    xt = dinamo.width + 2 * VAO_FIO + FIO_LARGURA
    out.paste(toliman, (xt, (altura - toliman.height) // 2), toliman)
    xf = dinamo.width + VAO_FIO
    ImageDraw.Draw(out).line([(xf, 8), (xf, altura - 8)], fill=FIO, width=FIO_LARGURA)
    out.save(PASTA / "logos-lateral.png", optimize=True)
    print(f"logos-lateral.png {out.width}x{out.height}")


if __name__ == "__main__":
    main()
