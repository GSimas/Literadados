// Exportar gráficos (JPG com fundo / PNG sem fundo) e tabelas (XLSX / CSV) — spec CA-14.2, CA-14.3, design D25.
// xlsx/csv/numeroBR são puras (testadas no Node); o resto mexe no DOM só dentro de montarExportacao().
import { $, esc, css, fecharAnimado } from "./ui.js";

// ---------- tabela → linhas ----------
// "1.234,5" → 1234.5; "713" → 713; "39%" ou "1959–2025" continuam texto.
export function numeroBR(t) {
  const s = String(t).trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+(,\d+)?$/.test(s)) return Number(s.replace(",", "."));
  return null;
}

export const csv = (linhas) => "﻿" + linhas.map((l) => l.map((v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(",")).join("\r\n") + "\r\n";

// ---------- XLSX mínimo: ZIP sem compressão (STORE) com CRC-32 ----------
const TABELA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = TABELA_CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(arquivos) {
  const enc = new TextEncoder(), partes = [], central = [];
  let pos = 0;
  for (const [nome, texto] of arquivos) {
    const n = enc.encode(nome), d = enc.encode(texto), crc = crc32(d);
    const local = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, d.length, 4], [22, d.length, 4], [26, n.length, 2], [28, 0, 2]]
      .forEach(([o, v, t]) => (t === 4 ? local.setUint32(o, v, true) : local.setUint16(o, v, true)));
    const cen = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, d.length, 4], [24, d.length, 4],
      [28, n.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, pos, 4]]
      .forEach(([o, v, t]) => (t === 4 ? cen.setUint32(o, v, true) : cen.setUint16(o, v, true)));
    partes.push(new Uint8Array(local.buffer), n, d);
    central.push(new Uint8Array(cen.buffer), n);
    pos += 30 + n.length + d.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, arquivos.length, 2], [10, arquivos.length, 2], [12, tamCentral, 4], [16, pos, 4], [20, 0, 2]]
    .forEach(([o, v, t]) => (t === 4 ? fim.setUint32(o, v, true) : fim.setUint16(o, v, true)));
  const tudo = [...partes, ...central, new Uint8Array(fim.buffer)], saida = new Uint8Array(tudo.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of tudo) { saida.set(p, o); o += p.length; }
  return saida;
}
const xml = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const coluna = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
export function xlsx(linhas, aba = "Literadados") {
  const NS = "http://schemas.openxmlformats.org";
  const celulas = linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => {
    const ref = `${coluna(c)}${r + 1}`, n = r > 0 && typeof v !== "number" ? numeroBR(v) : typeof v === "number" ? v : null;
    return n != null && Number.isFinite(n) ? `<c r="${ref}"><v>${n}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join("")}</row>`).join("");
  return zip([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="${xml(aba.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}/spreadsheetml/2006/main"><sheetData>${celulas}</sheetData></worksheet>`],
  ]);
}

// ---------- gráfico → imagem ----------
const ESTILOS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity",
  "font-family", "font-size", "font-weight", "font-style", "paint-order", "letter-spacing", "visibility"];
function svgComEstilos(orig) {
  const copia = orig.cloneNode(true);
  const a = [orig, ...orig.querySelectorAll("*")], b = [copia, ...copia.querySelectorAll("*")];
  a.forEach((el, i) => {
    const cs = getComputedStyle(el);
    b[i].setAttribute("style", ESTILOS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
    b[i].removeAttribute("class");
  });
  copia.querySelectorAll(".dica-saindo, [aria-label='tip']").forEach((n) => n.remove()); // sem a dica do hover
  return copia;
}
const slug = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "grafico";
function tituloDe(alvo) {
  const fig = alvo.closest("figure, section");
  return (fig?.querySelector("h3")?.textContent || alvo.closest(".janela, .lugar, dialog")?.querySelector("h2")?.textContent
    || fig?.querySelector("h2")?.textContent || "Literadados").trim();
}
function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: nome }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportarGrafico(alvo, formato) {
  const svgs = [...alvo.querySelectorAll("svg")].filter((s) => !s.closest(".exportar-botao") && !s.parentElement.closest("svg"));
  const area = (s) => { const r = s.getBoundingClientRect(); return r.width * r.height; };
  const principal = svgs.sort((x, y) => area(y) - area(x))[0];
  if (!principal) throw new Error("Não achei o gráfico para exportar.");
  const r = principal.getBoundingClientRect(), titulo = tituloDe(alvo), pad = 24;
  // Legenda: amostras do Plot (ou da história) lidas do DOM, redesenhadas no SVG.
  const amostras = [...alvo.querySelectorAll("[class*='-swatch']:not([class*='-swatches']), .historia-legenda > span")].map((s) => {
    const forma = s.querySelector("svg rect, svg circle, i");
    return { cor: forma ? getComputedStyle(forma)[forma.tagName === "I" ? "backgroundColor" : "fill"] : css("--tinta-2"), rotulo: s.textContent.trim() };
  }).filter((a) => a.rotulo);
  const largura = Math.max(r.width + pad * 2, 360), tinta = css("--tinta"), tinta2 = css("--tinta-2"), fonte = "Inter, Helvetica, Arial, sans-serif";
  const linhasLeg = [];
  let x = 0, linha = [];
  for (const a of amostras) {
    const w = 22 + a.rotulo.length * 7;
    if (x + w > largura - pad * 2 && linha.length) { linhasLeg.push(linha); linha = []; x = 0; }
    linha.push({ ...a, x }); x += w + 10;
  }
  if (linha.length) linhasLeg.push(linha);
  const topo = pad + 26 + (linhasLeg.length ? linhasLeg.length * 20 + 8 : 0), altura = topo + r.height + 40;
  const NS = "http://www.w3.org/2000/svg";
  const raiz = document.createElementNS(NS, "svg");
  raiz.setAttribute("xmlns", NS);
  raiz.setAttribute("width", largura);
  raiz.setAttribute("height", altura);
  raiz.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
  raiz.innerHTML = `<text x="${pad}" y="${pad + 14}" fill="${tinta}" font-family="${fonte}" font-size="17" font-weight="700">${esc(titulo)}</text>
    ${linhasLeg.map((l, i) => l.map((a) => `<rect x="${pad + a.x}" y="${pad + 30 + i * 20}" width="12" height="12" rx="3" fill="${a.cor}"/>
      <text x="${pad + a.x + 18}" y="${pad + 40 + i * 20}" fill="${tinta2}" font-family="${fonte}" font-size="12">${esc(a.rotulo)}</text>`).join("")).join("")}
    <text x="${pad}" y="${altura - 14}" fill="${tinta2}" font-family="${fonte}" font-size="11">Literadados · Prêmio Jabuti ${esc(alvo.closest("[data-anos]")?.dataset.anos ?? "")}</text>`;
  const corpo = svgComEstilos(principal);
  corpo.setAttribute("x", pad);
  corpo.setAttribute("y", topo);
  corpo.setAttribute("width", r.width);
  corpo.setAttribute("height", r.height);
  if (!corpo.getAttribute("viewBox")) corpo.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
  raiz.append(corpo);

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(raiz)], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  await new Promise((ok, erro) => { img.onload = ok; img.onerror = () => erro(new Error("O navegador não conseguiu desenhar o gráfico.")); img.src = url; });
  const escala = 2, canvas = Object.assign(document.createElement("canvas"), { width: largura * escala, height: altura * escala });
  const ctx = canvas.getContext("2d");
  ctx.scale(escala, escala);
  if (formato === "jpg") { ctx.fillStyle = css("--superficie"); ctx.fillRect(0, 0, largura, altura); }
  ctx.drawImage(img, 0, 0, largura, altura);
  URL.revokeObjectURL(url);
  const tipo = formato === "jpg" ? "image/jpeg" : "image/png";
  const blob = await new Promise((ok) => canvas.toBlob(ok, tipo, 0.92));
  baixar(blob, `literadados_${slug(titulo)}.${formato}`);
}

function exportarTabela(alvo, formato) {
  const tabela = alvo.querySelector("table");
  if (!tabela) throw new Error("Não achei a tabela para exportar.");
  const linhas = [...tabela.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, " ").trim()))
    .filter((l) => l.length && l.some(Boolean));
  const nome = `literadados_${slug(tituloDe(alvo))}`;
  if (formato === "csv") baixar(new Blob([csv(linhas)], { type: "text/csv;charset=utf-8" }), `${nome}.csv`);
  else baixar(new Blob([xlsx(linhas)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${nome}.xlsx`);
}

// ---------- botões e janela de opções ----------
const OPCOES = {
  grafico: { titulo: "Exportar gráfico", itens: [["jpg", "JPG com fundo", "Fundo na cor do tema, bom para apresentações e redes."], ["png", "PNG sem fundo", "Fundo transparente, para pôr sobre outra cor."]] },
  tabela: { titulo: "Exportar tabela", itens: [["xlsx", "XLSX (Excel)", "Planilha com os números como números."], ["csv", "CSV", "Texto separado por vírgulas, UTF-8."]] },
};
export function montarExportacao() {
  const dlg = $("#exportar");
  let alvo = null, tipo = null;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-exportar]");
    if (!b) return;
    tipo = b.dataset.exportar;
    alvo = tipo === "tabela" ? b.closest(".tabela-exportavel") : b.parentElement;
    const o = OPCOES[tipo];
    $("#exportar-titulo").textContent = o.titulo;
    $("#exportar-sub").textContent = tituloDe(alvo);
    $("#exportar-opcoes").innerHTML = o.itens.map(([v, rot, desc], i) => `<label class="exportar-opcao"><input type="radio" name="exportar-formato" value="${v}" ${i ? "" : "checked"}>
      <span><b>${rot}</b><small>${desc}</small></span></label>`).join("");
    $("#exportar-erro").textContent = "";
    dlg.showModal();
  });
  const fechar = () => fecharAnimado(dlg, () => dlg.close());
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-fechar]")) fechar(); });
  $("#exportar-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formato = new FormData(e.target).get("exportar-formato");
    try {
      if (tipo === "grafico") await exportarGrafico(alvo, formato); else exportarTabela(alvo, formato);
      fechar();
    } catch (err) { $("#exportar-erro").textContent = err.message; }
  });
}
