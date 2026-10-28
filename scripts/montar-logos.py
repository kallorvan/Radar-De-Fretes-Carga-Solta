"""Monta a assinatura Dínamo | Tóliman (uma imagem só) a partir das logos originais.

Uso: python3 scripts/montar-logos.py   (precisa do Pillow)
Entradas em referencia/toliman-paineis/: logo-dinamo-cor.png (horizontal) e logo-toliman-empilhada.png (940 x 516).
Saídas na mesma pasta: logos-cor.png (topo) e logos-branco.png (rodapé, mesma imagem em branco).

A Tóliman empilhada vira horizontal, espelhando a Dínamo: o nome ("Tóliman / TRANSPORTES") à esquerda e o
símbolo das três lâminas, espelhado, fechando a linha. As letras de "Tóliman" ficam com a mesma altura das
de "Dínamo"; o acento do "ó" sobe acima da linha.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

PASTA = Path(__file__).resolve().parent.parent / "referencia" / "toliman-paineis"
ALFA = 20                      # pixel visível
SIMBOLO = (360, 600, 262)      # o símbolo mora em x ∈ [360, 600), y < 262 da empilhada
LETRAS_DINAMO = 117            # altura das letras de "Dínamo" (linhas 1–118 da imagem)
LETRAS_TOLIMAN = (59, 197)     # topo e base das letras de "Tóliman" na imagem do nome
SIMBOLO_ALTURA = 0.7           # o símbolo com 70% da altura das letras, centrado nelas
VAO_SIMBOLO = 14               # entre o nome e o símbolo (px, já na escala final)
VAO_FIO = 70                   # de cada lado do fio
FIO = (17, 35, 70, 90)         # navy com transparência
FIO_LARGURA = 4


def recorta(a):
    ys, xs = np.where(a[:, :, 3] > ALFA)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def main():
    dinamo = Image.open(PASTA / "logo-dinamo-cor.png").convert("RGBA")
    emp = np.array(Image.open(PASTA / "logo-toliman-empilhada.png").convert("RGBA"))

    x0, x1, y1 = SIMBOLO
    visivel = emp[:, :, 3] > ALFA
    so_simbolo = np.zeros_like(visivel)
    so_simbolo[:y1, x0:x1] = visivel[:y1, x0:x1]
    simbolo = emp.copy()
    simbolo[~so_simbolo] = 0
    nome = emp.copy()
    nome[so_simbolo] = 0
    simbolo, nome = Image.fromarray(recorta(simbolo)), Image.fromarray(recorta(nome))

    k = LETRAS_DINAMO / (LETRAS_TOLIMAN[1] - LETRAS_TOLIMAN[0])
    nome = nome.resize((round(nome.width * k), round(nome.height * k)), Image.LANCZOS)
    topo, base = round(LETRAS_TOLIMAN[0] * k), round(LETRAS_TOLIMAN[1] * k)
    h = round((base - topo) * SIMBOLO_ALTURA)
    simbolo = ImageOps.mirror(simbolo).resize((round(simbolo.width * h / simbolo.height), h), Image.LANCZOS)
    toliman = Image.new("RGBA", (nome.width + VAO_SIMBOLO + simbolo.width, nome.height), (0, 0, 0, 0))
    toliman.paste(nome, (0, 0), nome)
    toliman.paste(simbolo, (nome.width + VAO_SIMBOLO, topo + (base - topo - h) // 2), simbolo)

    sobra = topo                                   # o acento do "ó" acima da linha das letras
    altura = max(dinamo.height + sobra, toliman.height)
    largura = dinamo.width + 2 * VAO_FIO + toliman.width
    out = Image.new("RGBA", (largura, altura), (0, 0, 0, 0))
    out.paste(dinamo, (0, sobra), dinamo)
    out.paste(toliman, (dinamo.width + 2 * VAO_FIO, 0), toliman)
    xf = dinamo.width + VAO_FIO
    ImageDraw.Draw(out).line([(xf, sobra + 10), (xf, altura - 10)], fill=FIO, width=FIO_LARGURA)
    out.save(PASTA / "logos-cor.png", optimize=True)

    branco = np.array(out)
    branco[:, :, :3] = 255
    Image.fromarray(branco).save(PASTA / "logos-branco.png", optimize=True)
    print(f"logos-cor.png {out.width}x{out.height}")


if __name__ == "__main__":
    main()
