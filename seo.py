"""Páginas estáticas para buscadores e IAs (spec RF-27, RF-28; design D32). Chamado por build.build com a conexão do build.

Gera, sem JavaScript, as páginas de prêmio, edição, pessoa, UF, as listas, as perguntas frequentes e os dados abertos,
mais sitemap.xml, llms.txt e llms-full.txt. Números com as regras de metricas.historia (paridade testada no Node).
"""
import html
import json
import re
from collections import Counter, defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from urllib.parse import quote

SITE = "https://literadados.gustavosimas.com"
AUTOR = {"@type": "Person", "name": "Gustavo Simas", "url": "https://gustavosimas.com"}
REPO = "https://github.com/GSimas/Literadados"
PASTAS = ["premios", "pessoas", "estados", "editoras", "perguntas", "dados-abertos"]  # inteiras geradas: o que não sai de novo é apagado
SOLTOS = ["sitemap.xml", "llms.txt", "llms-full.txt"]

ROT_GEN = {"mulher": "Mulher", "homem": "Homem", "nao_binario": "Não binária", "nao_identificado": "Não identificado"}
ROT_RACA = {"branca": "Branca", "preta": "Preta", "parda": "Parda", "negra": "Negra (sem especificar)", "amarela": "Amarela", "indigena": "Indígena"}
ROT_ETAPA = {"indicados": "indicada", "semifinalistas": "semifinalista", "finalistas": "finalista", "premiados": "premiada"}
LISTA = {"indicados": "indicados", "semifinalistas": "semifinalistas", "finalistas": "finalistas", "premiados": "só os premiados (sem lista pública)"}
GENERO_LD = {"mulher": "https://schema.org/Female", "homem": "https://schema.org/Male", "nao_binario": "não binário"}
PAISES = {"PT": "Portugal", "AO": "Angola", "MZ": "Moçambique", "CV": "Cabo Verde", "ST": "São Tomé e Príncipe", "GW": "Guiné-Bissau",
          "TL": "Timor-Leste", "GQ": "Guiné Equatorial", "AR": "Argentina", "IT": "Itália", "UA": "Ucrânia", "CL": "Chile", "IL": "Israel",
          "FR": "França", "ES": "Espanha", "IR": "Irã", "LB": "Líbano", "GB": "Reino Unido", "ZA": "África do Sul", "CH": "Suíça",
          "RO": "Romênia", "US": "Estados Unidos", "ER": "Eritreia", "DE": "Alemanha", "UY": "Uruguai", "JP": "Japão", "PL": "Polônia"}
NA = {"BA", "PB"}  # "na Bahia"; "no Ceará"; "em São Paulo"
NO = {"AC", "AP", "AM", "CE", "DF", "ES", "MA", "PA", "PR", "PI", "RJ", "RN", "RS", "TO"}
CATEGORIAS = ["Romance", "Contos", "Crônica", "Prosa", "Poesia", "Infantil", "Juvenil", "Infantil e Juvenil", "Geral", "Livro do Ano"]

e = html.escape


# ---------- números (mesmas regras de metricas.historia / metricas.resumoEdicao) ----------
def fmt(n) -> str:
    return "–" if n is None else f"{n:,}".replace(",", ".")


def pct(a, b):
    return 100 * a / b if b else None


def fmt_pct(v) -> str:
    """Como ui.fmtPct: uma casa abaixo de 10% (se não for inteiro), arredondando meio para cima."""
    if v is None:
        return "–"
    casas = 1 if v < 10 and v % 1 else 0
    q = Decimal(str(v)).quantize(Decimal("0.1") if casas else Decimal("1"), ROUND_HALF_UP)
    return f"{q}".replace(".", ",") + "%"


def resumo(linhas) -> dict:
    """Pessoas distintas entre linhas de autoria; % sobre todas as pessoas; negras = piso; Sudeste sobre quem tem UF no Brasil."""
    ps = {}
    for l in linhas:
        ps.setdefault(l["pessoa_id"], l)
    v = list(ps.values())
    n = len(v)
    mulheres = sum(p["genero"] == "mulher" for p in v)
    negras = sum(bool(p["negra"]) for p in v)
    com_uf = [p for p in v if p["regiao_nascimento"] and p["regiao_nascimento"] != "Exterior"]
    sudeste = sum(p["regiao_nascimento"] == "Sudeste" for p in com_uf)
    return {"pessoas": n, "mulheres": mulheres, "pctMulheres": pct(mulheres, n), "negras": negras, "pctNegras": pct(negras, n),
            "comUF": len(com_uf), "sudeste": sudeste, "pctSudeste": pct(sudeste, len(com_uf)),
            "generoAtribuido": sum(bool(p["genero_atribuido"]) for p in v), "semDeclaracao": sum(p["raca"] == "sem_declaracao" for p in v),
            "indicacoes": len({(l["premio"], l["ano"], l["nome_original"], l["obra_id"]) for l in linhas})}


# ---------- dados ----------
def _linhas(con, sql, params=None):
    cur = con.execute(sql, params or [])
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


class Base:
    def __init__(self, con):
        self.part = _linhas(con, """SELECT premio, premio_nome, ano, regime, categoria, nome_original, obra_id, titulo, ano_publicacao, editora,
                                           pessoa_id, nome, papel, genero, genero_atribuido, raca, raca_busca, negra, uf_nascimento,
                                           pais_nascimento, regiao_nascimento, lista_curta, colocacao, premiada, vencedora
                                    FROM v_participacao ORDER BY premio, ano, categoria, nome_original, colocacao NULLS LAST, titulo, pessoa_id""")
        self.autores = [l for l in self.part if l["papel"] == "autor"]
        self.premios = _linhas(con, "SELECT * FROM premio ORDER BY ordem")
        self.nome_premio = {p["id"]: p["nome"] for p in self.premios}
        self.edicoes = _linhas(con, "SELECT * FROM edicao ORDER BY premio_id, ano")
        self.edicao = {(x["premio_id"], x["ano"]): x for x in self.edicoes}
        self.cats = {(c["premio_id"], c["ano"], c["nome_original"]): c for c in _linhas(con, "SELECT * FROM categoria_edicao")}
        self.jurados = _linhas(con, """SELECT j.premio_id, j.ano, j.nome_original, c.categoria, j.pessoa_id, p.nome FROM jurado j
                                       JOIN categoria_edicao c USING (premio_id, ano, nome_original) JOIN pessoa p ON p.id = j.pessoa_id
                                       ORDER BY j.premio_id, j.ano, c.categoria, p.nome""")
        self.pessoas = {p["id"]: p for p in _linhas(con, "SELECT * FROM pessoa ORDER BY nome")}
        self.midia = {m["pessoa_id"]: m for m in _linhas(con, "SELECT * FROM pessoa_midia")}
        self.ufs = {u["uf"]: u for u in _linhas(con, "SELECT * FROM uf ORDER BY uf") if u["uf"] != "EX"}
        self.editoras = {x["id"]: x for x in _linhas(con, "SELECT * FROM editora ORDER BY nome")}
        self.ed_id = {x["nome"]: i for i, x in self.editoras.items()}  # nomes únicos (D33)
        self.contexto = {(c["premio_id"], c["ano"]): c for c in _linhas(con, "SELECT * FROM edicao_contexto")}
        self.com_dados = sorted({(l["premio"], l["ano"]) for l in self.part}, key=lambda k: ([p["id"] for p in self.premios].index(k[0]), k[1]))
        presentes = {l["pessoa_id"] for l in self.part} | {j["pessoa_id"] for j in self.jurados}
        self.ids = [i for i in self.pessoas if i in presentes]

    def de(self, premio=None, ano=None, linhas=None):
        return [l for l in (self.autores if linhas is None else linhas) if (premio is None or l["premio"] == premio) and (ano is None or l["ano"] == ano)]

    def anos(self, premio):
        return sorted({a for p, a in self.com_dados if p == premio})

    def resultado(self, l):
        if l["colocacao"]:
            return f"{l['colocacao']}º lugar"
        if l["lista_curta"] == 1:
            return "finalista"
        return ROT_ETAPA.get(self.cats[(l["premio"], l["ano"], l["nome_original"])]["etapa_lista"], "lista")


# ---------- página ----------
LOGO = '<img class="logo" src="/logo.svg" alt="" width="30" height="30">'
NAV = [("/", "Painel"), ("/premios/", "Prêmios"), ("/pessoas/", "Pessoas"), ("/editoras/", "Editoras"), ("/estados/", "Estados"), ("/perguntas/", "Perguntas"), ("/metodo.html", "Método")]


def _ld(obj) -> str:
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>"


def pagina(caminho, titulo, descricao, corpo, ld=(), migalhas=(), atual=None, og_tipo="website", imagem=None) -> str:
    url = SITE + caminho
    trilha = [("Início", "/"), *migalhas]
    ld = [*ld, {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + c} for i, (n, c) in enumerate(trilha)]}] if migalhas else list(ld)
    nav = "".join(f'<a href="{c}"{" aria-current=\"page\"" if c == atual else ""}>{r}</a>' for c, r in NAV)
    og_img = imagem or f"{SITE}/og.png"
    migas = ("<nav class=\"migalhas\" aria-label=\"Você está em\"><ol>" + "".join(
        f'<li><a href="{c}">{e(n)}</a></li>' if i < len(trilha) - 1 else f'<li aria-current="page">{e(n)}</li>' for i, (n, c) in enumerate(trilha))
        + "</ol></nav>") if migalhas else ""
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)}</title>
<meta name="description" content="{e(descricao)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="Gustavo Simas">
<meta property="og:type" content="{og_tipo}">
<meta property="og:site_name" content="Literadados">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(descricao)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{e(og_img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light dark">
<script>try{{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="preload" href="/fontes/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fontes/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css">
{"".join(_ld(x) for x in ld)}
</head>
<body class="estatica">
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="barra">
  <a class="marca" href="/" aria-label="Literadados, início">{LOGO}
    <span class="marca-texto">Litera<em>dados</em></span></a>
  <nav class="nav" aria-label="Seções">{nav}</nav>
</header>
<main id="conteudo" class="pagina-estatica">
{migas}
{corpo}
</main>
<footer class="rodape">
  <p><b>Literadados</b> · dados abertos sobre quem chega aos prêmios literários de língua portuguesa. Cada número tem fonte; cada pessoa, um perfil.
  <a href="/dados-abertos/">Dados abertos e como citar</a> · <a href="/metodo.html">Método e referências</a> · <a href="/">Painel interativo</a>.</p>
  <p class="muted">Correções, com fonte pública: <a href="mailto:contato@gustavosimas.com">contato@gustavosimas.com</a>.</p>
</footer>
</body>
</html>
"""


def kpis(itens) -> str:
    return '<div class="kpis">' + "".join(f'<div class="kpi"><div class="rot">{r}</div><div class="val">{v}</div><div class="det">{d}</div></div>'
                                          for r, v, d in itens) + "</div>"


def kpis_resumo(r) -> str:
    ast = "*" if r["generoAtribuido"] else ""
    return kpis([
        ("Pessoas-autoras", fmt(r["pessoas"]), f"em {fmt(r['indicacoes'])} indicações"),
        ("Mulheres", fmt_pct(r["pctMulheres"]) + ast, f"{fmt(r['mulheres'])} de {fmt(r['pessoas'])}" + (f"; {fmt(r['generoAtribuido'])} com gênero atribuído pelo nome*" if ast else "")),
        ("Pessoas negras", "≥ " + fmt_pct(r["pctNegras"]) if r["pessoas"] else "–", f"pelo menos {fmt(r['negras'])} de {fmt(r['pessoas'])}, por autodeclaração ({fmt(r['semDeclaracao'])} sem declaração)"),
        ("Nascidas no Sudeste", fmt_pct(r["pctSudeste"]), f"{fmt(r['sudeste'])} de {fmt(r['comUF'])} com UF de nascimento no Brasil"),
    ])


NOTA = ('<p class="muted pequeno">Regras: pessoas distintas, só autoria (ilustração e organização fora das contagens). Raça só por autodeclaração '
        'pública, com fonte: o número de pessoas negras é um piso, e "sem declaração" não quer dizer branca. Estado = UF de nascimento. '
        '* Gênero atribuído pelo primeiro nome, sem fonte; pode estar errado. <a href="/metodo.html">Método</a>.</p>')


def lnk_pessoa(b, pid):
    return f'<a href="/pessoas/{quote(pid)}/">{e(b.pessoas[pid]["nome"])}</a>'


def lnk_editora(b, nome):
    return f'<a href="/editoras/{quote(b.ed_id[nome])}/">{e(nome)}</a>' if nome in b.ed_id else e(nome or "–")


def nomes(b, ids):
    return ", ".join(lnk_pessoa(b, i) for i in ids)


def lugar(p) -> str:
    pais = PAISES.get(p["pais_nascimento"], p["pais_nascimento"]) if p["uf_nascimento"] == "EX" else None
    partes = [p["municipio_nascimento"], p["uf_nascimento"] if p["uf_nascimento"] not in (None, "EX") else pais]
    return ", ".join(x for x in partes if x)


def obras_de(b, linhas):
    """Obras de uma lista de linhas (todas as autorias), com autores/ilustradores/organizadores, em ordem de resultado."""
    por = {}
    for l in linhas:
        o = por.setdefault((l["premio"], l["ano"], l["nome_original"], l["obra_id"]), {**l, "autor": [], "ilustrador": [], "organizador": []})
        if l["pessoa_id"] not in o[l["papel"]]:
            o[l["papel"]].append(l["pessoa_id"])
    return sorted(por.values(), key=lambda o: (o["colocacao"] or 99, -(o["lista_curta"] or 0), o["titulo"].lower()))


def credito_obra(b, o) -> str:
    s = f'<i>{e(o["titulo"])}</i>'
    if o["autor"]:
        s += f", de {nomes(b, o['autor'])}"
    if o["ilustrador"]:
        s += f"; ilustração de {nomes(b, o['ilustrador'])}"
    if o["organizador"]:
        s += f"; organização de {nomes(b, o['organizador'])}"
    if o["editora"]:
        s += f' <span class="muted">({lnk_editora(b, o["editora"])})</span>'
    return s


def texto_obra(b, o) -> str:
    """O mesmo crédito, em texto puro (llms-full.txt, FAQ)."""
    s = f"{o['titulo']}"
    if o["autor"]:
        s += ", de " + ", ".join(b.pessoas[i]["nome"] for i in o["autor"])
    if o["editora"]:
        s += f" ({o['editora']})"
    return s


def ordem_cat(c):
    return (CATEGORIAS.index(c) if c in CATEGORIAS else 99, c)


# ---------- páginas de edição (RF-28) ----------
def pagina_edicao(b, premio, ano):
    nome = b.nome_premio[premio]
    ed = b.edicao[(premio, ano)]
    todas = b.de(premio, ano, b.part)
    r = resumo(b.de(premio, ano))
    anos = b.anos(premio)
    i = anos.index(ano)
    ant, seg = (anos[i - 1] if i else None), (anos[i + 1] if i + 1 < len(anos) else None)
    ra = resumo(b.de(premio, ant)) if ant else None
    por_cat = defaultdict(list)
    for l in todas:
        por_cat[(l["categoria"], l["nome_original"])].append(l)
    cats = sorted(por_cat, key=lambda k: (ordem_cat(k[0]), "estrei" in k[1].lower(), k[1]))  # estreia depois da lista principal
    obras = {k: obras_de(b, por_cat[k]) for k in cats}
    vencedoras = [(k, o) for k in cats for o in obras[k] if o["colocacao"] == 1]
    lead = ('<p class="lead"><b>Venceram (1º lugar):</b></p><ul class="vencedoras-lead">' + "".join(f"<li><b>{e(k[1])}:</b> {credito_obra(b, o)}</li>" for k, o in vencedoras) + "</ul>") if vencedoras else ""
    ctx = b.contexto.get((premio, ano))
    texto = ""
    if ctx:
        fontes = [u.strip() for u in ctx["fontes"].split(" ; ")]
        texto = ('<section class="edicao-texto" aria-label="Contexto da edição">' + "".join(f"<p>{e(t.strip())}</p>" for t in re.split(r"\n\s*\n", ctx["texto"]) if t.strip())
                 + '<p class="muted pequeno">Fontes do texto: ' + " · ".join(f'<a href="{e(u)}" rel="noopener">{e(re.sub(r"^www.", "", u.split("/")[2]))}</a>' for u in fontes) + "</p></section>")
    comp = ""
    if ra:
        comp = (f'<p class="muted pequeno">Na edição anterior ({ant}): {fmt(ra["pessoas"])} pessoas-autoras, {fmt_pct(ra["pctMulheres"])} mulheres '
                f'({fmt(ra["mulheres"])} de {fmt(ra["pessoas"])}), pelo menos {fmt(ra["negras"])} pessoas negras.</p>')
    secoes = []
    for k in cats:
        c = b.cats[(premio, ano, k[1])]
        jur = [j["pessoa_id"] for j in b.jurados if j["premio_id"] == premio and j["ano"] == ano and j["nome_original"] == k[1]]
        itens = "".join(f'<li{" class=\"venceu\"" if o["colocacao"] == 1 else ""}><span class="resultado">{b.resultado(o)}</span><span>{credito_obra(b, o)}</span></li>' for o in obras[k])
        secoes.append(f'<section class="edicao-categoria"><h2>{e(k[1])}{f" <span class=\"muted pequeno\">({e(k[0])})</span>" if k[0] != k[1] else ""}</h2>'
                      f'<p class="muted pequeno">Lista: {LISTA.get(c["etapa_lista"], e(c["etapa_lista"]))} · <a href="{e(c["fonte"])}" rel="noopener">fonte</a></p>'
                      f'<ol class="obras-edicao">{itens}</ol>' + (f'<p class="pequeno"><b>Júri:</b> {nomes(b, jur)}</p>' if jur else "") + "</section>")
    navs = " ".join(x for x in [ant and f'<a class="chip-link" href="/premios/{premio}/{ant}/">‹ {ant}</a>', seg and f'<a class="chip-link" href="/premios/{premio}/{seg}/">{seg} ›</a>'] if x)
    corpo = f"""<article class="secao">
<header class="secao-cab"><p class="sobretitulo">Edição · {e(ed["regime"])}</p><h1>{e(nome)} {ano}</h1>{lead}
<p class="links-externos">{navs} <a class="chip-link" href="/#/edicao/{premio}/{ano}">Abrir no painel, com gráficos</a> <a class="chip-link" href="{e(ed["fonte"])}" rel="noopener">Fonte oficial</a></p></header>
{texto}
<h2>A edição em números</h2>
{kpis_resumo(r)}
{comp}
{NOTA}
{"".join(secoes)}
<p class="muted pequeno">O Literadados cobre as categorias literárias do recorte (romance, conto, crônica, poesia, infantil, juvenil e o Livro do Ano); as demais categorias do prêmio ficam fora.</p>
</article>"""
    livros = [{"@type": "Book", "name": o["titulo"], "url": f"{SITE}/premios/{premio}/{ano}/",
               "author": [{"@type": "Person", "name": b.pessoas[i]["nome"], "url": f"{SITE}/pessoas/{quote(i)}/"} for i in o["autor"]],
               **({"publisher": {"@type": "Organization", "name": o["editora"]}} if o["editora"] else {}),
               "award": f"{nome} {ano} — {k[1]}, {o['colocacao']}º lugar"}
              for k in cats for o in obras[k] if o["colocacao"]]
    venc_txt = "; ".join(f"{k[1]}: {texto_obra(b, o)}" for k, o in vencedoras)
    desc = (f"{nome} {ano}: " + (f"venceram {venc_txt}. " if venc_txt else "") + f"{fmt(r['pessoas'])} pessoas-autoras na lista, com gênero, raça declarada e UF de nascimento.")[:300]
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": f"{nome} {ano}", "url": f"{SITE}/premios/{premio}/{ano}/",
           "inLanguage": "pt-BR", "isPartOf": {"@type": "WebSite", "name": "Literadados", "url": SITE + "/"},
           **({"description": " ".join(ctx["texto"].split())[:500]} if ctx else {}),
           "mainEntity": {"@type": "ItemList", "name": f"Obras premiadas — {nome} {ano}", "numberOfItems": len(livros),
                          "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": x} for i, x in enumerate(livros)]}}]
    return pagina(f"/premios/{premio}/{ano}/", f"{nome} {ano}: vencedores, indicados e contexto | Literadados", desc, corpo, ld,
                  [("Prêmios", "/premios/"), (nome, f"/premios/{premio}/"), (str(ano), f"/premios/{premio}/{ano}/")], "/premios/")


# ---------- prêmios ----------
def ranking(linhas, n=15):
    por = defaultdict(lambda: {"vitorias": set(), "premios": set(), "indicacoes": set()})
    for l in linhas:
        k = (l["premio"], l["ano"], l["nome_original"], l["obra_id"])
        por[l["pessoa_id"]]["indicacoes"].add(k)
        if l["premiada"]:
            por[l["pessoa_id"]]["premios"].add(k)
        if l["vencedora"]:
            por[l["pessoa_id"]]["vitorias"].add(k)
    lista = [(pid, len(v["vitorias"]), len(v["premios"]), len(v["indicacoes"])) for pid, v in por.items()]
    return sorted(lista, key=lambda x: (-x[1], -x[2], -x[3], x[0]))[:n]


def top_ufs(linhas, n=5):
    ps = {}
    for l in linhas:
        ps.setdefault(l["pessoa_id"], l)
    c = Counter(p["uf_nascimento"] for p in ps.values() if p["uf_nascimento"] and p["uf_nascimento"] != "EX")
    return sorted(c.items(), key=lambda x: (-x[1], x[0]))[:n], sum(c.values())


def primeira_mulher(b, premio):
    vs = [l for l in b.de(premio) if l["vencedora"] and l["genero"] == "mulher"]
    if not vs:
        return None
    ano = min(l["ano"] for l in vs)
    return ano, [l for l in vs if l["ano"] == ano]


def pagina_premio(b, p):
    pid, nome = p["id"], p["nome"]
    anos = b.anos(pid)
    r, rp, rv = resumo(b.de(pid)), resumo([l for l in b.de(pid) if l["premiada"]]), resumo([l for l in b.de(pid) if l["vencedora"]])
    cats = sorted({l["categoria"] for l in b.de(pid, linhas=b.part)}, key=ordem_cat)
    regimes = defaultdict(list)
    for x in b.edicoes:
        if x["premio_id"] == pid:
            regimes[x["regime"]].append(x["ano"])
    linhas_ed = []
    for a in reversed(anos):
        ra = resumo(b.de(pid, a))
        venc = sorted({l["pessoa_id"] for l in b.de(pid, a) if l["vencedora"]}, key=lambda i: b.pessoas[i]["nome"])
        linhas_ed.append(f'<tr><td><a href="/premios/{pid}/{a}/">{a}</a></td><td class="num">{fmt(ra["pessoas"])}</td>'
                         f'<td class="num">{fmt_pct(ra["pctMulheres"])} ({fmt(ra["mulheres"])})</td><td class="num">{fmt(ra["negras"])}</td><td>{nomes(b, venc)}</td></tr>')
    rk = ranking(b.de(pid))
    ufs, com_uf = top_ufs([l for l in b.de(pid) if l["premiada"]])
    pm = primeira_mulher(b, pid)
    corpo = f"""<article class="secao">
<header class="secao-cab"><p class="sobretitulo">Prêmio · {e(p["organizador"])}</p><h1>{e(nome)}</h1>
<p class="lead">{e(nome)}, organizado por {e(p["organizador"])} desde {p["ano_inicio"]}, {"aberto a autores de toda a língua portuguesa" if p["abrangencia"] == "lusofono" else "prêmio nacional"}.
O Literadados reúne {fmt(len(anos))} edições ({anos[0]}–{anos[-1]}) nas categorias {", ".join(cats)}: {fmt(r["pessoas"])} pessoas-autoras em {fmt(r["indicacoes"])} indicações.</p>
<p class="links-externos"><a class="chip-link" href="/?panorama=~p:{pid}#panorama">Abrir no painel</a> <a class="chip-link" href="{e(p["fonte"])}" rel="noopener">Site oficial</a></p></header>
<h2>Quem chega, quem é premiado, quem vence</h2>
{kpis_resumo(r)}
<div class="rolagem"><table class="tabela"><caption>Mulheres e pessoas negras (piso) em cada etapa, pessoas distintas</caption>
<thead><tr><th scope="col">Etapa</th><th class="num" scope="col">Pessoas</th><th class="num" scope="col">Mulheres</th><th class="num" scope="col">Negras (pelo menos)</th></tr></thead><tbody>
{"".join(f'<tr><td>{rot}</td><td class="num">{fmt(x["pessoas"])}</td><td class="num">{fmt_pct(x["pctMulheres"])} ({fmt(x["mulheres"])})</td><td class="num">{fmt_pct(x["pctNegras"])} ({fmt(x["negras"])})</td></tr>' for rot, x in [("Lista", r), ("Premiadas", rp), ("1º lugar", rv)])}
</tbody></table></div>
{f'<p>A primeira mulher a vencer (1º lugar) numa categoria do recorte foi em {pm[0]}: ' + "; ".join(f"{lnk_pessoa(b, l['pessoa_id'])}, em {e(l['nome_original'])}, com <i>{e(l['titulo'])}</i>" for l in pm[1]) + ".</p>" if pm else ""}
{f'<p>Estados de nascimento com mais pessoas premiadas: ' + ", ".join(f'<a href="/estados/{u}/">{e(b.ufs[u]["nome"])}</a> ({fmt(n)})' for u, n in ufs) + f" — de {fmt(com_uf)} pessoas premiadas com UF no Brasil.</p>" if ufs else ""}
{NOTA}
<h2>Formatos</h2>
<ul>{"".join(f"<li>{e(reg)}: {min(a)}–{max(a)}</li>" for reg, a in regimes.items())}</ul>
<h2>Mais premiados</h2>
<div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Pessoa</th><th class="num" scope="col">1º lugar</th><th class="num" scope="col">Prêmios</th><th class="num" scope="col">Indicações</th></tr></thead><tbody>
{"".join(f'<tr><td>{lnk_pessoa(b, i)}</td><td class="num">{v}</td><td class="num">{pr}</td><td class="num">{ind}</td></tr>' for i, v, pr, ind in rk)}
</tbody></table></div>
<h2>Edições</h2>
<div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Ano</th><th class="num" scope="col">Pessoas-autoras</th><th class="num" scope="col">Mulheres</th><th class="num" scope="col">Negras (pelo menos)</th><th scope="col">1º lugar</th></tr></thead><tbody>
{"".join(linhas_ed)}
</tbody></table></div>
</article>"""
    desc = (f"{nome} ({anos[0]}–{anos[-1]}): vencedores e indicados de {fmt(len(anos))} edições, com o perfil de quem chega ao prêmio — "
            f"{fmt_pct(r['pctMulheres'])} mulheres, pelo menos {fmt(r['negras'])} pessoas negras, UF de nascimento. Dados com fonte.")
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": nome, "url": f"{SITE}/premios/{pid}/", "inLanguage": "pt-BR",
           "about": {"@type": "Thing", "name": nome, "sameAs": p["fonte"]},
           "mainEntity": {"@type": "ItemList", "name": f"Edições do {nome}", "numberOfItems": len(anos),
                          "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/premios/{pid}/{a}/", "name": f"{nome} {a}"} for i, a in enumerate(anos)]}}]
    return pagina(f"/premios/{pid}/", f"{nome}: vencedores, indicados e perfil dos autores ({anos[0]}–{anos[-1]}) | Literadados", desc, corpo, ld,
                  [("Prêmios", "/premios/"), (nome, f"/premios/{pid}/")], "/premios/")


def pagina_premios(b):
    itens = []
    for p in b.premios:
        anos = b.anos(p["id"])
        if not anos:
            continue
        r = resumo(b.de(p["id"]))
        eds = " ".join(f'<a href="/premios/{p["id"]}/{a}/">{a}</a>' for a in anos)
        itens.append(f'<section><h2><a href="/premios/{p["id"]}/">{e(p["nome"])}</a></h2><p>{e(p["organizador"])} · {fmt(len(anos))} edições ({anos[0]}–{anos[-1]}) · '
                     f'{fmt(r["pessoas"])} pessoas-autoras · {fmt_pct(r["pctMulheres"])} mulheres ({fmt(r["mulheres"])}) · pelo menos {fmt(r["negras"])} pessoas negras</p>'
                     f'<p class="anos-lista">{eds}</p></section>')
    corpo = f"""<article class="secao"><header class="secao-cab"><p class="sobretitulo">Prêmios</p><h1>Prêmios literários no Literadados</h1>
<p class="lead">Cada prêmio, cada edição: quem venceu, quem chegou à lista e o perfil (gênero, raça autodeclarada, UF de nascimento) de quem escreveu.</p></header>
{"".join(itens)}</article>"""
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": "Prêmios literários no Literadados", "url": f"{SITE}/premios/",
           "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/premios/{p['id']}/", "name": p["nome"]}
                                                                    for i, p in enumerate(x for x in b.premios if b.anos(x["id"]))]}}]
    nomes_p = " e ".join(p["nome"] for p in b.premios if b.anos(p["id"]))
    return pagina("/premios/", "Prêmios literários: edições, vencedores e indicados | Literadados",
                  f"{nomes_p}: todas as edições coletadas, com vencedores, indicados e o perfil de quem chega a cada prêmio.", corpo, ld, [("Prêmios", "/premios/")], "/premios/")


# ---------- pessoas ----------
def link_fonte(u) -> str:
    us = [x.strip() for x in (u or "").split(" ; ") if x.strip().startswith("http")]
    return " ".join(f'<a href="{e(x)}" rel="noopener">fonte</a>' for x in us) if us else '<span class="muted">(sem fonte)</span>'


def pagina_pessoa(b, pid):
    p, m = b.pessoas[pid], b.midia.get(pid, {})
    ls = [l for l in b.part if l["pessoa_id"] == pid]
    jur = [j for j in b.jurados if j["pessoa_id"] == pid]
    obras = sorted(obras_de(b, ls), key=lambda o: (o["ano"], o["premio"], ordem_cat(o["categoria"])))
    pap = {(o["premio"], o["ano"], o["nome_original"], o["obra_id"]): [x for x in ("autor", "ilustrador", "organizador") if pid in o[x]] for o in obras}
    contam = [o for o in obras if "organizador" not in pap[(o["premio"], o["ano"], o["nome_original"], o["obra_id"])] or len(pap[(o["premio"], o["ano"], o["nome_original"], o["obra_id"])]) > 1]
    premiadas = [o for o in contam if o["colocacao"]]
    vitorias = [o for o in contam if o["colocacao"] == 1]
    premios_ids = list(dict.fromkeys([o["premio"] for o in obras] + [j["premio_id"] for j in jur]))
    nomes_premios = " e no ".join(b.nome_premio[x] for x in premios_ids)
    anos = sorted({o["ano"] for o in obras} | {j["ano"] for j in jur})
    nasc = lugar(p)
    ident = ", ".join(x for x in [nasc, str(p["ano_nascimento"]) if p["ano_nascimento"] else ""] if x)
    partes = []
    if contam:
        partes.append(f"teve {fmt(len(contam))} indicaç{'ão' if len(contam) == 1 else 'ões'}")
        if premiadas:
            partes.append(f"recebeu {fmt(len(premiadas))} prêmio{'' if len(premiadas) == 1 else 's'}"
                          + (f", {fmt(len(vitorias))} deles em 1º lugar" if vitorias and len(premiadas) > 1 else " em 1º lugar" if vitorias else ""))
    if jur:
        partes.append(f"integrou o júri {fmt(len(jur))} vez{'' if len(jur) == 1 else 'es'}")
    lead = (f"<b>{e(p['nome'])}</b>{f' ({e(ident)})' if ident else ''} " + ", ".join(partes[:-1]) + (" e " if len(partes) > 1 else "") + partes[-1]
            + f" no {e(nomes_premios)}" + (f", entre {anos[0]} e {anos[-1]}" if len(anos) > 1 else f", em {anos[0]}") + ".") if partes else ""
    # Gênero (CA-27.3): atribuído = marcado; sem fonte nem atribuição = não identificado.
    if p["genero_evidencia"] == "atribuicao":
        gen = f"{ROT_GEN[p['genero']]}* <span class=\"muted pequeno\">— atribuído pelo primeiro nome, sem fonte; pode estar errado</span>"
    else:
        gen = ROT_GEN[p["genero"]] + (" " + link_fonte(p["genero_fonte"]) if p["genero"] != "nao_identificado" else "")
    if p["raca"] != "sem_declaracao":
        tipo = "autodeclaração pública" if p["raca_evidencia"] == "autodeclaracao" else "fonte curada por identidade"
        raca = (f"{ROT_RACA[p['raca']]} <span class=\"muted pequeno\">({tipo})</span> {link_fonte(p['raca_fonte'])}"
                + (f"<blockquote>{e(p['raca_trecho'])}</blockquote>" if p["raca_trecho"] else ""))
    else:
        raca = ("Sem autodeclaração pública encontrada <span class=\"muted pequeno\">— "
                + ("busca feita pelo protocolo" if p["raca_busca"] == "completa" else "busca interrompida: pode haver declaração não encontrada")
                + ". Sem declaração não quer dizer pessoa branca.</span>")
    uf_link = f' <a href="/estados/{p["uf_nascimento"]}/">({e(b.ufs[p["uf_nascimento"]]["nome"])})</a>' if p["uf_nascimento"] in b.ufs else ""
    nasc_dd = (e(ident) + uf_link + " " + link_fonte(p["nascimento_fonte"])) if ident else '<span class="muted">sem dado</span>'
    externos = [f'<a href="https://www.wikidata.org/wiki/{e(p["wikidata"])}" rel="noopener">Wikidata {e(p["wikidata"])}</a>' if p["wikidata"] else "",
                f'<a href="https://pt.wikipedia.org/wiki/{quote(m["wikipedia_pt"].replace(" ", "_"))}" rel="noopener">Wikipédia</a>' if m.get("wikipedia_pt") else ""]
    foto, img_url = "", None
    if m.get("imagem") and (Path(__file__).parent / "web" / "fotos" / f"{pid}-480.webp").exists():
        img_url = f"{SITE}/fotos/{quote(pid)}-480.webp"
        arquivo = "https://commons.wikimedia.org/wiki/File:" + quote(m["imagem"].replace(" ", "_"))
        foto = (f'<figure class="foto-estatica"><img src="/fotos/{quote(pid)}-480.webp" alt="{e(p["nome"])}" width="240" height="276" loading="lazy" decoding="async">'
                f'<figcaption class="credito">Foto: {e(m["imagem_autor"])}, {e(m["imagem_licenca"])} · <a href="{e(arquivo)}" rel="noopener">Wikimedia Commons</a></figcaption></figure>')
    papel_rot = {"autor": "", "ilustrador": " (ilustração)", "organizador": " (organização)"}
    linhas_t = "".join(
        f'<tr><td><a href="/premios/{o["premio"]}/{o["ano"]}/">{o["ano"]}</a></td><td>{e(b.nome_premio[o["premio"]])}</td><td>{e(o["nome_original"])}</td>'
        f'<td><i>{e(o["titulo"])}</i>{"".join(papel_rot[x] for x in pap[(o["premio"], o["ano"], o["nome_original"], o["obra_id"])])}</td>'
        f'<td>{lnk_editora(b, o["editora"])}</td><td>{b.resultado(o)}</td></tr>' for o in obras)
    corpo = f"""<article class="secao pessoa-estatica">
<header class="secao-cab"><p class="sobretitulo">Pessoa</p><h1>{e(p["nome"])}</h1>{f'<p class="lead">{lead}</p>' if lead else ""}
<p class="links-externos"><a class="chip-link" href="/#/pessoa/{quote(pid)}">Abrir no painel</a> {" ".join(x for x in externos if x)}</p></header>
{foto}
<dl class="fatos">
<dt>Gênero</dt><dd>{gen}</dd>
<dt>Raça declarada</dt><dd>{raca}</dd>
<dt>Nascimento</dt><dd>{nasc_dd}</dd>
</dl>
{f'''<h2>Nos prêmios</h2><div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Ano</th><th scope="col">Prêmio</th><th scope="col">Categoria</th><th scope="col">Obra</th><th scope="col">Editora</th><th scope="col">Resultado</th></tr></thead>
<tbody>{linhas_t}</tbody></table></div>''' if obras else ""}
{("<h2>Júri</h2><ul>" + "".join(f'<li><a href="/premios/{j["premio_id"]}/{j["ano"]}/">{e(b.nome_premio[j["premio_id"]])} {j["ano"]}</a> — {e(j["nome_original"])}</li>' for j in jur) + "</ul>") if jur else ""}
<p class="muted pequeno">Raça só entra por autodeclaração pública, com link e trecho; gênero sem fonte é atribuído pelo nome e marcado. Encontrou um erro? Escreva para <a href="mailto:contato@gustavosimas.com">contato@gustavosimas.com</a> com a fonte. <a href="/metodo.html">Método</a>.</p>
</article>"""
    pessoa = {"@type": "Person", "name": p["nome"], "url": f"{SITE}/pessoas/{quote(pid)}/"}
    same = [f"https://www.wikidata.org/wiki/{p['wikidata']}"] if p["wikidata"] else []
    if m.get("wikipedia_pt"):
        same.append(f"https://pt.wikipedia.org/wiki/{quote(m['wikipedia_pt'].replace(' ', '_'))}")
    if same:
        pessoa["sameAs"] = same
    if p["genero"] in GENERO_LD and p["genero_evidencia"] != "atribuicao":  # gênero só com fonte; raça nunca (CA-27.3)
        pessoa["gender"] = GENERO_LD[p["genero"]]
    if p["ano_nascimento"]:
        pessoa["birthDate"] = str(p["ano_nascimento"])
    if nasc:
        pessoa["birthPlace"] = {"@type": "Place", "name": nasc + ("" if p["uf_nascimento"] == "EX" else ", Brasil")}
    if img_url:
        pessoa["image"] = img_url
    if premiadas:
        pessoa["award"] = [f"{b.nome_premio[o['premio']]} {o['ano']} — {o['nome_original']}, {o['colocacao']}º lugar" for o in premiadas]
    ld = [{"@context": "https://schema.org", "@type": "ProfilePage", "url": f"{SITE}/pessoas/{quote(pid)}/", "inLanguage": "pt-BR", "mainEntity": pessoa}]
    desc = (f"{p['nome']}: " + (f"{fmt(len(contam))} indicações e {fmt(len(premiadas))} prêmios" if contam else "júri")
            + f" no {nomes_premios} ({anos[0]}{'–' + str(anos[-1]) if len(anos) > 1 else ''}). Obras, editoras, nascimento, gênero e raça declarada, com fontes.")
    return pagina(f"/pessoas/{quote(pid)}/", f"{p['nome']} nos prêmios literários | Literadados", desc, corpo, ld,
                  [("Pessoas", "/pessoas/"), (p["nome"], f"/pessoas/{quote(pid)}/")], "/pessoas/", "profile", img_url)


def _inicial(nome):
    import unicodedata
    c = unicodedata.normalize("NFD", nome.strip()[:1].upper())[:1]
    return c if c.isalpha() else "#"


def pagina_pessoas(b):
    contagem = defaultdict(lambda: [0, 0])
    for o in obras_de(b, b.autores):
        for i in o["autor"]:
            contagem[i][0] += 1
            contagem[i][1] += bool(o["colocacao"])
    grupos = defaultdict(list)
    for i in b.ids:
        grupos[_inicial(b.pessoas[i]["nome"])].append(i)
    letras = sorted(grupos)
    secoes = "".join(f'<section id="letra-{l}"><h2>{l}</h2><ul class="colunas-lista">' + "".join(
        f'<li>{lnk_pessoa(b, i)} <span class="muted pequeno">{fmt(contagem[i][0]) + " ind." if contagem[i][0] else "júri"}{" · " + fmt(contagem[i][1]) + " prêmio" + ("s" if contagem[i][1] > 1 else "") if contagem[i][1] else ""}</span></li>'
        for i in sorted(grupos[l], key=lambda x: b.pessoas[x]["nome"].lower())) + "</ul></section>" for l in letras)
    corpo = f"""<article class="secao"><header class="secao-cab"><p class="sobretitulo">Pessoas</p><h1>Pessoas de A a Z</h1>
<p class="lead">As {fmt(len(b.ids))} pessoas da base — autoria, ilustração, organização e júri — com perfil, fontes e a trajetória em cada prêmio.</p>
<nav class="letras" aria-label="Letras">{" ".join(f'<a href="#letra-{l}">{l}</a>' for l in letras)}</nav></header>
{secoes}</article>"""
    return pagina("/pessoas/", "Pessoas de A a Z nos prêmios literários | Literadados",
                  f"As {fmt(len(b.ids))} pessoas que chegaram aos prêmios literários da base do Literadados, de A a Z, com perfil, obras e fontes.",
                  corpo, [{"@context": "https://schema.org", "@type": "CollectionPage", "name": "Pessoas de A a Z", "url": f"{SITE}/pessoas/", "inLanguage": "pt-BR"}],
                  [("Pessoas", "/pessoas/")], "/pessoas/")


# ---------- estados ----------
def em_uf(uf, nome):
    return f"{'na' if uf in NA else 'no' if uf in NO else 'em'} {nome}"


def pagina_estado(b, uf):
    u = b.ufs[uf]
    em = em_uf(uf, u["nome"])
    ls = [l for l in b.autores if l["uf_nascimento"] == uf]
    r = resumo(ls)
    total_br = len({l["pessoa_id"] for l in b.autores if l["uf_nascimento"] in b.ufs})
    rk = ranking(ls, n=10_000)
    por_premio = "; ".join(f"{b.nome_premio[p['id']]}: {fmt(len({l['pessoa_id'] for l in ls if l['premio'] == p['id']}))}" for p in b.premios if any(l["premio"] == p["id"] for l in ls))
    prem = len({l["pessoa_id"] for l in ls if l["premiada"]})
    venc = len({l["pessoa_id"] for l in ls if l["vencedora"]})
    corpo = f"""<article class="secao"><header class="secao-cab"><p class="sobretitulo">Estado · {e(u["regiao"])}</p><h1>Nascidos {e(em)} nos prêmios literários</h1>
<p class="lead">{fmt(r["pessoas"])} pessoas-autoras nasceram {e(em)} ({uf}): {fmt_pct(pct(r["pessoas"], total_br))} das {fmt(total_br)} com UF de nascimento conhecida no Brasil.
{fmt(prem)} foram premiadas e {fmt(venc)} venceram (1º lugar). Por prêmio: {por_premio}.</p>
<p class="links-externos"><a class="chip-link" href="/#/uf/{uf}">Abrir no painel, com gráficos</a></p></header>
{kpis_resumo(r)}
{NOTA}
<h2>Quem nasceu {e(em)}</h2>
<div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Pessoa</th><th class="num" scope="col">1º lugar</th><th class="num" scope="col">Prêmios</th><th class="num" scope="col">Indicações</th></tr></thead><tbody>
{"".join(f'<tr><td>{lnk_pessoa(b, i)}</td><td class="num">{v}</td><td class="num">{pr}</td><td class="num">{ind}</td></tr>' for i, v, pr, ind in rk)}
</tbody></table></div></article>"""
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": f"Nascidos {em} nos prêmios literários", "url": f"{SITE}/estados/{uf}/",
           "about": {"@type": "AdministrativeArea", "name": u["nome"], "containedInPlace": {"@type": "Country", "name": "Brasil"}},
           "mainEntity": {"@type": "ItemList", "numberOfItems": len(rk), "itemListElement": [
               {"@type": "ListItem", "position": i + 1, "item": {"@type": "Person", "name": b.pessoas[x[0]]["nome"], "url": f"{SITE}/pessoas/{quote(x[0])}/"}} for i, x in enumerate(rk)]}}]
    return pagina(f"/estados/{uf}/", f"Escritores nascidos {em} nos prêmios literários | Literadados",
                  f"{fmt(r['pessoas'])} pessoas-autoras nascidas {em} chegaram aos prêmios literários da base; {fmt(prem)} premiadas. Lista, números e fontes.",
                  corpo, ld, [("Estados", "/estados/"), (u["nome"], f"/estados/{uf}/")], "/estados/")


def pagina_estados(b, ufs):
    total = len({l["pessoa_id"] for l in b.autores if l["uf_nascimento"] in b.ufs})
    linhas = []
    for uf in sorted(ufs, key=lambda x: -len({l["pessoa_id"] for l in b.autores if l["uf_nascimento"] == x})):
        ls = [l for l in b.autores if l["uf_nascimento"] == uf]
        n = len({l["pessoa_id"] for l in ls})
        linhas.append(f'<tr><td><a href="/estados/{uf}/">{e(b.ufs[uf]["nome"])}</a></td><td>{e(b.ufs[uf]["regiao"])}</td><td class="num">{fmt(n)}</td>'
                      f'<td class="num">{fmt_pct(pct(n, total))}</td><td class="num">{fmt(len({l["pessoa_id"] for l in ls if l["premiada"]}))}</td></tr>')
    ex = len({l["pessoa_id"] for l in b.autores if l["uf_nascimento"] == "EX"})
    sem = len({l["pessoa_id"] for l in b.autores if not l["uf_nascimento"]})
    corpo = f"""<article class="secao"><header class="secao-cab"><p class="sobretitulo">Estados</p><h1>Onde nasceram as pessoas-autoras</h1>
<p class="lead">UF de nascimento das {fmt(total)} pessoas-autoras nascidas no Brasil com dado conhecido. Outras {fmt(ex)} nasceram fora do Brasil e {fmt(sem)} não têm o dado.</p></header>
<div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Estado</th><th scope="col">Região</th><th class="num" scope="col">Pessoas-autoras</th><th class="num" scope="col">% do Brasil</th><th class="num" scope="col">Premiadas</th></tr></thead>
<tbody>{"".join(linhas)}</tbody></table></div>{NOTA}</article>"""
    return pagina("/estados/", "Estado de nascimento dos autores dos prêmios literários | Literadados",
                  "Em que estado nasceram as pessoas-autoras que chegam aos prêmios literários: número, parcela do Brasil e premiadas, por UF.",
                  corpo, [{"@context": "https://schema.org", "@type": "CollectionPage", "name": "Estados", "url": f"{SITE}/estados/", "inLanguage": "pt-BR"}],
                  [("Estados", "/estados/")], "/estados/")


# ---------- editoras (RF-29) ----------
def linhas_editora(b, nome):
    return [l for l in b.autores if l["editora"] == nome]


def contagem_editora(ls) -> dict:
    """Como metricas.perfilEditora: obra distinta por prêmio, ano e categoria, só autoria."""
    ind = {}
    for l in ls:
        ind.setdefault((l["premio"], l["ano"], l["nome_original"], l["obra_id"]), l)
    return {"indicacoes": len(ind), "premiadas": sum(bool(l["premiada"]) for l in ind.values()), "vencedoras": sum(bool(l["vencedora"]) for l in ind.values())}


def pagina_editora(b, eid, posicao, total_ed):
    ed = b.editoras[eid]
    ls = linhas_editora(b, ed["nome"])
    r, c = resumo(ls), contagem_editora(ls)
    anos = sorted({l["ano"] for l in ls})
    sede = "/".join(x for x in [ed["municipio_sede"], ed["uf_sede"]] if x)
    por_premio = []
    for p in b.premios:
        lp = [l for l in ls if l["premio"] == p["id"]]
        if lp:
            cp, ap = contagem_editora(lp), sorted({l["ano"] for l in lp})
            por_premio.append((p["nome"], cp, ap))
    obras = sorted(obras_de(b, [l for l in b.part if l["editora"] == ed["nome"]]), key=lambda o: (-o["ano"], o["premio"], ordem_cat(o["categoria"]), o["titulo"]))
    obras = [o for o in obras if o["autor"]]  # como as contagens: obra com autoria
    autores = Counter(l["pessoa_id"] for l in ls)
    linhas_t = "".join(f'<tr><td><a href="/premios/{o["premio"]}/{o["ano"]}/">{o["ano"]}</a></td><td>{e(b.nome_premio[o["premio"]])}</td><td>{e(o["nome_original"])}</td>'
                       f'<td><i>{e(o["titulo"])}</i>, de {nomes(b, o["autor"])}</td><td>{b.resultado(o)}</td></tr>' for o in obras)
    lead = (f"{e(ed['nome'])}{' (grupo ' + e(ed['grupo']) + ')' if ed['grupo'] else ', editora independente'}{', sede: ' + e(sede) if sede else ''}, "
            f"teve {fmt(c['indicacoes'])} indicaç{'ão' if c['indicacoes'] == 1 else 'ões'} nos prêmios da base entre {anos[0]} e {anos[-1]}: "
            f"{fmt(c['premiadas'])} premiada{'' if c['premiadas'] == 1 else 's'}, {fmt(c['vencedoras'])} em 1º lugar. É a {posicao}ª de {fmt(total_ed)} editoras em indicações.")
    corpo = f"""<article class="secao"><header class="secao-cab"><p class="sobretitulo">Editora</p><h1>{e(ed["nome"])}</h1>
<p class="lead">{lead}</p>
<p class="links-externos"><a class="chip-link" href="/#/editora/{quote(eid)}">Abrir no painel, com gráfico</a></p></header>
{kpis([(e(n), fmt(cp["indicacoes"]), f"indicações ({ap[0]}–{ap[-1]}); {fmt(cp['premiadas'])} premiadas, {fmt(cp['vencedoras'])} em 1º lugar") for n, cp, ap in por_premio])}
<h2>Quem a editora levou aos prêmios</h2>
{kpis_resumo(r)}
{NOTA}
<p>Mais indicações por esta editora: {", ".join(f"{lnk_pessoa(b, i)} ({n})" for i, n in sorted(autores.items(), key=lambda x: (-x[1], b.pessoas[x[0]]["nome"]))[:12])}.</p>
<h2>Obras</h2>
<div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Ano</th><th scope="col">Prêmio</th><th scope="col">Categoria</th><th scope="col">Obra</th><th scope="col">Resultado</th></tr></thead>
<tbody>{linhas_t}</tbody></table></div>
<p class="muted pequeno">Editora = a edição que concorreu (a mesma obra pode ter concorrido por editoras diferentes). Obras sem editora conhecida da época ficam fora.</p></article>"""
    org = {"@type": "Organization", "name": ed["nome"], "url": f"{SITE}/editoras/{quote(eid)}/"}
    if ed["grupo"]:
        org["parentOrganization"] = {"@type": "Organization", "name": ed["grupo"]}
    if sede:
        org["address"] = {"@type": "PostalAddress", **({"addressLocality": ed["municipio_sede"]} if ed["municipio_sede"] else {}),
                          **({"addressRegion": ed["uf_sede"], "addressCountry": "BR"} if ed["uf_sede"] and ed["uf_sede"] != "EX" else {})}
    ld = [{"@context": "https://schema.org", "@type": "AboutPage", "url": f"{SITE}/editoras/{quote(eid)}/", "inLanguage": "pt-BR", "mainEntity": org}]
    desc = (f"{ed['nome']} nos prêmios literários: {fmt(c['indicacoes'])} indicações, {fmt(c['premiadas'])} premiadas e {fmt(c['vencedoras'])} em 1º lugar "
            f"({anos[0]}–{anos[-1]}); obras, autores publicados e perfil de quem a editora levou à lista.")
    return pagina(f"/editoras/{quote(eid)}/", f"{ed['nome']} nos prêmios literários | Literadados", desc, corpo, ld,
                  [("Editoras", "/editoras/"), (ed["nome"], f"/editoras/{quote(eid)}/")], "/editoras/")


def ranking_editoras(b):
    cont = {eid: contagem_editora(linhas_editora(b, ed["nome"])) for eid, ed in b.editoras.items()}
    ids = sorted((i for i in cont if cont[i]["indicacoes"]), key=lambda i: (-cont[i]["indicacoes"], b.editoras[i]["nome"]))
    pos = {i: 1 + sum(cont[j]["indicacoes"] > cont[i]["indicacoes"] for j in ids) for i in ids}  # empate = mesma posição
    return ids, cont, pos


def pagina_editoras(b, ids, cont, pos):
    linhas = "".join(f'<tr><td class="num">{pos[i]}</td><td><a href="/editoras/{quote(i)}/">{e(b.editoras[i]["nome"])}</a></td><td>{e(b.editoras[i]["grupo"] or "independente")}</td>'
                     f'<td>{e("/".join(x for x in [b.editoras[i]["municipio_sede"], b.editoras[i]["uf_sede"]] if x) or "–")}</td>'
                     f'<td class="num">{fmt(cont[i]["indicacoes"])}</td><td class="num">{fmt(cont[i]["premiadas"])}</td><td class="num">{fmt(cont[i]["vencedoras"])}</td></tr>' for i in ids)
    sem = len({(l["premio"], l["ano"], l["nome_original"], l["obra_id"]) for l in b.autores if not l["editora"]})
    corpo = f"""<article class="secao"><header class="secao-cab"><p class="sobretitulo">Editoras</p><h1>Editoras nos prêmios literários</h1>
<p class="lead">As {fmt(len(ids))} editoras com obras indicadas, em ordem de indicações. {fmt(sem)} indicações não têm editora conhecida da época (comuns antes de 2000) e ficam fora.</p></header>
<div class="rolagem"><table class="tabela"><thead><tr><th class="num" scope="col">#</th><th scope="col">Editora</th><th scope="col">Grupo</th><th scope="col">Sede</th><th class="num" scope="col">Indicações</th><th class="num" scope="col">Premiadas</th><th class="num" scope="col">1º lugar</th></tr></thead>
<tbody>{linhas}</tbody></table></div></article>"""
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": "Editoras nos prêmios literários", "url": f"{SITE}/editoras/", "inLanguage": "pt-BR",
           "mainEntity": {"@type": "ItemList", "numberOfItems": len(ids), "itemListElement": [
               {"@type": "ListItem", "position": k + 1, "url": f"{SITE}/editoras/{quote(i)}/", "name": b.editoras[i]["nome"]} for k, i in enumerate(ids[:100])]}}]
    return pagina("/editoras/", "Editoras nos prêmios literários: indicações e premiadas | Literadados",
                  f"As {fmt(len(ids))} editoras com obras indicadas aos prêmios literários da base: indicações, premiadas, 1º lugares, grupo e sede.",
                  corpo, ld, [("Editoras", "/editoras/")], "/editoras/")


# ---------- perguntas frequentes (AEO) ----------
def perguntas(b):
    """(pergunta, resposta em HTML). Números calculados; texto puro do JSON-LD sai do HTML sem tags."""
    qs = []
    r = resumo(b.autores)
    ativos = [p for p in b.premios if b.anos(p["id"])]
    periodo = "; ".join(f"{p['nome']}, {b.anos(p['id'])[0]}–{b.anos(p['id'])[-1]} ({fmt(len(b.anos(p['id'])))} edições)" for p in ativos)
    por_pessoa = defaultdict(set)
    for l in b.autores:
        por_pessoa[l["pessoa_id"]].add(l["premio"])
    varios = sum(len(v) > 1 for v in por_pessoa.values())
    qs.append(("Quantas pessoas chegaram aos prêmios literários reunidos no Literadados?",
               f"{fmt(r['pessoas'])} pessoas-autoras, em {fmt(r['indicacoes'])} indicações: {e(periodo)}. {fmt(varios)} delas passaram por mais de um prêmio."))
    qs.append(("Qual a participação de mulheres nos prêmios literários?",
               f"Na base inteira, {fmt_pct(r['pctMulheres'])} das pessoas-autoras são mulheres ({fmt(r['mulheres'])} de {fmt(r['pessoas'])}). "
               + " ".join(f"No {e(p['nome'])}: {fmt_pct(x['pctMulheres'])} na lista ({fmt(x['mulheres'])} de {fmt(x['pessoas'])}) e {fmt_pct(v['pctMulheres'])} no 1º lugar ({fmt(v['mulheres'])} de {fmt(v['pessoas'])})."
                          for p in ativos for x, v in [(resumo(b.de(p["id"])), resumo([l for l in b.de(p["id"]) if l["vencedora"]]))])
               + (f" Para {fmt(r['generoAtribuido'])} pessoas, o gênero foi atribuído pelo primeiro nome, sem fonte." if r["generoAtribuido"] else "")))
    qs.append(("Quantos autores negros chegaram aos prêmios literários?",
               f"Pelo menos {fmt(r['negras'])} das {fmt(r['pessoas'])} pessoas-autoras ({fmt_pct(r['pctNegras'])}) se declararam publicamente negras, pretas ou pardas. "
               f"É um piso: {fmt(r['semDeclaracao'])} pessoas não têm autodeclaração pública encontrada, e isso não quer dizer que sejam brancas. "
               + " ".join(f"No {e(p['nome'])}: pelo menos {fmt(x['negras'])} de {fmt(x['pessoas'])}." for p in ativos for x in [resumo(b.de(p["id"]))])))
    for p in ativos:
        pid, nome = p["id"], p["nome"]
        rk = ranking(b.de(pid), 5)
        if rk and rk[0][1]:
            qs.append((f"Quem mais venceu o {nome}?",
                       f"Nas categorias do recorte, quem mais venceu (1º lugar) o {e(nome)} foi " + "; ".join(
                           f"{lnk_pessoa(b, i)} ({fmt(v)} vez{'es' if v > 1 else ''} em 1º lugar, {fmt(pr)} prêmio{'s' if pr > 1 else ''})" for i, v, pr, _ in rk if v) + "."))
        v = resumo([l for l in b.de(pid) if l["vencedora"]])
        pm = primeira_mulher(b, pid)
        qs.append((f"Quantas mulheres venceram o {nome}?",
                   f"{fmt(v['mulheres'])} das {fmt(v['pessoas'])} pessoas que venceram (1º lugar) o {e(nome)} nas categorias do recorte são mulheres ({fmt_pct(v['pctMulheres'])})."
                   + (f" A primeira vitória de uma mulher foi em {pm[0]}: " + "; ".join(f"{lnk_pessoa(b, l['pessoa_id'])}, em {e(l['nome_original'])}, com <i>{e(l['titulo'])}</i>" for l in pm[1]) + "." if pm else "")))
        ufs, com_uf = top_ufs([l for l in b.de(pid) if l["premiada"]])
        if ufs:
            qs.append((f"De que estados vêm os autores premiados no {nome}?",
                       f"Entre as {fmt(com_uf)} pessoas premiadas no {e(nome)} com UF de nascimento no Brasil, as que mais aparecem nasceram em "
                       + ", ".join(f'<a href="/estados/{u}/">{e(b.ufs[u]["nome"])}</a> ({fmt(n)}, {fmt_pct(pct(n, com_uf))})' for u, n in ufs) + "."))
        ultimo = b.anos(pid)[-1]
        vs = [o for o in obras_de(b, b.de(pid, ultimo, b.part)) if o["colocacao"] == 1]
        if vs:
            qs.append((f"Quem venceu o {nome} {ultimo}?",
                       f"No {e(nome)} {ultimo}, venceram (1º lugar): " + "; ".join(f"{e(o['nome_original'])}: {credito_obra(b, o)}" for o in sorted(vs, key=lambda o: ordem_cat(o["categoria"])))
                       + f'. <a href="/premios/{pid}/{ultimo}/">Veja a edição completa</a>.'))
        eds = Counter()
        for o in obras_de(b, b.de(pid, linhas=b.part)):
            if o["colocacao"] and o["editora"]:
                eds[o["editora"]] += 1
        if eds:
            qs.append((f"Quais editoras mais ganham o {nome}?",
                       f"Contando as obras premiadas no {e(nome)} com editora conhecida: " + ", ".join(f"{e(n)} ({fmt(k)})" for n, k in sorted(eds.items(), key=lambda x: (-x[1], x[0]))[:5])
                       + ". Obras premiadas sem editora conhecida da época (comuns antes de 2000) ficam fora da conta."))
    qs.append(("Como o Literadados sabe a raça de cada pessoa?",
               "Só por autodeclaração pública — entrevista, perfil, depoimento ou registro de candidatura no TSE — com link e trecho literal, ou por fonte curada por identidade. "
               "Nunca por foto, sobrenome ou inteligência artificial. Quem não tem declaração encontrada fica como \"sem declaração\", que não quer dizer branca."))
    qs.append(("Por que o número de pessoas negras é um \"piso\"?",
               "Porque conta só quem se declarou publicamente. Muitas pessoas nunca falaram disso em público, e pessoas brancas raramente se declaram; por isso o painel diz \"pelo menos\" e não calcula a porcentagem de brancos."))
    qs.append(("O estado de cada autor é o de nascimento ou o de residência?",
               "De nascimento (UF de nascimento), com fonte. Quem nasceu fora do Brasil aparece com o país de nascimento."))
    cats = sorted({l["categoria"] for l in b.part}, key=ordem_cat)
    qs.append(("Quais categorias dos prêmios entram no Literadados?",
               f"As literárias: {', '.join(cats)}. Categorias de não ficção, ilustração e outras ficam fora; organizadores de antologias são registrados, mas não entram nas contagens."))
    qs.append(("Como citar o Literadados?",
               f"SIMAS, Gustavo. <i>Literadados</i>: quem chega aos prêmios literários. {date.today().year}. Disponível em: {SITE}/. "
               'Os dados podem ser baixados em <a href="/dados-abertos/">Dados abertos</a>.'))
    return qs


def pagina_perguntas(b):
    qs = perguntas(b)
    corpo = ('<article class="secao"><header class="secao-cab"><p class="sobretitulo">Perguntas frequentes</p><h1>Perguntas e respostas sobre quem chega aos prêmios literários</h1>'
             '<p class="lead">Respostas curtas, com números calculados da base e o n de cada percentual.</p></header>'
             + "".join(f'<section class="pergunta"><h2>{e(q)}</h2><p>{a}</p></section>' for q, a in qs) + NOTA + "</article>")
    ld = [{"@context": "https://schema.org", "@type": "FAQPage", "url": f"{SITE}/perguntas/", "inLanguage": "pt-BR", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": html.unescape(re.sub(r"<[^>]+>", "", a))}} for q, a in qs]}]
    return pagina("/perguntas/", "Perguntas frequentes sobre prêmios literários e diversidade | Literadados",
                  "Quantas mulheres e pessoas negras venceram os prêmios literários, quem mais venceu, de que estados vêm os premiados: respostas com números e fontes.",
                  corpo, ld, [("Perguntas", "/perguntas/")], "/perguntas/"), qs


# ---------- dados abertos ----------
TABELAS_DOC = {
    "premio": "prêmios (organizador, ano de início, abrangência, fonte)", "edicao": "edições de cada prêmio, com o formato (regime) e a fonte",
    "edicao_contexto": "texto de contexto de cada edição, com fontes", "categoria_edicao": "categorias de cada edição: nome oficial, categoria padronizada, vagas, etapa",
    "indicacao": "cada obra em cada lista: finalista, colocação, editora da época, fonte", "obra": "livros", "autoria": "quem escreveu, ilustrou ou organizou cada obra, por prêmio",
    "pessoa": "pessoas: gênero, raça autodeclarada (com fonte e trecho), nascimento (com fonte), Wikidata", "editora": "editoras: grupo e sede",
    "jurado": "júri divulgado por edição e categoria", "pessoa_midia": "fotos livres do Wikimedia Commons e verbete da Wikipédia",
    "obra_capa": "capas (Open Library e Google Books)", "uf": "unidades da federação, região e população (Censo 2022)",
}


def pagina_dados(b, con):
    r = resumo(b.autores)
    anos = [a for _, a in b.com_dados]
    contagens = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in TABELAS_DOC}
    linhas = "".join(f'<tr><td><code>{t}</code></td><td>{e(d)}</td><td class="num">{fmt(contagens[t])}</td>'
                     f'<td><a href="/banco/{t}.parquet">Parquet</a> · <a href="{REPO}/blob/main/dados/{t}.csv">CSV</a></td></tr>' for t, d in TABELAS_DOC.items())
    nomes_p = " e ".join(p["nome"] for p in b.premios if b.anos(p["id"]))
    desc = (f"Base aberta sobre quem chega aos prêmios literários de língua portuguesa ({nomes_p}, {min(anos)}–{max(anos)}): "
            f"{fmt(r['pessoas'])} pessoas-autoras em {fmt(r['indicacoes'])} indicações, com gênero, raça autodeclarada e UF de nascimento, cada dado com fonte.")
    corpo = f"""<article class="secao"><header class="secao-cab"><p class="sobretitulo">Dados abertos</p><h1>Baixe e cite os dados do Literadados</h1>
<p class="lead">{e(desc)}</p></header>
<h2>Tabelas</h2>
<p>Os CSVs em <a href="{REPO}/tree/main/dados">dados/</a> são a fonte da verdade; o build gera o banco DuckDB, os Parquet abaixo e o painel. O esquema completo está em <a href="{REPO}/blob/main/schema.sql">schema.sql</a>.</p>
<div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Tabela</th><th scope="col">Conteúdo</th><th class="num" scope="col">Linhas</th><th scope="col">Baixar</th></tr></thead><tbody>{linhas}</tbody></table></div>
<h2>Regras de uso dos números</h2>
<ul><li>Raça só por autodeclaração pública, com link e trecho; o número de pessoas negras é um piso, e "sem declaração" não quer dizer branca.</li>
<li>Gênero com fonte; sem fonte, atribuído pelo primeiro nome e marcado (<code>genero_evidencia = 'atribuicao'</code>).</li>
<li>Estado = UF de nascimento. Mostre sempre o n junto do percentual. Compare edições em proporção (as vagas mudam).</li>
<li>Não some percentuais de prêmios diferentes: formatos e períodos diferem.</li></ul>
<h2>Como citar</h2>
<p>SIMAS, Gustavo. <i>Literadados</i>: quem chega aos prêmios literários. {date.today().year}. Disponível em: <a href="{SITE}/">{SITE}/</a>.</p>
<p class="muted pequeno">Correções, com fonte pública: <a href="mailto:contato@gustavosimas.com">contato@gustavosimas.com</a>. <a href="/metodo.html">Método e referências</a>.</p>
</article>"""
    ld = [{"@context": "https://schema.org", "@type": "Dataset", "name": "Literadados — quem chega aos prêmios literários", "description": desc,
           "url": f"{SITE}/dados-abertos/", "sameAs": REPO, "inLanguage": "pt-BR", "creator": AUTOR, "publisher": AUTOR, "isAccessibleForFree": True,
           "keywords": ["prêmios literários", "literatura brasileira", "literatura de língua portuguesa", "diversidade", "gênero", "raça", "autodeclaração", *[p["nome"] for p in b.premios]],
           "temporalCoverage": f"{min(anos)}/{max(anos)}", "spatialCoverage": {"@type": "Place", "name": "Brasil e países de língua portuguesa"},
           "variableMeasured": ["gênero", "raça autodeclarada", "UF de nascimento", "país de nascimento", "ano de nascimento", "categoria", "colocação", "editora"],
           "citation": f"SIMAS, Gustavo. Literadados: quem chega aos prêmios literários. Disponível em: {SITE}/.",
           "distribution": [{"@type": "DataDownload", "name": t, "encodingFormat": "application/vnd.apache.parquet", "contentUrl": f"{SITE}/banco/{t}.parquet"} for t in TABELAS_DOC]
           + [{"@type": "DataDownload", "name": f"{t}.csv", "encodingFormat": "text/csv", "contentUrl": f"https://raw.githubusercontent.com/GSimas/Literadados/main/dados/{t}.csv"} for t in TABELAS_DOC]}]
    return pagina("/dados-abertos/", "Dados abertos: prêmios literários, gênero, raça e origem dos autores | Literadados", desc[:300], corpo, ld, [("Dados abertos", "/dados-abertos/")], "/dados-abertos/")


# ---------- textos para IAs (llms.txt) ----------
def llms(b, qs):
    r = resumo(b.autores)
    ativos = [p for p in b.premios if b.anos(p["id"])]
    s = [f"# Literadados", "",
         f"> Dados abertos sobre quem chega aos prêmios literários de língua portuguesa ({', '.join(p['nome'] for p in ativos)}): gênero, raça autodeclarada e UF de nascimento "
         f"de {fmt(r['pessoas'])} pessoas-autoras em {fmt(r['indicacoes'])} indicações, cada dado com fonte. Painel interativo, perfis e uma IA (Diadorim) que consulta a base.", "",
         "Regras para citar os números: raça só por autodeclaração pública (o número de pessoas negras é um piso, \"pelo menos\"; \"sem declaração\" não quer dizer branca); "
         "gênero sem fonte é atribuído pelo primeiro nome e marcado; estado = UF de nascimento; todo percentual vem com o n; não some percentuais de prêmios diferentes.", "",
         "## Números principais", ""]
    s += [f"- Base inteira: {fmt(r['pessoas'])} pessoas-autoras; {fmt_pct(r['pctMulheres'])} mulheres ({fmt(r['mulheres'])}); pelo menos {fmt(r['negras'])} pessoas negras ({fmt_pct(r['pctNegras'])})."]
    for p in ativos:
        x = resumo(b.de(p["id"]))
        v = resumo([l for l in b.de(p["id"]) if l["vencedora"]])
        a = b.anos(p["id"])
        s.append(f"- {p['nome']} ({a[0]}–{a[-1]}, {fmt(len(a))} edições): {fmt(x['pessoas'])} pessoas-autoras; mulheres {fmt_pct(x['pctMulheres'])} na lista "
                 f"({fmt(x['mulheres'])} de {fmt(x['pessoas'])}) e {fmt_pct(v['pctMulheres'])} no 1º lugar ({fmt(v['mulheres'])} de {fmt(v['pessoas'])}); pelo menos {fmt(x['negras'])} pessoas negras.")
    s += ["", "## Páginas", "",
          f"- [Perguntas frequentes]({SITE}/perguntas/): respostas curtas com números e n",
          f"- [Prêmios]({SITE}/premios/): cada prêmio e cada edição, com vencedores, indicados e contexto histórico",
          f"- [Pessoas de A a Z]({SITE}/pessoas/): perfil de cada pessoa, com fontes",
          f"- [Estados]({SITE}/estados/): onde nasceram as pessoas-autoras",
          f"- [Editoras]({SITE}/editoras/): cada editora, com indicações, premiadas e autores publicados",
          f"- [Dados abertos]({SITE}/dados-abertos/): tabelas (Parquet e CSV), regras de uso e como citar",
          f"- [Método]({SITE}/metodo.html): fontes, definições, protocolo de raça, cobertura", "", "## Prêmios", ""]
    s += [f"- [{p['nome']}]({SITE}/premios/{p['id']}/)" for p in ativos]
    s += ["", "## Optional", "", f"- [Texto completo: premiadas de cada edição e contexto]({SITE}/llms-full.txt)",
          f"- [Painel interativo]({SITE}/): gráficos, filtros e a Diadorim", ""]
    full = ["# Literadados — texto completo", "", s[2], "", s[4], ""]
    full += ["## Perguntas frequentes", ""]
    for q, a in qs:
        full += [f"### {q}", "", html.unescape(re.sub(r"<[^>]+>", "", a)), ""]
    for p in ativos:
        full += [f"## {p['nome']}", "", f"Organizador: {p['organizador']}. Página: {SITE}/premios/{p['id']}/", ""]
        for a in b.anos(p["id"]):
            ed = b.edicao[(p["id"], a)]
            x = resumo(b.de(p["id"], a))
            full += [f"### {p['nome']} {a}", "", f"Formato: {ed['regime']}. {fmt(x['pessoas'])} pessoas-autoras; {fmt_pct(x['pctMulheres'])} mulheres ({fmt(x['mulheres'])}); "
                     f"pelo menos {fmt(x['negras'])} pessoas negras. Página: {SITE}/premios/{p['id']}/{a}/", ""]
            ctx = b.contexto.get((p["id"], a))
            if ctx:
                full += [" ".join(t.split()) for t in re.split(r"\n\s*\n", ctx["texto"]) if t.strip()] + [f"Fontes: {ctx['fontes']}", ""]
            for o in sorted((o for o in obras_de(b, b.de(p["id"], a, b.part)) if o["colocacao"]), key=lambda o: (ordem_cat(o["categoria"]), o["nome_original"], o["colocacao"])):
                full.append(f"- {o['nome_original']}, {o['colocacao']}º lugar: {texto_obra(b, o)}")
            full.append("")
    return "\n".join(s), "\n".join(full)


# ---------- gravação ----------
def _sitemap_antigo(web: Path) -> dict:
    arq = web / "sitemap.xml"
    if not arq.exists():
        return {}
    return dict(re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", arq.read_text(encoding="utf-8")))


def _abertura(web: Path, r: dict):
    """Números reais no esqueleto da abertura (CA-27.6): robôs sem JavaScript leem os mesmos números do painel."""
    idx = web / "index.html"
    if not idx.exists():
        return
    neg = None if r["pctNegras"] is None else round(r["pctNegras"] * 10) / 10
    trecho = (f'<!-- build:numeros -->\n'
              f'        <div class="hero-num esqueleto" aria-hidden="true"><b>{fmt(r["pessoas"])}</b><span>pessoas-autoras em {fmt(r["indicacoes"])} indicações</span></div>\n'
              f'        <div class="hero-num esqueleto" aria-hidden="true"><b>{fmt_pct(r["pctMulheres"])}</b><span>são mulheres ({fmt(r["mulheres"])})</span></div>\n'
              f'        <div class="hero-num esqueleto" aria-hidden="true"><b>≥ {fmt_pct(neg)}</b><span>se declararam negras (piso: {fmt(r["negras"])})</span></div>\n'
              f'        <!-- /build:numeros -->')
    s = idx.read_text(encoding="utf-8")
    novo = re.sub(r"<!-- build:numeros -->.*?<!-- /build:numeros -->", lambda _: trecho, s, flags=re.S)
    if novo != s:
        idx.write_text(novo, encoding="utf-8")


def gerar(con, web: Path) -> dict:
    """Gera tudo em web/. Devolve {caminho relativo: html} das páginas (os testes leem daqui)."""
    b = Base(con)
    paginas = {}
    for p in b.premios:
        if b.anos(p["id"]):
            paginas[f"premios/{p['id']}/index.html"] = pagina_premio(b, p)
    for premio, ano in b.com_dados:
        paginas[f"premios/{premio}/{ano}/index.html"] = pagina_edicao(b, premio, ano)
    paginas["premios/index.html"] = pagina_premios(b)
    for pid in b.ids:
        paginas[f"pessoas/{pid}/index.html"] = pagina_pessoa(b, pid)
    paginas["pessoas/index.html"] = pagina_pessoas(b)
    ufs = sorted({l["uf_nascimento"] for l in b.autores if l["uf_nascimento"] in b.ufs})
    for uf in ufs:
        paginas[f"estados/{uf}/index.html"] = pagina_estado(b, uf)
    paginas["estados/index.html"] = pagina_estados(b, ufs)
    ids_ed, cont_ed, pos_ed = ranking_editoras(b)
    for eid in ids_ed:
        paginas[f"editoras/{eid}/index.html"] = pagina_editora(b, eid, pos_ed[eid], len(ids_ed))
    paginas["editoras/index.html"] = pagina_editoras(b, ids_ed, cont_ed, pos_ed)
    paginas["perguntas/index.html"], qs = pagina_perguntas(b)
    paginas["dados-abertos/index.html"] = pagina_dados(b, con)

    antigo, hoje, mudou = _sitemap_antigo(web), date.today().isoformat(), set()
    for rel, conteudo in paginas.items():
        arq = web / rel
        if arq.exists() and arq.read_text(encoding="utf-8") == conteudo:
            continue
        arq.parent.mkdir(parents=True, exist_ok=True)
        arq.write_text(conteudo, encoding="utf-8")
        mudou.add(rel)
    # O que saiu da base sai do site (pessoa unificada, edição removida).
    for pasta in PASTAS:
        for arq in sorted((web / pasta).rglob("*"), reverse=True) if (web / pasta).exists() else []:
            rel = arq.relative_to(web).as_posix()
            if arq.is_file() and arq.name == "index.html" and rel not in paginas:  # só o que o próprio gerador escreve
                arq.unlink()
            elif arq.is_dir() and not any(arq.iterdir()):
                arq.rmdir()

    urls = [(f"{SITE}/", None), (f"{SITE}/metodo.html", None)]
    for rel in sorted(paginas):
        loc = f"{SITE}/{rel.removesuffix('index.html')}"
        urls.append((loc, hoje if rel in mudou or loc not in antigo else antigo[loc]))
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               + "".join(f"  <url><loc>{e(u)}</loc>{f'<lastmod>{d}</lastmod>' if d else ''}</url>\n" for u, d in urls) + "</urlset>\n")
    curto, completo = llms(b, qs)
    for nome, txt in [("sitemap.xml", sitemap), ("llms.txt", curto + "\n"), ("llms-full.txt", completo + "\n")]:
        arq = web / nome
        if not arq.exists() or arq.read_text(encoding="utf-8") != txt:
            arq.write_text(txt, encoding="utf-8")
    _abertura(web, resumo(b.autores))
    return paginas
