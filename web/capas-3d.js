// CA-24.3: o alvo dos eventos fica imóvel; só o livro inclina.
export function angulosCapa(x, y, largura, altura) {
  const limitar = (n) => Math.max(-1, Math.min(1, n));
  if (!(largura > 0 && altura > 0)) return { x: 0, y: 0 };
  return { x: -limitar(y / altura * 2 - 1) * 9, y: limitar(x / largura * 2 - 1) * 13 };
}

export function montarCapas3D(raiz) {
  const preferencia = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  let ativo = null;
  const limpar = () => {
    if (!ativo) return;
    ativo.classList.remove("inclinando");
    ativo.style.removeProperty("--rx");
    ativo.style.removeProperty("--ry");
    ativo = null;
  };
  raiz.addEventListener("pointermove", (e) => {
    if (!preferencia.matches || e.pointerType !== "mouse") return;
    const alvo = e.target.closest(".capa-palco");
    if (!alvo || !raiz.contains(alvo)) { limpar(); return; }
    if (ativo !== alvo) limpar();
    ativo = alvo;
    const r = alvo.getBoundingClientRect(), a = angulosCapa(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    alvo.style.setProperty("--rx", `${a.x}deg`);
    alvo.style.setProperty("--ry", `${a.y}deg`);
    alvo.classList.add("inclinando");
  });
  raiz.addEventListener("pointerout", (e) => {
    if (ativo && !ativo.contains(e.relatedTarget)) limpar();
  });
  raiz.addEventListener("pointercancel", limpar);
  raiz.closest("dialog")?.addEventListener("close", limpar);
  addEventListener("blur", limpar);
  addEventListener("hashchange", limpar);
  document.addEventListener("visibilitychange", () => { if (document.hidden) limpar(); });
  preferencia.addEventListener("change", limpar);
}
