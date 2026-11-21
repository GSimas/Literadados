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
    """Build dos dados reais num web/ temporário, com uma cópia do premios.html (números da abertura) e uma página órfã."""
    web = tmp_path_factory.mktemp("site") / "web"
    (web / "pessoas" / "fantasma").mkdir(parents=True)
    (web / "pessoas" / "fantasma" / "index.html").write_text("velha", encoding="utf-8")
    shutil.copy(RAIZ / "web" / "premios.html", web / "premios.html")
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
    # quem só tem distinção pelo conjunto da obra também ganha página (CA-30.5)
    pessoas = {r[0] for r in con.execute("SELECT pessoa_id FROM v_participacao UNION SELECT pessoa_id FROM jurado UNION SELECT pessoa_id FROM distincao").fetchall()}
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
    for (pid,) in con.execute("SELECT pessoa_id FROM distincao LIMIT 3").fetchall():  # CA-30.5
        assert "<h2>Conjunto da obra</h2>" in pags[f"pessoas/{pid}/index.html"]
    premios = {e.split("/")[0] for e in edicoes}
    inds = {r[0] for r in con.execute("SELECT DISTINCT indicador_id FROM indicador_valor").fetchall()}  # módulo Leitura (CA-33.8)
    assert {f"leitura/{i}/index.html" for i in inds} <= set(pags) and (not inds or "leitura/index.html" in pags)
    # Mapeamento (CA-34.12): lista de municípios, página da cidade, livrarias, clubes e quem só está no mapeamento.
    muns = [r[0] for r in con.execute("SELECT DISTINCT municipio FROM livraria UNION SELECT municipio FROM obra_mapeada UNION SELECT municipio FROM pessoa_atuacao").fetchall()]
    n_mapa = (1 + len(muns) + con.execute("SELECT (SELECT COUNT(*) FROM livraria) + (SELECT COUNT(*) FROM clube)").fetchone()[0]
              + con.execute("SELECT COUNT(DISTINCT pessoa_id) FROM v_pessoa_mapeada WHERE pessoa_id NOT IN (SELECT pessoa_id FROM autoria)").fetchone()[0]) if muns else 0
    n_ev = con.execute("SELECT COUNT(*) FROM evento").fetchone()[0]  # módulo Eventos (CA-35.8)
    n_ev = n_ev + 1 if n_ev else 0
    assert len(pags) == len(pessoas) + len(edicoes) + len(ufs) + len(eds) + len(premios) + 6 + (len(inds) + 1 if inds else 0) + n_mapa + n_ev  # nada além disso


def test_marcas_editoras_e_catalogo_separado(site):  # CA-29.4, RNF-06
    logos = json.loads((site / "editoras-logos.json").read_text())
    assert logos and all(x["imagem_url"].startswith("https://") and x["pagina"].startswith("https://") for x in logos.values())
    assert "editoras-logos" not in (site / "dados.json").read_text()
    for arq in (site / "editoras").glob("*/index.html"):
        txt = arq.read_text()
        assert 'role="img" aria-label="Identidade visual de ' in txt
        assert 'class="marca-alternativa">Marca tipográfica' in txt
        if arq.parent.name in logos:
            assert 'referrerpolicy="no-referrer"' in txt
            assert logos[arq.parent.name]["imagem_url"].replace("&", "&amp;") in txt
            org = Pagina(txt).ld[0]["mainEntity"]
            assert org["logo"] == logos[arq.parent.name]["imagem_url"]


@pytest.mark.parametrize("mudanca", [{"editora_id": "inexistente"}, {"imagem_url": "http://x/logo.png"}, {"pagina": ""}, {"fundo": "qualquer"}])
def test_catalogo_logos_recusa_referencia_ou_fonte_invalida(mini, mudanca):
    row = {"editora_id": "ed", "imagem_url": "https://editora.example/logo.svg", "pagina": "https://editora.example/", "fonte": "Editora", "fundo": "claro", **mudanca}
    _csv(mini / "editora_logo.csv", [row])
    with pytest.raises(build.BuildError):
        _build(mini)


def test_metadados_e_json_ld(site):  # CA-27.2
    for rel, txt in _paginas(site).items():
        p = Pagina(txt)
        assert p.h1 == 1, rel
        assert p.canonical == f"{seo.SITE}/{rel.removesuffix('index.html')}", rel
        assert p.title.strip() and p.meta.get("description") and p.meta.get("og:title") and p.meta.get("og:image"), rel
        assert '<html lang="pt-BR">' in txt
        assert p.ld and all(x["@context"] == "https://schema.org" for x in p.ld), rel
        assert len(p.meta["description"]) <= 320, rel
    for arq in ("index.html", "premios.html", "sobre.html"):  # escritos à mão
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
    idx = (site / "premios.html").read_text(encoding="utf-8")
    assert f"<b>{seo.fmt(t['pessoas'])}</b><span>pessoas-autoras em {seo.fmt(t['indicacoes'])} indicações" in idx
    assert f"(piso: {seo.fmt(t['raca']['negras'])})" in idx and "<b>0</b>" not in idx


def test_sitemap_estavel_e_textos_para_ias(site):  # CA-27.5
    mapa = (site / "sitemap.xml").read_text(encoding="utf-8")
    locs = re.findall(r"<loc>([^<]+)</loc>", mapa)
    assert set(locs) == {f"{seo.SITE}/", f"{seo.SITE}/premios.html", f"{seo.SITE}/leitura.html", f"{seo.SITE}/mapeamento.html", *([f"{seo.SITE}/eventos.html"] if (site / "eventos.json").exists() else []), f"{seo.SITE}/sobre.html", *(f"{seo.SITE}/{r.removesuffix('index.html')}" for r in _paginas(site))}
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


def test_portal_numeros_do_build(site):  # CA-31.2, D37
    """O portal traz o cartão de cada módulo com dado, com os números gravados pelo build; sem JSON de dados."""
    idx = (site / "index.html").read_text(encoding="utf-8")
    con = duckdb.connect(str(site.parent / "s.duckdb"), read_only=True)
    b = seo.Base(con)
    r = seo.resumo(b.autores)
    n = sum(1 for p in b.premios if b.anos(p["id"]))
    assert f'<b>{seo.fmt(r["pessoas"])}</b> pessoas-autoras · <b>{seo.fmt(n)}</b> prêmios' in idx
    com_leitura = con.execute("SELECT COUNT(*) FROM indicador_valor").fetchone()[0] > 0
    com_mapa = any((site / "mapeamento").glob("[0-9]*.json"))
    com_eventos = con.execute("SELECT COUNT(*) FROM evento_edicao").fetchone()[0] > 0
    assert idx.count('class="cartao-grafico"') == 1 + com_leitura + com_mapa + com_eventos  # módulo sem dado não ganha cartão
    assert ('href="leitura.html"' in idx) == com_leitura
    assert "dados.json" not in idx and 'href="premios.html"' in idx
