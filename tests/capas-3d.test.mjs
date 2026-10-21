import { test } from "node:test";
import assert from "node:assert/strict";
import { angulosCapa, montarCapas3D } from "../web/capas-3d.js";

test("inclinação acompanha o cursor e limita ângulos mesmo fora do retângulo", () => {
  assert.deepEqual(angulosCapa(90, 135, 180, 270), { x: -0, y: 0 });
  assert.deepEqual(angulosCapa(180, 0, 180, 270), { x: 9, y: 13 });
  assert.deepEqual(angulosCapa(-100, 900, 180, 270), { x: -9, y: -13 });
  assert.deepEqual(angulosCapa(1, 1, 0, 0), { x: 0, y: 0 });
});

test("toque e movimento reduzido não inclinam; saída, cancelamento e mudança de preferência restauram a capa", () => {
  const anteriores = Object.fromEntries(["matchMedia", "addEventListener", "document"].map((k) => [k, globalThis[k]]));
  const eventos = {}, globais = {}, preferencias = {}, propriedades = new Map(), classes = new Set();
  const mq = { matches: true, addEventListener: (k, f) => preferencias[k] = f };
  const alvo = { style: { setProperty: (k, v) => propriedades.set(k, v), removeProperty: (k) => propriedades.delete(k) },
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 180, height: 270 }), contains: (n) => n === alvo };
  const raiz = { addEventListener: (k, f) => eventos[k] = f, contains: (n) => n === alvo, closest: () => null };
  const mover = (tipo = "mouse") => eventos.pointermove({ pointerType: tipo, clientX: 190, clientY: 20, target: { closest: () => alvo } });
  try {
    globalThis.matchMedia = () => mq;
    globalThis.addEventListener = (k, f) => globais[k] = f;
    globalThis.document = { addEventListener() {} };
    montarCapas3D(raiz);
    mover("touch"); assert.equal(classes.size, 0);
    mq.matches = false; mover(); assert.equal(classes.size, 0);
    mq.matches = true; mover(); assert.equal(propriedades.get("--ry"), "13deg");
    eventos.pointerout({ relatedTarget: alvo }); assert.ok(classes.has("inclinando"));
    for (const limpar of [() => eventos.pointerout({ relatedTarget: null }), eventos.pointercancel, preferencias.change, globais.blur, globais.hashchange]) {
      mover(); limpar(); assert.equal(propriedades.size, 0); assert.equal(classes.size, 0);
    }
  } finally {
    for (const [k, v] of Object.entries(anteriores)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
});
