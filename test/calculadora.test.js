// Calculadora dos campos Adicionais e Quantidade: conta digitada em pt-BR, sem eval.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarConta, valorParaCampo } from "../src/calculadora.js";

test("soma, subtração, multiplicação e divisão com precedência", () => {
  assert.equal(avaliarConta("150 + 80,50 + 2 × 35"), 300.5);
  assert.equal(avaliarConta("(1.080 - 40) / 2"), 520);
  assert.equal(avaliarConta("10 - 2 * 3"), 4);
  assert.equal(avaliarConta("10 ÷ 4"), 2.5);
  assert.equal(avaliarConta("2*(3+4)*5"), 70);
});

test("números no formato brasileiro e sinal", () => {
  assert.equal(avaliarConta("1.234,56"), 1234.56);
  assert.equal(avaliarConta("-5 + 10"), 5);
  assert.equal(avaliarConta("3 * -2"), -6);
  assert.equal(avaliarConta("R$ 100,00 + R$ 50"), 150, "R$ é ignorado");
});

test("conta incompleta, inválida ou divisão por zero dá null", () => {
  for (const c of ["", "10 +", "(2 + 3", "2 + + ", "5 / 0", "abc", "alert(1)", "2 ** 3", "1,2,3"]) assert.equal(avaliarConta(c), null, c);
});

test("valorParaCampo: até 2 casas, com vírgula", () => {
  assert.equal(valorParaCampo(300.5), "300,5");
  assert.equal(valorParaCampo(1 / 3), "0,33");
  assert.equal(valorParaCampo(520), "520");
});
