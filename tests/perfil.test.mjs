// Perfil de pessoa (spec CA-11.2): a cronologia sai em ordem de ano, com indicações, júri e organização juntos.
// Rodar: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as M from "../web/metricas.js";
import { htmlPerfil } from "../web/pessoas.js";
import { marcaEditora, iniciaisEditora, htmlEditora } from "../web/editoras.js";

const D = JSON.parse(readFileSync(new URL("../web/dados.json", import.meta.url), "utf8"));
M.juntar(D, (D.partes ?? []).map((p) => JSON.parse(readFileSync(new URL(`../web/${p}`, import.meta.url), "utf8"))));
D.participacao = M.expandir(D);
const midiaPorId = new Map((D.midia ?? []).map((m) => [m.pessoa_id, m]));
const anos = (html) => [...html.slice(html.indexOf('class="cronologia"')).matchAll(/<span class="ano">(\d{4})<\/span>/g)].map((m) => +m[1]);

test("todas as editoras com perfil têm marca acessível, com alternativa sem depender da rede", () => {
  let n = 0;
  for (const ed of D.editoras) {
    const perfil = htmlEditora(ed.id, { D, linhas: D.participacao });
    if (!perfil) continue;
    n++;
    assert.match(perfil.html, /class="editora-logo" role="img" aria-label="Identidade visual de /);
    assert.match(perfil.html, /Marca tipográfica/);
    assert.match(perfil.html, /<svg viewBox="0 0 180 150"/);
  }
  assert.ok(n > 400);
  assert.equal(iniciaisEditora("Companhia das Letras"), "CL");
  assert.equal(iniciaisEditora("7Letras"), "7L");
  assert.equal(iniciaisEditora("Editora 34"), "34");
});

test("marca oficial preserva crédito e protege atributos de nomes e URLs", () => {
  const html = marcaEditora({ nome: 'A & B "Editora"' }, { imagem_url: 'https://exemplo.org/logo.svg?a=1&b=2', pagina: 'https://exemplo.org/', fonte: 'A & B' });
  assert.match(html, /class="editora-marca tem-logo"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /href="https:\/\/exemplo.org\/"/);
  assert.match(html, /A &amp; B &quot;Editora&quot;/);
  assert.match(html, /classList.remove\('tem-logo'\)/);
});

test("cronologia do perfil em ordem de ano para todas as pessoas, júri incluído", () => {
  const fora = [];
  let comJuri = 0;
  for (const p of D.pessoas) {
    const html = htmlPerfil(p.id, { D, midiaPorId });
    if (!html) continue;
    if (html.includes("jurado(a) de")) comJuri++;
    const a = anos(html);
    if (a.some((x, i) => i && x < a[i - 1])) fora.push(`${p.id}: ${a.join(",")}`);
  }
  assert.ok(comJuri > 0, "nenhum perfil com júri: o teste não cobriria o caso");
  assert.deepEqual(fora, []);
});
