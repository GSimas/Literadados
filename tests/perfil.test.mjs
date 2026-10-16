// Perfil de pessoa (spec CA-11.2): a cronologia sai em ordem de ano, com indicações, júri e organização juntos.
// Rodar: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as M from "../web/metricas.js";
import { htmlPerfil } from "../web/pessoas.js";

const D = JSON.parse(readFileSync(new URL("../web/dados.json", import.meta.url), "utf8"));
D.participacao = M.expandir(D);
const midiaPorId = new Map((D.midia ?? []).map((m) => [m.pessoa_id, m]));
const anos = (html) => [...html.slice(html.indexOf('class="cronologia"')).matchAll(/<span class="ano">(\d{4})<\/span>/g)].map((m) => +m[1]);

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
