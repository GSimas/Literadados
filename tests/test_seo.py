"""Páginas estáticas para buscadores e IAs (spec RF-27) e perfil de edição (RF-28)."""
import json
import re
import shutil
import subprocess
from html.parser import HTMLParser
from pathlib import Path

import duckdb
import pytest

import build
import seo
from test_app import RAIZ, _build, _csv, mini  # noqa: F401  (mini é fixture)


@pytest.fixture(scope="module")
def site(tmp_path_factory):
    """Build dos dados reais num web/ temporário, com uma cópia do index.html (números da abertura) e uma página órfã."""
    web = tmp_path_factory.mktemp("site") / "web"
    (web / "pessoas" / "fantasma").mkdir(parents=True)
    (web / "pessoas" / "fantasma" / "index.html").write_text("velha", encoding="utf-8")
    shutil.copy(RAIZ / "web" / "index.html", web / "index.html")
    build.build(RAIZ / "dados", web.parent / "s.duckdb", web / "dados.json")
    return web


class Pagina(HTMLParser):
    def __init__(self, txt):
        super().__init__()
        self.h1, self.ld, self.meta, self.canonical, self.title, self._em = 0, [], {}, None, "", None
        self.feed(txt)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        elif tag == "meta":
            self.meta[a.get("name") or a.get("property")] = a.get("content")
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical = a["href"]
        self._em = tag if tag in ("title", "script") and (tag == "title" or a.get("type") == "application/ld+json") else None

    def handle_data(self, data):
        if self._em == "title":
            self.title += data
        elif self._em == "script":
            self.ld.append(json.loads(data))

    def handle_endtag(self, tag):
        self._em = None


def _paginas(web):
    return {p.relative_to(web).as_posix(): p.read_text(encoding="utf-8") for pasta in seo.PASTAS for p in (web / pasta).rglob("index.html")}


def test_paginas_geradas(site):  # CA-27.1
    con = duckdb.connect(str(site.parent / "s.duckdb"), read_only=True)
    pessoas = {r[0] for r in con.execute("SELECT pessoa_id FROM v_participacao UNION SELECT pessoa_id FROM jurado").fetchall()}
    edicoes = {f"{p}/{a}" for p, a in con.execute("SELECT DISTINCT premio, ano FROM v_participacao").fetchall()}
    ufs = {r[0] for r in con.execute("SELECT DISTINCT uf_nascimento FROM v_participacao WHERE papel = 'autor' AND uf_nascimento <> 'EX'").fetchall()}
    eds = {r[0] for r in con.execute("SELECT DISTINCT e.id FROM v_participacao v JOIN editora e ON e.nome = v.editora WHERE v.papel = 'autor'").fetchall()}
    pags = _paginas(site)
    assert {f"pessoas/{i}/index.html" for i in pessoas} <= set(pags)
    assert {f"premios/{e}/index.html" for e in edicoes} <= set(pags)
    assert {f"estados/{u}/index.html" for u in ufs} <= set(pags)
    assert {f"editoras/{x}/index.html" for x in eds} <= set(pags)  # CA-29.3
    assert {"premios/index.html", "premios/jabuti/index.html", "pessoas/index.html", "estados/index.html", "perguntas/index.html", "dados-abertos/index.html", "editoras/index.html"} <= set(pags)
    assert not (site / "pessoas" / "fantasma").exists()  # quem saiu da base sai do site
    assert len(pags) == len(pessoas) + len(edicoes) + len(ufs) + len(eds) + 2 + 6  # nada além disso (2 prêmios, 6 listas)


def test_metadados_e_json_ld(site):  # CA-27.2
    for rel, txt in _paginas(site).items():
        p = Pagina(txt)
        assert p.h1 == 1, rel
        assert p.canonical == f"{seo.SITE}/{rel.removesuffix('index.html')}", rel
        assert p.title.strip() and p.meta.get("description") and p.meta.get("og:title") and p.meta.get("og:image"), rel
        assert '<html lang="pt-BR">' in txt
        assert p.ld and all(x["@context"] == "https://schema.org" for x in p.ld), rel
        assert len(p.meta["description"]) <= 320, rel
    for arq in ("index.html", "metodo.html"):  # escritos à mão
        p = Pagina((RAIZ / "web" / arq).read_text(encoding="utf-8"))
        assert p.canonical and p.meta.get("og:title") and p.ld and p.h1 <= 1


def test_regras_eticas_nas_paginas(site):  # CA-27.3
    con = duckdb.connect(str(site.parent / "s.duckdb"), read_only=True)
    pessoas = {r[0]: r for r in con.execute("SELECT id, raca, genero_evidencia FROM pessoa").fetchall()}
    for i, (_, raca, ev) in pessoas.items():
        arq = site / "pessoas" / i / "index.html"
        if not arq.exists():
            continue
        txt = arq.read_text(encoding="utf-8")
        p = Pagina(txt)
        pessoa = next(x["mainEntity"] for x in p.ld if x["@type"] == "ProfilePage")
        assert set(pessoa) <= {"@type", "name", "url", "sameAs", "gender", "birthDate", "birthPlace", "image", "award"}, i  # nunca raça
        if ev == "atribuicao":
            assert "gender" not in pessoa and "atribuído pelo primeiro nome" in txt, i
        if raca == "sem_declaracao":
            assert "Sem declaração não quer dizer pessoa branca" in txt and ">Branca<" not in txt, i
    # Todo percentual de cartão vem com o n ("x de y"); pessoas negras são piso.
    for rel, txt in _paginas(site).items():
        for val, det in re.findall(r'<div class="val">([^<]*%[^<]*)</div><div class="det">([^<]*)</div>', txt):
            assert re.search(r"\d de \d", det), (rel, val, det)
        assert "Pessoas negras</div><div class=\"val\">–" in txt or "≥" in txt or "Pessoas negras" not in txt, rel


def _no_node(js: str):
    node = shutil.which("node")
    if not node:
        pytest.skip("node não instalado")
    r = subprocess.run([node, "--input-type=module", "-e", js], capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(r.stdout)


def test_numeros_iguais_ao_painel(site):  # CA-27.4, CA-28.2
    js = (f"import * as M from {json.dumps((RAIZ / 'web' / 'metricas.js').as_uri())};"
          f"import {{ readFileSync }} from 'node:fs';"
          f"const ler = (a) => JSON.parse(readFileSync({json.dumps(str(site))} + '/' + a, 'utf8'));"
          f"const D = ler('dados.json'); const L = M.expandir(M.juntar(D, (D.partes ?? []).map(ler)));"
          f"const A = M.filtrar(L, {{}}); const eds = [...new Set(L.map((l) => l.premio + '|' + l.ano))];"
          f"process.stdout.write(JSON.stringify({{ total: M.historia(A),"
          f" premios: Object.fromEntries(D.premios.map((p) => [p.id, M.historia(M.filtrar(L, {{ premios: [p.id] }}))])),"
          f" edicoes: Object.fromEntries(eds.map((k) => {{ const [p, a] = k.split('|'); const r = M.perfilEdicao(L, p, +a); return [k, r]; }})),"
          f" editoras: Object.fromEntries(D.editoras.map((e) => [e.nome, M.perfilEditora(L, e.nome)]).filter(([, r]) => r)) }}));")
    js_ = _no_node(js)
    b = seo.Base(duckdb.connect(str(site.parent / "s.duckdb"), read_only=True))
    for py, h in [(seo.resumo(b.autores), js_["total"]), *[(seo.resumo(b.de(p)), js_["premios"][p]) for p in js_["premios"]]]:
        assert (py["pessoas"], py["indicacoes"], py["mulheres"], py["negras"]) == (h["pessoas"], h["indicacoes"], h["genero"]["mulheres"], h["raca"]["negras"])
    for k, h in js_["edicoes"].items():
        p, a = k.split("|")
        py = seo.resumo(b.de(p, int(a)))
        assert {c: py[c] for c in ("pessoas", "mulheres", "negras", "comUF", "sudeste", "generoAtribuido", "semDeclaracao")} == \
               {c: h[c] for c in ("pessoas", "mulheres", "negras", "comUF", "sudeste", "generoAtribuido", "semDeclaracao")}, k
    for nome, h in js_["editoras"].items():  # CA-29.3
        ls = seo.linhas_editora(b, nome)
        py = {**seo.resumo(ls), **seo.contagem_editora(ls)}
        assert {c: py[c] for c in ("indicacoes", "premiadas", "vencedoras", "pessoas", "mulheres", "negras")} == \
               {c: h[c] for c in ("indicacoes", "premiadas", "vencedoras", "pessoas", "mulheres", "negras")}, nome
    ids, _, pos = seo.ranking_editoras(b)
    assert all(pos[b.ed_id[n]] == h["posicao"] for n, h in js_["editoras"].items() if h["indicacoes"])
    # A abertura traz no HTML os números reais do painel (CA-27.6).
    t = js_["total"]
    idx = (site / "index.html").read_text(encoding="utf-8")
    assert f"<b>{seo.fmt(t['pessoas'])}</b><span>pessoas-autoras em {seo.fmt(t['indicacoes'])} indicações" in idx
    assert f"(piso: {seo.fmt(t['raca']['negras'])})" in idx and "<b>0</b>" not in idx


def test_sitemap_estavel_e_textos_para_ias(site):  # CA-27.5
    mapa = (site / "sitemap.xml").read_text(encoding="utf-8")
    locs = re.findall(r"<loc>([^<]+)</loc>", mapa)
    assert set(locs) == {f"{seo.SITE}/", f"{seo.SITE}/metodo.html", *(f"{seo.SITE}/{r.removesuffix('index.html')}" for r in _paginas(site))}
    antes = {p: p.stat().st_mtime_ns for p in site.rglob("*.html")}
    con = duckdb.connect(str(site.parent / "s.duckdb"), read_only=True)
    # Página que não mudou não é regravada e mantém o lastmod; página que mudou ganha a data de hoje.
    (site / "sitemap.xml").write_text(re.sub(r"<lastmod>[^<]+</lastmod>", "<lastmod>2000-01-01</lastmod>", mapa), encoding="utf-8")
    pessoa = next((site / "pessoas").iterdir()) / "index.html"
    pessoa.write_text("mudou", encoding="utf-8")
    seo.gerar(con, site)
    assert {p: p.stat().st_mtime_ns for p in site.rglob("*.html") if p != pessoa} == {p: t for p, t in antes.items() if p != pessoa}
    novo = (site / "sitemap.xml").read_text(encoding="utf-8")
    url = f"{seo.SITE}/{pessoa.parent.relative_to(site).as_posix()}/"
    assert f"<loc>{url}</loc><lastmod>{seo.date.today().isoformat()}</lastmod>" in novo
    assert f"<loc>{seo.SITE}/perguntas/</loc><lastmod>2000-01-01</lastmod>" in novo
    llms = (site / "llms.txt").read_text(encoding="utf-8")
    assert llms.startswith("# Literadados\n\n> ") and f"{seo.SITE}/perguntas/" in llms and "piso" in llms
    full = (site / "llms-full.txt").read_text(encoding="utf-8")
    assert "### Prêmio Jabuti 1959" in full and "1º lugar:" in full
    robots = (RAIZ / "web" / "robots.txt").read_text(encoding="utf-8")
    assert f"Sitemap: {seo.SITE}/sitemap.xml" in robots and "Disallow: /\n" not in robots
    assert (RAIZ / "web" / "404.html").exists()


def test_faq_responde_com_n(site):  # CA-27.2, CA-27.3
    p = Pagina((site / "perguntas" / "index.html").read_text(encoding="utf-8"))
    faq = next(x for x in p.ld if x["@type"] == "FAQPage")
    assert len(faq["mainEntity"]) >= 10
    for q in faq["mainEntity"]:
        r = q["acceptedAnswer"]["text"]
        assert "<" not in r
        if "%" in r:
            assert re.search(r"\d de \d|\(\d", r), q["name"]


# ---------- RF-28: texto de contexto ----------

def _contexto(mini, linhas):
    _csv(mini / "edicao_contexto.csv", linhas)


def test_contexto_vai_para_edicoes_json_e_pagina(mini):  # CA-28.3, CA-28.4
    texto = "Primeiro parágrafo sobre a edição, com contexto histórico suficiente para passar do mínimo de caracteres. " * 2
    _contexto(mini, [{"premio_id": "jabuti", "ano": "2016", "texto": texto + "\n\nSegundo parágrafo.", "fontes": "https://a.org/x ; https://b.org/y", "revisar": ""}])
    _build(mini)
    j = json.loads((mini.parent / "edicoes.json").read_text(encoding="utf-8"))
    assert j["jabuti|2016"]["fontes"] == ["https://a.org/x", "https://b.org/y"]
    pag = (mini.parent / "premios" / "jabuti" / "2016" / "index.html").read_text(encoding="utf-8")
    assert "<p>Segundo parágrafo.</p>" in pag and 'href="https://b.org/y"' in pag
    assert "<li><b>Contos e Crônicas:</b> <i>O1</i>" in pag


@pytest.mark.parametrize("linha", [
    {"premio_id": "jabuti", "ano": "2016", "texto": "x" * 300, "fontes": "", "revisar": ""},  # sem fonte
    {"premio_id": "jabuti", "ano": "2016", "texto": "x" * 300, "fontes": "https://a.org ; jornal da cidade", "revisar": ""},  # fonte sem URL
    {"premio_id": "jabuti", "ano": "1990", "texto": "x" * 300, "fontes": "https://a.org", "revisar": ""},  # edição inexistente
])
def test_build_falha_contexto_invalido(mini, linha):  # CA-28.3
    _contexto(mini, [linha])
    with pytest.raises((build.BuildError, duckdb.Error)):
        _build(mini)
