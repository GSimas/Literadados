// Contraste AA dos tokens de cor nos dois temas (spec CA-19.7). Rodar: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../web/style.css", import.meta.url), "utf8");
const bloco = (seletor) => {
  const i = css.indexOf(`${seletor} {`);
  assert.ok(i >= 0, `bloco ${seletor} não achado`);
  return css.slice(i, css.indexOf("}", i));
};
const tokens = (txt) => Object.fromEntries([...txt.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
const claro = tokens(bloco(":root"));
const escuro = { ...claro, ...tokens(bloco(':root[data-theme="dark"]')) };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Pares de texto × fundo que aparecem na interface.
const PARES = [
  ...["tinta", "tinta-2", "muted", "link"].flatMap((t) => ["pagina", "superficie", "superficie-2"].map((f) => [t, f])),
  ["tinta", "marca-suave"], ["link", "marca-suave"], ["sobre-marca", "marca"],
];

for (const [nome, T] of [["claro", claro], ["escuro", escuro]]) {
  test(`contraste AA no tema ${nome}`, () => {
    const falhas = PARES.filter(([t, f]) => {
      assert.ok(T[t] && T[f], `token ausente: --${t} ou --${f}`);
      return contraste(T[t], T[f]) < 4.5;
    }).map(([t, f]) => `--${t} sobre --${f}: ${contraste(T[t], T[f]).toFixed(2)}`);
    assert.deepEqual(falhas, []);
  });
}

test("tema escuro automático e escolhido têm os mesmos tokens", () => {
  const i = css.indexOf(":root:not([data-theme=\"light\"]) {");
  assert.deepEqual(tokens(css.slice(i, css.indexOf("}", i))), tokens(bloco(':root[data-theme="dark"]')));
});
