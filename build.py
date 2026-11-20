"""CSVs de dados/ → literadados.duckdb + web/dados.json, com checagens (spec RF-01)."""
import json
import os
import re
import sys
from urllib.parse import urlsplit
from datetime import datetime, timezone
from pathlib import Path

import duckdb

import seo

RAIZ = Path(__file__).parent
TABELAS = ["territorio", "municipio_casamento", "indicador", "recorte", "indicador_valor", "premio", "edicao", "edicao_contexto", "editora", "editora_logo", "pessoa", "pessoa_midia", "pessoa_foto", "obra", "obra_capa", "autoria",
           "categoria_edicao", "indicacao", "jurado", "distincao",
           "livraria", "clube", "obra_mapeada", "editora_mapeada", "pessoa_atuacao", "mapeamento_autoria"]  # ordem das FKs


class BuildError(Exception):
    pass


def _linhas(con, sql, params=None):
    cur = con.execute(sql, params or [])
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def _sem_nulos(linhas):
    """Tira chaves nulas (o navegador lê campo ausente como null): mantém o dados.json abaixo de 1 MB (RNF-06)."""
    return [{k: v for k, v in l.items() if v is not None} for l in linhas]


def carregar(con, dados: Path):
    con.execute((RAIZ / "schema.sql").read_text(encoding="utf-8"))
    pop = dados / "uf_populacao.csv"
    if pop.exists():
        con.execute(f"UPDATE uf SET populacao_2022 = p.populacao_2022 FROM read_csv('{pop}') p WHERE uf.uf = p.uf")
    for t in TABELAS:
        csv = dados / f"{t}.csv"
        # Valores de indicador (D39): um CSV por indicador em dados/indicador_valor/ (cada coleta reescreve só o seu).
        if t == "indicador_valor" and any((dados / t).glob("*.csv")):
            csv = dados / t / "*.csv"
        elif not csv.exists():
            continue
        try:
            # all_varchar: o DuckDB converte para o tipo da coluna no INSERT; evita inferência errada em colunas quase vazias
            con.execute(f"INSERT INTO {t} BY NAME SELECT * FROM read_csv('{csv}', all_varchar=true, header=true, union_by_name=true)")
        except duckdb.Error as e:
            raise BuildError(f"dados/{t if '*' not in str(csv) else t + '/'}.csv: {e}".replace("/.csv", "/*.csv")) from None


def checar(con):
    """Erros de consistência das edições coletadas (CA-01.3). Edição sem indicação = não coletada."""
    erros = []
    # Edição fora da vida do prêmio (antes da 1ª edição ou no futuro): o CHECK não lê outra tabela, então fica aqui (D31).
    for r in _linhas(con, """SELECT e.premio_id, e.ano FROM edicao e JOIN premio p ON p.id = e.premio_id
                              WHERE e.ano < p.ano_inicio OR e.ano > ? ORDER BY ALL""", [datetime.now().year]):
        erros.append(f"{r['premio_id']} {r['ano']}: edição fora do período do prêmio")
    for r in _linhas(con, """
        SELECT c.premio_id, c.ano, c.nome_original, c.vagas_lista, c.vagas_curta, c.vagas_premio,
               COUNT(i.obra_id) AS n, SUM(i.lista_curta) AS n_curta, COUNT(i.colocacao) AS n_premio
        FROM categoria_edicao c LEFT JOIN indicacao i USING (premio_id, ano, nome_original)
        WHERE (c.premio_id, c.ano) IN (SELECT DISTINCT premio_id, ano FROM indicacao) AND c.categoria <> 'Conjunto da obra'
        GROUP BY ALL ORDER BY c.premio_id, c.ano, c.nome_original"""):
        rotulo = f"{r['premio_id']} {r['ano']} {r['nome_original']}"
        if r["vagas_lista"] is not None and r["n"] != r["vagas_lista"]:
            erros.append(f"{rotulo}: lista tem {r['n']} obras, esperado {r['vagas_lista']}")
        if r["vagas_curta"] is not None and (r["n_curta"] or 0) != r["vagas_curta"]:
            erros.append(f"{rotulo}: {r['n_curta'] or 0} finalistas, esperado {r['vagas_curta']}")
        if r["n_premio"] != r["vagas_premio"]:
            erros.append(f"{rotulo}: {r['n_premio']} premiadas, esperado {r['vagas_premio']}")
    # Conjunto da obra (RF-30, CA-30.1): só distinção, nunca indicação de livro, e o número de premiados bate com as vagas.
    for r in _linhas(con, """
        SELECT c.premio_id, c.ano, c.nome_original, c.vagas_premio, COUNT(d.pessoa_id) AS n,
               (SELECT COUNT(*) FROM indicacao i WHERE (i.premio_id, i.ano, i.nome_original) = (c.premio_id, c.ano, c.nome_original)) AS livros
        FROM categoria_edicao c LEFT JOIN distincao d USING (premio_id, ano, nome_original)
        WHERE c.categoria = 'Conjunto da obra' GROUP BY ALL ORDER BY ALL"""):
        rotulo = f"{r['premio_id']} {r['ano']} {r['nome_original']}"
        if r["livros"]:
            erros.append(f"{rotulo}: conjunto da obra com {r['livros']} indicação(ões) de livro")
        if r["n"] != r["vagas_premio"]:
            erros.append(f"{rotulo}: {r['n']} distinções, esperado {r['vagas_premio']}")
    for r in _linhas(con, """SELECT d.premio_id, d.ano, d.nome_original FROM distincao d JOIN categoria_edicao c USING (premio_id, ano, nome_original)
                              WHERE c.categoria <> 'Conjunto da obra' ORDER BY ALL"""):
        erros.append(f"{r['premio_id']} {r['ano']} {r['nome_original']}: distinção fora de uma categoria de conjunto da obra")
    # Antologia creditada só ao organizador é válida (design D14); obra sem nenhum dos dois, não.
    for r in _linhas(con, """SELECT id FROM obra WHERE id NOT IN (SELECT obra_id FROM autoria WHERE papel IN ('autor', 'organizador')
                                                          UNION SELECT obra_id FROM mapeamento_autoria WHERE papel IN ('autor', 'organizador'))"""):
        erros.append(f"obra sem autor nem organizador: {r['id']}")
    # Nome de editora é a chave do perfil de editora no painel (D33): dois ids com o mesmo nome = duplicata a unificar.
    for r in _linhas(con, "SELECT nome, string_agg(id, ', ' ORDER BY id) AS ids FROM editora GROUP BY nome HAVING COUNT(*) > 1 ORDER BY nome"):
        erros.append(f"editora com nome repetido: {r['nome']} ({r['ids']}); unifique por canonico em dados/coleta/editoras_enriquecidas.csv")
    # Texto de edição (CA-28.3): toda fonte é uma URL; a FK já recusa edição inexistente.
    for r in _linhas(con, "SELECT premio_id, ano, fontes FROM edicao_contexto ORDER BY ALL"):
        if any(not u.strip().startswith("http") for u in r["fontes"].split(" ; ")):
            erros.append(f"{r['premio_id']} {r['ano']}: texto de contexto com fonte que não é URL")
    # Território (CA-32.1, D38): 27 UFs, 5 regiões, todo município numa UF; a tabela uf do módulo Prêmios bate com territorio.
    if con.execute("SELECT COUNT(*) FROM territorio").fetchone()[0]:
        n = dict(con.execute("SELECT tipo, COUNT(*) FROM territorio GROUP BY tipo").fetchall())
        if n.get("uf") != 27 or n.get("regiao") != 5 or n.get("pais") != 1:
            erros.append(f"territorio: esperado 1 país, 5 regiões e 27 UFs; veio {n}")
        for (c,) in con.execute("""SELECT m.codigo FROM territorio m LEFT JOIN territorio u ON u.codigo = m.pai
                                   WHERE m.tipo <> 'pais' AND (u.codigo IS NULL OR u.tipo <> CASE m.tipo WHEN 'municipio' THEN 'uf' WHEN 'uf' THEN 'regiao' ELSE 'pais' END)
                                   ORDER BY 1""").fetchall():
            erros.append(f"territorio {c}: nível acima inexistente ou errado")
        for r in _linhas(con, """SELECT u.uf, u.nome, u.regiao, u.populacao_2022, t.nome AS t_nome, r.nome AS t_regiao, t.populacao_2022 AS t_pop
                                 FROM uf u LEFT JOIN territorio t ON t.tipo = 'uf' AND t.sigla = u.uf LEFT JOIN territorio r ON r.codigo = t.pai
                                 WHERE u.uf <> 'EX' ORDER BY u.uf"""):
            if (r["nome"], r["regiao"]) != (r["t_nome"], r["t_regiao"]) or (r["populacao_2022"] and r["populacao_2022"] != r["t_pop"]):
                erros.append(f"uf {r['uf']}: difere de territorio ({r['nome']}/{r['regiao']}/{r['populacao_2022']} × {r['t_nome']}/{r['t_regiao']}/{r['t_pop']})")
    # Leitura (CA-33.1, D39): percentual entre 0 e 100; amostral com amostra; censo e registro em % com numerador e denominador;
    # território no máximo tão fino quanto o nível do indicador.
    for r in _linhas(con, """
        SELECT v.indicador_id, v.territorio, v.ano, v.dimensao, v.categoria, v.valor, v.amostra, v.numerador, v.denominador,
               i.unidade, i.tipo_fonte, i.nivel, t.tipo AS ttipo
        FROM indicador_valor v JOIN indicador i ON i.id = v.indicador_id JOIN territorio t ON t.codigo = v.territorio
        WHERE (i.unidade = 'percentual' AND (v.valor < 0 OR v.valor > 100))
           OR (i.tipo_fonte = 'pesquisa_amostral' AND v.amostra IS NULL)
           OR (i.tipo_fonte <> 'pesquisa_amostral' AND i.unidade = 'percentual' AND NOT v.suprimido AND (v.numerador IS NULL OR v.denominador IS NULL))
           OR (list_position(['pais', 'regiao', 'uf', 'municipio'], t.tipo) > list_position(['brasil', 'regiao', 'uf', 'municipio'], i.nivel))
        ORDER BY ALL LIMIT 20"""):
        rot = f"indicador {r['indicador_id']} {r['territorio']} {r['ano']} {r['dimensao']}/{r['categoria']}"
        if r["unidade"] == "percentual" and r["valor"] is not None and not 0 <= r["valor"] <= 100:
            erros.append(f"{rot}: percentual fora de 0–100 ({r['valor']})")
        elif r["tipo_fonte"] == "pesquisa_amostral" and r["amostra"] is None:
            erros.append(f"{rot}: pesquisa amostral sem amostra")
        elif r["numerador"] is None or r["denominador"] is None:
            erros.append(f"{rot}: percentual de {r['tipo_fonte']} sem numerador e denominador")
        else:
            erros.append(f"{rot}: território ({r['ttipo']}) mais fino que o nível do indicador ({r['nivel']})")
    # Mapeamento (CA-34.2, D40): verificação não pode ser no futuro; clube numa livraria fica no município dela.
    hoje = datetime.now().date().isoformat()
    for t in ("livraria", "clube", "obra_mapeada", "editora_mapeada", "pessoa_atuacao"):
        for (n,) in con.execute(f"SELECT COUNT(*) FROM {t} WHERE verificado_em > ?::DATE", [hoje]).fetchall():
            if n:
                erros.append(f"{t}: {n} registro(s) com verificado_em no futuro")
    for r in _linhas(con, "SELECT c.id FROM clube c JOIN livraria l ON l.id = c.livraria_id WHERE l.municipio <> c.municipio ORDER BY 1"):
        erros.append(f"clube {r['id']}: livraria de outro município")
    # Colocação repetida é legítima (empates: Livro do Ano Não Ficção 2016, 3º lugar de Contos 2014);
    # o total de premiadas já é conferido contra vagas_premio acima.
    if erros:
        raise BuildError("checagens falharam:\n  " + "\n  ".join(erros))


GRUPOS_FONTE = [  # (regex do domínio, grupo) — a primeira que casar vale (RF-18)
    (r"premiojabuti\.com\.br$|cbl\.org\.br$", "Prêmio Jabuti e CBL"),
    (r"web\.archive\.org$", "Arquivo da web (Wayback Machine)"),
    (r"wikidata\.org$|wikipedia\.org$|wikimedia\.org$", "Wikidata e Wikipédia"),
    (r"letras\.ufmg\.br$", "Literafro (UFMG)"),
    (r"tse\.jus\.br$", "Registro de candidaturas (TSE)"),
    (r"itaucultural\.org\.br$", "Enciclopédia Itaú Cultural"),
    (r"publishnews|globo\.com$|folha|estadao|uol\.com\.br$|terra\.com\.br$|brasildefato|cartacapital|cnn|gazeta|opovo|otempo"
     r"|diario|nsctotal|almapreta|diplomatique|outraspalavras|correio|veja|piaui|metropoles|bbc|elpais|nexojornal|ebc\.com\.br$"
     r"|gauchazh|bemparana|uai\.com\.br$|jornal|revista|noticias|news|radio|tv", "Imprensa"),
    (r"\.edu\.br$|unirio|ufmg|usp\.br$|unicamp|ufsc|ufrgs|uel\.br$|unb\.br$|scielo|periodicos|dialnet|\.ac\.|academia\.edu$", "Universidades e periódicos"),
    (r"editora|livraria|livros|martinsfontes|companhiadasletras|record\.com\.br$|skoob|estantevirtual|travessa|amazon|books"
     r"|panda|sesi|quindim|touche|pulodogato|rocco|intrinseca|moderna|ftd|smeducacao|cepe|peiropolis|prosanova|piu", "Editoras e livrarias"),
]


def fontes(con) -> list[dict]:
    """URLs de todas as fontes da base, contadas por domínio e agrupadas (RF-18)."""
    urls = []
    for sql in ["SELECT fonte FROM premio", "SELECT fonte FROM edicao",
                "SELECT fonte FROM indicacao", "SELECT fonte FROM categoria_edicao", "SELECT fonte FROM jurado", "SELECT fonte FROM distincao",
                "SELECT genero_fonte FROM pessoa", "SELECT raca_fonte FROM pessoa", "SELECT nascimento_fonte FROM pessoa"]:
        for (v,) in con.execute(sql).fetchall():
            urls += [u.strip() for u in (v or "").split(" ; ") if u.strip().startswith("http")]
    # Domínio do site de cada prêmio vira o grupo do próprio prêmio (RF-18, D31), antes das regras fixas; o prêmio cujo
    # domínio já tem grupo fixo (premiojabuti.com.br → "Prêmio Jabuti e CBL") fica com ele.
    dominio = lambda u: (urlsplit(u).hostname or "").removeprefix("www.")
    grupos = [(rf"(^|\.){re.escape(dominio(f))}$", n) for n, f in con.execute("SELECT nome, fonte FROM premio ORDER BY ordem").fetchall()
              if dominio(f) and not any(re.search(rx, dominio(f)) for rx, _ in GRUPOS_FONTE)] + GRUPOS_FONTE
    por = {}
    for u in urls:
        dom = urlsplit(u).hostname or ""
        dom = dom.removeprefix("www.")
        if not dom:
            continue
        r = por.setdefault(dom, {"dominio": dom, "registros": 0, "exemplo": u})
        r["registros"] += 1
    for r in por.values():
        r["grupo"] = next((g for rx, g in grupos if re.search(rx, r["dominio"])), "Outros")
    return sorted(por.values(), key=lambda r: (-r["registros"], r["dominio"]))


def _fontes_wd(pessoas):
    """Fonte igual à página do Wikidata da própria pessoa vira "wd" (RNF-06); metricas.expandir remonta a URL."""
    for p in pessoas:
        url = f"https://www.wikidata.org/wiki/{p.get('wikidata')}"
        for k in ("genero_fonte", "nascimento_fonte", "raca_fonte"):
            if p.get("wikidata") and p.get(k) == url:
                p[k] = "wd"
    return pessoas


# Sites de capa com URL previsível (D34): no capas.json vai só o resto da URL e da página; pessoas.urlsCapa remonta.
SITES_CAPA = {
    "mf": {"nome": "Martins Fontes", "url": "https://martinsfontespaulista.vteximg.com.br/arquivos/ids/", "pagina": "https://www.martinsfontespaulista.com.br/"},
    "cl": {"nome": "Companhia das Letras", "url": "https://ciadasletras.vteximg.com.br/arquivos/ids/", "pagina": "https://www.companhiadasletras.com.br/"},
    "ev": {"nome": "Estante Virtual", "url": "https://static.estantevirtual.com.br/book/", "pagina": "https://www.estantevirtual.com.br/livro/"},
}


def _capa_compacta(c: dict) -> dict:
    """Capa no capas.json só com fonte e ids (RNF-06); o navegador remonta as URLs (pessoas.urlsCapa). Formato fora do padrão vai inteiro."""
    import re
    for k, s in SITES_CAPA.items():
        if c["fonte"] == s["nome"] and c["capa_url"].startswith(s["url"]) and (c["pagina"] or "").startswith(s["pagina"]):
            return {"obra_id": c["obra_id"], "f": k, "i": c["capa_url"][len(s["url"]):], "p": c["pagina"][len(s["pagina"]):]}
    if c["fonte"] == "open_library":
        m, p = re.search(r"/b/id/(\d+)-M\.jpg$", c["capa_url"]), re.search(r"/(books|works)/(OL\w+)$", c["pagina"] or "")
        if m and p:
            return {"obra_id": c["obra_id"], "f": "ol", "i": m.group(1), "p": p.group(2)}
    if c["fonte"] == "google_books":
        m = re.search(r"[?&]id=([\w-]+)", c["capa_url"])
        if m:
            return {"obra_id": c["obra_id"], "f": "gb", "i": m.group(1)}
    return {"obra_id": c["obra_id"], "url": c["capa_url"], "fonte": c["fonte"], "pagina": c["pagina"]}


def _tem_miniatura(pessoa_id: str) -> bool:
    return all((RAIZ / "web" / "fotos" / f"{pessoa_id}-{w}.webp").exists() for w in (160, 480))


def exportar(con) -> dict:
    anos_coletados = [r["ano"] for r in _linhas(con, "SELECT DISTINCT ano FROM indicacao ORDER BY ano")]
    # Prêmios com indicação de livro (o painel por livro); os que só têm conjunto da obra vão à parte (RF-30, CA-30.2).
    so_distincao = "id NOT IN (SELECT premio_id FROM indicacao) AND id IN (SELECT premio_id FROM distincao)"
    premios = _linhas(con, f"SELECT * EXCLUDE (fonte, ordem) FROM premio WHERE NOT ({so_distincao}) ORDER BY ordem")
    premios_distincao = _linhas(con, f"SELECT * EXCLUDE (fonte, ordem) FROM premio WHERE {so_distincao} ORDER BY ordem")
    LIVRO = "categoria <> 'Conjunto da obra'"
    padrao = [premios[0]["id"]] if premios else [None]  # 1º da ordem: no JSON, `premio` só aparece quando é outro (economia; o painel abre com todos, DA-4)
    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "anos": [min(anos_coletados), max(anos_coletados)],  # série completa: toda parte do painel abre nela (CA-25.2, D30)
        "anos_coletados": anos_coletados,
        "premios": premios,
        "premios_distincao": premios_distincao,
        # Participação compacta (design D13): atributos de pessoa e obra ficam uma vez em pessoas/obras/editoras,
        # e o navegador remonta as linhas de v_participacao com metricas.expandir.
        "edicoes": _sem_nulos(_linhas(con, f"""SELECT NULLIF(premio_id, ?) AS premio, ano, regime, obras FROM edicao
                                              WHERE (premio_id, ano) IN (SELECT premio_id, ano FROM categoria_edicao WHERE {LIVRO})
                                              ORDER BY premio_id, ano""", padrao)),
        # Editora da indicação (CA-26.6), compacta: ausente = a mesma de obras[].editora_id; "" = sem editora conhecida
        # nesta indicação, embora a obra tenha uma; outro valor = a edição que concorreu.
        "participacao": _sem_nulos(_linhas(con, """SELECT NULLIF(v.premio, ?) AS premio, v.ano, v.nome_original, v.obra_id, v.pessoa_id,
                                               NULLIF(v.papel, 'autor') AS papel, v.lista_curta, v.colocacao,
                                               CASE WHEN i.editora_id IS NOT DISTINCT FROM o.editora_id THEN NULL
                                                    WHEN i.editora_id IS NULL THEN '' ELSE i.editora_id END AS editora_id
                                        FROM v_participacao v JOIN indicacao i
                                          ON i.premio_id = v.premio AND i.ano = v.ano AND i.nome_original = v.nome_original AND i.obra_id = v.obra_id
                                        JOIN obra o ON o.id = v.obra_id
                                        ORDER BY v.premio, v.ano, v.categoria, v.obra_id, v.papel, v.pessoa_id""", padrao)),
        "obras": _sem_nulos(_linhas(con, """SELECT id, titulo, ano_publicacao, editora_id FROM obra
                                 WHERE id IN (SELECT obra_id FROM indicacao) ORDER BY id""")),
        "pessoas": _fontes_wd(_sem_nulos(_linhas(con, """SELECT id, nome, wikidata, genero, genero_fonte, genero_evidencia, raca,
                                          raca IN ('preta','parda','negra') AS negra, raca_evidencia, raca_fonte,
                                          raca_trecho, raca_busca, ano_nascimento, municipio_nascimento, uf_nascimento,
                                          pais_nascimento, nascimento_fonte FROM pessoa ORDER BY nome"""))),
        "jurados": _sem_nulos(_linhas(con, f"""SELECT NULLIF(j.premio_id, ?) AS premio, j.ano, c.categoria, j.pessoa_id FROM jurado j
                                   JOIN categoria_edicao c USING (premio_id, ano, nome_original) WHERE {LIVRO}
                                   ORDER BY j.premio_id, j.ano, c.categoria, j.pessoa_id""", padrao)),
        "categorias": _sem_nulos(_linhas(con, f"""SELECT NULLIF(premio_id, ?) AS premio, * EXCLUDE (premio_id, fonte) FROM categoria_edicao
                                                 WHERE {LIVRO} ORDER BY premio_id, ano, categoria, nome_original""", padrao)),
        # Conjunto da obra (RF-30, D36): fora de participacao; o júri vai junto de cada distinção.
        "distincoes": [{k: v for k, v in d.items() if v is not None and v != []} for d in _linhas(con, """
                       SELECT NULLIF(d.premio_id, ?) AS premio, d.ano, d.nome_original, d.pessoa_id,
                              split_part(d.fonte, ' ; ', 1) AS fonte,
                              list(j.pessoa_id ORDER BY j.pessoa_id) FILTER (WHERE j.pessoa_id IS NOT NULL) AS juri
                       FROM distincao d LEFT JOIN jurado j USING (premio_id, ano, nome_original)
                       GROUP BY d.premio_id, d.ano, d.nome_original, d.pessoa_id, d.fonte ORDER BY d.premio_id, d.ano, d.pessoa_id""", padrao)],
        "editoras": _linhas(con, "SELECT * FROM editora ORDER BY nome"),
        "ufs": _linhas(con, "SELECT * FROM uf ORDER BY uf"),
        "cobertura": _sem_nulos(_linhas(con, "SELECT NULLIF(premio, ?) AS premio, * EXCLUDE (premio) FROM v_cobertura ORDER BY v_cobertura.premio, ano", padrao)),
        # Só campos preenchidos; o crédito da foto aponta para a página do arquivo no Commons (licença e autoria completas lá).
        # miniatura: há web/fotos/<id>-160.webp e -480.webp (coleta.py miniaturas); sem ela, o site busca a foto no Commons.
        # foto_*: foto com direitos reservados, exibida da fonte (D34), só para quem não tem foto livre.
        "midia": [{k: v for k, v in m.items() if v is not None} | ({"miniatura": True} if m["imagem"] and _tem_miniatura(m["pessoa_id"]) else {})
                  for m in _linhas(con, """
                  SELECT COALESCE(m.pessoa_id, f.pessoa_id) AS pessoa_id, m.imagem, m.imagem_autor, m.imagem_licenca, m.wikipedia_pt,
                         CASE WHEN m.imagem IS NULL THEN f.foto_url END AS foto_url,
                         CASE WHEN m.imagem IS NULL THEN f.pagina END AS foto_pagina,
                         CASE WHEN m.imagem IS NULL THEN f.fonte END AS foto_fonte
                  FROM pessoa_midia m FULL JOIN pessoa_foto f USING (pessoa_id) ORDER BY 1""")],
        "capas": [_capa_compacta(c) for c in _linhas(con, "SELECT obra_id, capa_url, fonte, pagina FROM obra_capa WHERE obra_id IN (SELECT obra_id FROM indicacao) ORDER BY obra_id")],
        "fontes": fontes(con),
        "pessoas_em_varios_premios": varios_premios(con),
        # Fica fora do dados.json (só aviso do build): QID → pessoas que o compartilham.
        "qids_repetidos": {q: ids.split(",") for q, ids in con.execute(
            "SELECT wikidata, string_agg(id, ',' ORDER BY id) FROM pessoa WHERE wikidata IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 1").fetchall()},
    }


def contextos(con) -> dict:
    """Textos de contexto das edições (RF-28), fora do dados.json: o perfil de edição busca edicoes.json ao abrir (D32)."""
    return {f"{r['premio_id']}|{r['ano']}": {"texto": r["texto"], "fontes": [u.strip() for u in r["fontes"].split(" ; ")]}
            for r in _linhas(con, "SELECT premio_id, ano, texto, fontes FROM edicao_contexto ORDER BY premio_id, ano")}


def varios_premios(con) -> int:
    """Pessoas (autoria de qualquer papel ou júri) em mais de um prêmio (CA-26.5)."""
    return con.execute("""WITH x AS (SELECT DISTINCT pessoa_id, premio FROM v_participacao
                                    UNION SELECT DISTINCT pessoa_id, premio_id FROM jurado
                                    UNION SELECT DISTINCT pessoa_id, premio_id FROM distincao)
                          SELECT COUNT(*) FROM (SELECT pessoa_id FROM x GROUP BY pessoa_id HAVING COUNT(*) > 1)""").fetchone()[0]


# ---------- banco no navegador (Diadorim, design D26) ----------
# Regras de análise + DDL que a IA recebe como prompt de sistema (antes montado no server.py).
def _ddl(objetos) -> str:
    """CREATE TABLE/VIEW de schema.sql só dos objetos pedidos, com o comentário que vem logo antes (prompt por módulo, D37)."""
    s = (RAIZ / "schema.sql").read_text(encoding="utf-8").split("INSERT INTO uf")[0]
    blocos = re.findall(r"((?:--[^\n]*\n)*CREATE (?:TABLE|VIEW) (\w+).*?;\n)", s, flags=re.S)
    return "\n".join(b for b, nome in blocos if nome in objetos)


def prompt_leitura(con) -> str:
    """Prompt da Diadorim no módulo Leitura (CA-31.7, D39): indicadores, fontes, anos e as regras do módulo."""
    inds = _linhas(con, """SELECT i.id, i.nome, i.unidade, i.tipo_fonte, i.nivel, i.fonte_nome, i.definicao, i.limitacoes,
                                  string_agg(DISTINCT v.ano::VARCHAR, ', ' ORDER BY v.ano::VARCHAR) AS anos,
                                  string_agg(DISTINCT v.dimensao, ', ' ORDER BY v.dimensao) AS dims
                           FROM indicador i JOIN indicador_valor v ON v.indicador_id = i.id GROUP BY i.id, i.nome, i.unidade, i.tipo_fonte, i.nivel, i.fonte_nome, i.definicao, i.limitacoes, i.ordem ORDER BY i.ordem""")
    lista = "\n".join(f"- `{i['id']}` — {i['nome']} ({i['unidade']}; {i['tipo_fonte']}; até nível {i['nivel']}; anos {i['anos']}; recortes {i['dims']}). "
                      f"Fonte: {i['fonte_nome']}. Definição: {i['definicao']} Limitações: {i['limitacoes']}" for i in inds)
    return f"""Você responde sobre o Literadados, plataforma de dados sobre literatura e leitura no Brasil. Aqui, o módulo Leitura:
indicadores agregados de leitura, alfabetização e acesso ao livro, por território (Brasil, região, UF, município), ano e recorte.
Não há pessoas aqui: só números publicados por outras instituições.

Indicadores:
{lista}

Regras:
- Responda em português do Brasil. Diga sempre o ano e a fonte de todo número.
- Consulte `v_indicador` (uma linha por indicador, território, ano e recorte). Território: `territorio_tipo` ∈ pais, regiao, uf, municipio; `uf` é a sigla; o código do município é o do IBGE (7 dígitos).
- Recorte `total/total` é o valor sem recorte. Cor ou raça (`cor_raca`) é a autodeclaração de quem respondeu, nas categorias do IBGE (branca, preta, parda, amarela, indígena; `negra` = preta e parda juntas, quando a fonte só publica assim).
- Pesquisa amostral (`tipo_fonte = 'pesquisa_amostral'`): diga a amostra e a margem de erro quando houver; sem margem, diga que a fonte não a publicou.
- Censo e registro administrativo: mostre numerador e denominador junto do percentual.
- `suprimido = true` = a fonte não publica o valor; nunca trate como zero.
- Nunca compare indicadores de definições diferentes como se fossem a mesma medida (leitores da Retratos ≠ alfabetização do Censo).
- Contagem de CNPJ (`livrarias_cnpj`, `editoras_cnpj`) é presença declarada no cadastro, não censo de lojas; `por_100mil` usa a população de 2022.
- Se a pergunta for sobre prêmios literários ou pessoas, diga que isso está no módulo Prêmios (premios.html).
- Não repita o SQL no texto (ele é mostrado à parte).

Esquema (DuckDB):
{_ddl(["territorio", "indicador", "recorte", "indicador_valor", "v_indicador"])}"""


def prompt_mapeamento(con) -> str:
    """Prompt da Diadorim no módulo Mapeamento (CA-31.7, D40): cadastro curado da cena literária de um município."""
    muns = ", ".join(f"{n} ({c})" for c, n in con.execute("""SELECT DISTINCT t.codigo, t.nome FROM territorio t WHERE t.codigo IN
        (SELECT municipio FROM livraria UNION SELECT municipio FROM obra_mapeada UNION SELECT municipio FROM pessoa_atuacao) ORDER BY 2""").fetchall())
    return f"""Você responde sobre o Literadados, plataforma de dados sobre literatura e leitura no Brasil. Aqui, o módulo Mapeamento:
cadastro curado da cena literária de um município — livrarias, clubes do livro, editoras, autoras e autores e obras. Municípios mapeados: {muns}.

Regras:
- Responda em português do Brasil. É CADASTRO, NÃO CENSO: diga "mapeados até agora", nunca "a cidade tem".
- Vínculo com o município: pessoa por `nascimento` (nasceu ali) ou `atuacao` (vive ou trabalha ali, dito numa fonte); obra por `autoria`,
  `editora` (editora sediada ali) ou `ambientacao`. Use `v_vinculo` e diga sempre o critério; nunca some vínculos diferentes sem dizer.
- Pessoas mapeadas: `v_pessoa_mapeada` (colunas `nasceu`, `atua`). Raça só por autodeclaração (piso: "pelo menos"); gênero atribuído pelo
  nome (`genero_evidencia = 'atribuicao'`) é marcado. Todo percentual com o n.
- Privacidade: nunca dê endereço de clube que se reúne em casa (`local_tipo = 'casa'`), nem nome de organizador de clube independente.
- `situacao`: ativa, encerrada ou incerta; `verificado_em` é a data da última conferência.
- Se a pergunta for sobre prêmios ou indicadores de leitura, diga que isso está nos módulos Prêmios (premios.html) e Leitura (leitura.html).
- Não repita o SQL no texto (ele é mostrado à parte).

Esquema (DuckDB):
{_ddl(["territorio", "pessoa", "editora", "obra", "livraria", "clube", "obra_mapeada", "editora_mapeada", "pessoa_atuacao", "mapeamento_autoria",
       "v_pessoa_municipio", "v_editora_municipio", "v_vinculo", "v_pessoa_mapeada"])}"""


def prompt_sistema(con, modulo: str = "premios") -> str:
    if modulo == "leitura":
        return prompt_leitura(con)
    if modulo == "mapeamento":
        return prompt_mapeamento(con)
    ddl = _ddl([t for t in re.findall(r"CREATE (?:TABLE|VIEW) (\w+)", (RAIZ / "schema.sql").read_text(encoding="utf-8"))
                if t not in ("indicador", "recorte", "indicador_valor", "v_indicador", "territorio", "municipio_casamento", "livraria", "clube",
                             "obra_mapeada", "editora_mapeada", "pessoa_atuacao", "mapeamento_autoria", "v_vinculo", "v_pessoa_mapeada")])
    premios = _linhas(con, """SELECT p.id, p.nome, p.organizador, p.abrangencia, p.obras, MIN(i.ano) AS de, MAX(i.ano) AS ate,
                                     COUNT(DISTINCT i.ano) AS edicoes, string_agg(DISTINCT c.categoria, ', ' ORDER BY c.categoria) AS cats
                              FROM premio p JOIN indicacao i ON i.premio_id = p.id
                              JOIN categoria_edicao c USING (premio_id, ano, nome_original)
                              GROUP BY p.id, p.nome, p.organizador, p.abrangencia, p.obras, p.ordem ORDER BY p.ordem""")
    varios = len(premios) > 1
    nomes = " e ".join(p["nome"] for p in premios) if len(premios) <= 2 else f"{len(premios)} prêmios literários"
    # Formatos de cada prêmio (CA-26.13): os regimes da tabela edicao, com os anos em que valeram.
    regimes = {}
    periodo = lambda de, ate: str(de) if de == ate else f"{de}–{ate}"
    for r in _linhas(con, "SELECT premio_id, regime, MIN(ano) AS de, MAX(ano) AS ate FROM edicao GROUP BY ALL ORDER BY premio_id, de"):
        regimes.setdefault(r["premio_id"], []).append(f"{r['regime']} ({periodo(r['de'], r['ate'])})")
    # Edições que julgaram inéditos num prêmio de livros publicados (CA-26.20: Saramago desde 2022).
    ineditas = {r["premio_id"]: r["anos"] for r in _linhas(con, """SELECT premio_id, string_agg(ano::VARCHAR, ', ' ORDER BY ano) AS anos
                                                                    FROM edicao WHERE obras = 'ineditas' GROUP BY 1""")}
    def obras(p):
        if p["obras"] == "ineditas":
            return ", ORIGINAIS INÉDITOS (não são livros do mercado; não compare com os outros sem dizer isso)"
        return f", ORIGINAIS INÉDITOS nas edições {ineditas[p['id']]}" if p["id"] in ineditas else ""
    recorte = "\n".join(f"  - {p['nome']} (premio = '{p['id']}', {p['organizador']}, {'lusófono' if p['abrangencia'] == 'lusofono' else 'nacional'}{obras(p)}): "
                        f"{p['de']}–{p['ate']}, {p['edicoes']} edições, categorias {p['cats']}. Formatos: {'; '.join(regimes.get(p['id'], []))}."
                        for p in premios)
    # Conjunto da obra (RF-30, CA-30.5): v_distincao, à parte de v_participacao.
    dist = _linhas(con, """SELECT d.premio_id, pr.nome, d.nome_original, MIN(d.ano) AS de, MAX(d.ano) AS ate, COUNT(*) AS n
                           FROM distincao d JOIN premio pr ON pr.id = d.premio_id GROUP BY ALL ORDER BY MIN(pr.ordem), d.nome_original""")
    regra_distincao = ("- Conjunto da obra (prêmio por pessoa, sem livro) fica em v_distincao, NUNCA em v_participacao: "
                       + "; ".join(f"{d['nome_original']} ({d['nome']}, premio = '{d['premio_id']}', {periodo(d['de'], d['ate'])}, {d['n']} distinções)" for d in dist)
                       + ". Não some distinções a indicações de livro; para perguntas sobre esses prêmios, consulte v_distincao (mesmas colunas de pessoa).\n") if dist else ""
    # DA-4/DA-5 (revistas): a plataforma é de prêmios, sem prêmio padrão; sem prêmio na pergunta, todos, lado a lado.
    regra_premios = ("""- Vários prêmios: se a pergunta não citar prêmio, responda sobre todos os prêmios da base, como o painel, e diga isso.
  Mostre cada prêmio com o próprio n e % (GROUP BY premio): nunca some ou faça média de percentuais de prêmios diferentes
  (formatos, vagas e períodos diferem). Contagem de pessoas na base toda pode vir junto, dita como tal: a mesma pessoa pode
  estar em mais de um prêmio (pessoa_id é o mesmo), e "pessoas distintas" na base toda é COUNT(DISTINCT pessoa_id) sobre todos.
""" if varios else "")
    return f"""Você responde sobre o Literadados, plataforma de dados sobre literatura e leitura no Brasil. Aqui, o módulo Prêmios: o perfil de quem chega a prêmios literários.
Prêmios na base: {nomes}.
Responda sempre em português do Brasil, começando pelo número pedido e, logo depois, com contexto: nunca só o número.
Contexto é dizer quem são (nome com link para o perfil, estado de nascimento, ano, categoria e obra; até 10 e quantos faltam),
comparar com o total do recorte (n e %) e fechar com uma frase de leitura. Para isso, além da contagem, consulte as linhas
por trás do número (pessoa_id, nome, uf_nascimento, ano, categoria, titulo, colocacao).

Use a ferramenta consultar_sql para obter qualquer número; nunca responda números de memória.
Regras de análise:
- Recorte da base, por prêmio (coluna premio de v_participacao; regime de cada edição em edicao):
{recorte}
{regra_premios}{regra_distincao}- Se a pergunta envolver edições fora desses períodos, diga que ainda não foram coletadas.
- Conte autores com papel = 'autor', salvo se a pergunta citar ilustradores. Organizadores (papel = 'organizador') nunca contam como autores.
- "Estado" ou "de SP" etc. significa UF de nascimento (uf_nascimento). Região = regiao_nascimento. Quem nasceu fora do Brasil tem
  uf_nascimento = 'EX', regiao_nascimento = 'Exterior' e pais_nascimento com o código ISO 3166-1 (PT, AO, MZ…); pais_nascimento = 'BR' para quem tem UF.
- Etapas: lista (toda linha de indicacao/v_participacao; o que ela é em cada edição está em categoria_edicao.etapa_lista: indicados,
  semifinalistas, finalistas ou premiados), finalista (lista_curta = 1, só onde houve 2ª lista; no Jabuti, de 2019 em diante),
  premiada (premiada = true; no Jabuti: vencedor único até 1992, 1º a 3º de 1993 a 2017, só 1º depois), vencedora (vencedora = true).
- Categoria 'Geral' = prêmio de categoria única (prosa e poesia concorrendo juntas).
- Editora: v_participacao.editora = indicacao.editora_id, a edição que concorreu; vazia = sem editora conhecida da época
  (comum antes de 2000). Nunca use obra.editora_id para contar editoras: é só a 1ª editora conhecida do livro.
- Autoria: o crédito é de cada prêmio (autoria.premio_id); v_participacao já junta pelo prêmio da indicação.
- Período padrão: a série completa de cada prêmio (os períodos do recorte acima), como no painel. Recorte outro período só se a pergunta pedir (uma edição, uma década, "desde 2010").
- No Jabuti, de 1959 a 1999 não houve lista pública de indicados (etapa_lista = 'premiados', vagas_lista vazio): nessas edições a "lista" é só a das premiadas.
  Ao comparar a lista do Jabuti com premiadas ou vencedoras, ou a composição da lista ao longo do tempo, diga isso e, se ajudar, mostre também 2000–2025.
- Raça só existe por autodeclaração pública. 'sem_declaracao' NÃO significa branca. A coluna negra agrupa preta, parda e negra (sem especificar).
  Sempre trate contagens de pessoas negras como piso ("pelo menos") e informe quantas pessoas do recorte não têm declaração.
  Perguntas sobre "pretos" devem mostrar também o agrupamento negros, porque muitos autores dizem só "negro".
  raca_busca = 'parcial' significa que a busca de autodeclaração foi interrompida: ali 'sem_declaracao' pode esconder declarações. Mencione quantas pessoas do recorte têm busca parcial.
- Pessoas distintas: COUNT(DISTINCT pessoa_id). Sempre informe o n absoluto junto de percentuais.
- Nunca deduza raça, gênero ou origem de nomes; use apenas o que está no banco.
- genero_atribuido = true: o gênero foi atribuído pelo primeiro nome, sem fonte (pode estar errado). Em respostas sobre gênero,
  informe quantas pessoas do recorte têm gênero atribuído.
- Se a pergunta não for sobre estes dados, diga educadamente que só responde sobre a base do Literadados (prêmios literários: {nomes}).
Não repita o SQL no texto (ele é mostrado à parte).

Esquema (DuckDB):
{ddl}"""


def modulos_banco(con) -> dict:
    """Tabelas e views de cada módulo no banco do navegador (CA-31.7, D37). Cada Parquet é um arquivo só em web/banco/;
    cada página carrega só o que é do seu módulo (<body data-modulo>)."""
    views = re.findall(r"CREATE VIEW (\w+)", (RAIZ / "schema.sql").read_text(encoding="utf-8"))
    leitura = {"tabelas": ["territorio", "indicador", "recorte", "indicador_valor"], "views": ["v_indicador"]}
    mapa = {"tabelas": ["territorio", "municipio_casamento", "pessoa", "editora", "obra", "autoria", "indicacao", "livraria", "clube",
                        "obra_mapeada", "editora_mapeada", "pessoa_atuacao", "mapeamento_autoria"],
            "views": ["v_pessoa_municipio", "v_editora_municipio", "v_vinculo", "v_pessoa_mapeada"]}
    so_outros = set(leitura["tabelas"][1:]) | set(leitura["views"]) | {"livraria", "clube", "obra_mapeada", "editora_mapeada", "pessoa_atuacao",
                                                                       "mapeamento_autoria", "v_vinculo", "v_pessoa_mapeada"}
    mods = {"premios": {"tabelas": ["uf", *[t for t in TABELAS if t not in so_outros]], "views": [v for v in views if v not in so_outros]}}
    if con is None or con.execute("SELECT COUNT(*) FROM indicador_valor").fetchone()[0]:
        mods["leitura"] = leitura
    if con is None or con.execute("SELECT (SELECT COUNT(*) FROM livraria) + (SELECT COUNT(*) FROM obra_mapeada) + (SELECT COUNT(*) FROM pessoa_atuacao)").fetchone()[0]:
        mods["mapeamento"] = mapa
    return mods


def exportar_banco(con, web: Path):
    """Tabelas em Parquet, views de schema.sql e, por módulo, o prompt da IA: o DuckDB-WASM recria o banco no navegador (D26, D37)."""
    pasta = web / "banco"
    pasta.mkdir(parents=True, exist_ok=True)
    mods = modulos_banco(con)
    for t in dict.fromkeys(t for m in mods.values() for t in m["tabelas"]):
        con.execute(f"COPY {t} TO '{pasta / f'{t}.parquet'}' (FORMAT parquet)")
    views = re.findall(r"CREATE VIEW .*?;", (RAIZ / "schema.sql").read_text(encoding="utf-8"), flags=re.S)
    (pasta / "views.sql").write_text("\n\n".join(views) + "\n", encoding="utf-8")
    for velho in web.glob("contexto-*.json"):  # módulo que ficou sem dado perde o contexto
        if velho.stem.removeprefix("contexto-") not in mods:
            velho.unlink()
    for m, conf in mods.items():
        (web / f"contexto-{m}.json").write_text(json.dumps({**conf, "sistema": prompt_sistema(con, m)}, ensure_ascii=False), encoding="utf-8")


def exportar_leitura(con, web: Path):
    """leitura.json (catálogo, recortes, Brasil/regiões/UFs, cobertura) e leitura/<indicador>/<UF>.json (municípios), D39.
    Valores compactos: [indicador, território, ano, recorte, fonte, valor, numerador, denominador, amostra, margem], índices em
    `indicadores`, `recortes` e `fontes`; valor nulo = suprimido pela fonte; nulos no fim cortados. Também pessoa-municipio.json (D38)."""
    pasta = web / "leitura"
    if not con.execute("SELECT COUNT(*) FROM indicador_valor").fetchone()[0]:
        return
    inds = _linhas(con, "SELECT id, nome, definicao, unidade, tipo_fonte, nivel, fonte_nome, fonte_url, limitacoes FROM indicador ORDER BY ordem")
    recs = _linhas(con, "SELECT dimensao, categoria, rotulo FROM recorte ORDER BY ordem")
    i_ind = {x["id"]: k for k, x in enumerate(inds)}
    i_rec = {(x["dimensao"], x["categoria"]): k for k, x in enumerate(recs)}
    fontes = {}

    def linha(r):
        f = fontes.setdefault(r["fonte_url"], len(fontes))
        v = [i_ind[r["indicador_id"]], r["territorio"], r["ano"], i_rec[(r["dimensao"], r["categoria"])], f,
             r["valor"], r["numerador"], r["denominador"], r["amostra"], r["margem"]]
        v = [int(x) if isinstance(x, float) and x.is_integer() and k in (6, 7) else x for k, x in enumerate(v)]
        while v[-1] is None:
            v.pop()
        return v

    sql = """SELECT v.*, t.tipo, CASE t.tipo WHEN 'municipio' THEN u.sigla END AS uf_mun FROM indicador_valor v
             JOIN territorio t ON t.codigo = v.territorio LEFT JOIN territorio u ON u.codigo = t.pai ORDER BY ALL"""
    todas = _linhas(con, sql)
    acima = [linha(r) for r in todas if r["tipo"] != "municipio"]
    por_arquivo = {}
    for r in todas:
        if r["tipo"] == "municipio":
            por_arquivo.setdefault((r["indicador_id"], r["uf_mun"]), []).append(linha(r))
    cobertura = _linhas(con, """SELECT indicador_id AS indicador, list(DISTINCT ano ORDER BY ano) AS anos,
                                       COUNT(DISTINCT territorio) FILTER (WHERE NOT suprimido) AS territorios,
                                       COUNT(DISTINCT territorio) FILTER (WHERE NOT suprimido AND length(territorio) = 7) AS municipios
                                FROM indicador_valor GROUP BY 1 ORDER BY 1""")
    terr = _linhas(con, "SELECT codigo, tipo, nome, sigla, pai, populacao_2022 FROM territorio WHERE tipo <> 'municipio' ORDER BY tipo DESC, codigo")
    escrever = lambda arq, obj: arq.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    pasta.mkdir(exist_ok=True)
    for velho in pasta.rglob("*.json"):
        velho.unlink()
    # Pessoas-autoras nascidas em cada município (bloco de prêmios do perfil de município, D38), por UF.
    pessoas = {}
    for cod, uf, pid, nome in con.execute("""SELECT v.codigo, u.sigla, p.id, p.nome FROM v_pessoa_municipio v JOIN pessoa p ON p.id = v.pessoa_id
                                             JOIN territorio m ON m.codigo = v.codigo JOIN territorio u ON u.codigo = m.pai ORDER BY p.nome""").fetchall():
        pessoas.setdefault(uf, {}).setdefault(cod, []).append([pid, nome])
    muns = {}
    for cod, nome, uf, pop in con.execute("""SELECT m.codigo, m.nome, u.sigla, m.populacao_2022 FROM territorio m JOIN territorio u ON u.codigo = m.pai
                                             WHERE m.tipo = 'municipio' ORDER BY m.nome""").fetchall():
        muns.setdefault(uf, []).append([cod, nome, pop])
    for uf, lista in muns.items():
        (pasta / "municipios").mkdir(exist_ok=True)
        escrever(pasta / "municipios" / f"{uf}.json", {"uf": uf, "municipios": lista, "pessoas": pessoas.get(uf, {})})
    for (ind, uf), vals in por_arquivo.items():
        (pasta / ind).mkdir(exist_ok=True)
        escrever(pasta / ind / f"{uf}.json", {"indicador": ind, "uf": uf, "valores": vals})
    escrever(web / "leitura.json", {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "indicadores": inds, "recortes": recs,
                                    "fontes": list(fontes), "territorios": terr, "valores": acima, "cobertura": cobertura,
                                    "por_uf": sorted({f"{i}/{u}" for i, u in por_arquivo})})
    escrever(web / "pessoa-municipio.json", dict(con.execute("SELECT pessoa_id, codigo FROM v_pessoa_municipio ORDER BY 1").fetchall()))


def exportar_mapeamento(con, web: Path):
    """mapeamento/<código>.json (livrarias, clubes, editoras, pessoas e obras com vínculo, verificado_ate) e mapeamento/indice.json
    ({pessoa|obra|editora: {id: [códigos]}}, lido pelo painel de prêmios para o bloco "Em <cidade>"), D40. Só campos que o painel mostra."""
    pasta = web / "mapeamento"
    muns = [c for (c,) in con.execute("""SELECT municipio FROM livraria UNION SELECT municipio FROM obra_mapeada UNION SELECT municipio FROM editora_mapeada
                                         UNION SELECT municipio FROM pessoa_atuacao UNION SELECT municipio FROM clube ORDER BY 1""").fetchall()]
    if pasta.exists():
        for velho in pasta.glob("*.json"):
            velho.unlink()
    if not muns:
        return
    pasta.mkdir(exist_ok=True)
    indice = {"pessoa": {}, "obra": {}, "editora": {}}
    for mun in muns:
        nome = con.execute("SELECT nome FROM territorio WHERE codigo = ?", [mun]).fetchone()[0]
        livrarias = _sem_nulos(_linhas(con, """SELECT id, nome, tipo, foco, rede, endereco, bairro, lat, lon, site, redes, situacao, ano_abertura,
                                                     ano_encerramento, fonte, verificado_em::VARCHAR AS verificado_em FROM livraria WHERE municipio = ? ORDER BY nome""", [mun]))
        clubes = _sem_nulos(_linhas(con, """SELECT id, nome, formato, periodicidade, foco, aberto, organizacao, local_tipo, livraria_id, local_nome, bairro,
                                                  COALESCE(c.lat, (SELECT lat FROM livraria l WHERE l.id = c.livraria_id)) AS lat,
                                                  COALESCE(c.lon, (SELECT lon FROM livraria l WHERE l.id = c.livraria_id)) AS lon,
                                                  link, situacao, fonte, verificado_em::VARCHAR AS verificado_em FROM clube c WHERE municipio = ? ORDER BY nome""", [mun]))
        editoras = _sem_nulos(_linhas(con, """SELECT e.id, e.nome, e.grupo, m.tipo, m.site, m.situacao, m.ano_encerramento, m.fonte, m.verificado_em::VARCHAR AS verificado_em,
                                                    EXISTS (SELECT 1 FROM indicacao i WHERE i.editora_id = e.id) OR EXISTS (SELECT 1 FROM obra o JOIN indicacao i ON i.obra_id = o.id WHERE o.editora_id = e.id) AS nos_premios
                                             FROM editora_mapeada m JOIN editora e ON e.id = m.editora_id WHERE m.municipio = ? ORDER BY e.nome""", [mun]))
        pessoas = _sem_nulos(_linhas(con, """SELECT p.pessoa_id AS id, p.nome, p.genero, p.genero_evidencia, p.raca, p.raca_fonte, p.raca_trecho, p.negra,
                                                   p.ano_nascimento, p.nasceu, p.atua,
                                                   (SELECT fonte FROM pessoa_atuacao a WHERE a.pessoa_id = p.pessoa_id AND a.municipio = p.municipio) AS atuacao_fonte,
                                                   (SELECT nascimento_fonte FROM pessoa x WHERE x.id = p.pessoa_id) AS nascimento_fonte,
                                                   EXISTS (SELECT 1 FROM autoria a WHERE a.pessoa_id = p.pessoa_id) AS nos_premios
                                            FROM v_pessoa_mapeada p WHERE p.municipio = ? ORDER BY p.nome""", [mun]))
        ids_p = {p["id"] for p in pessoas}
        # Obras: registradas no mapeamento, ou de pessoa mapeada, ou de editora mapeada (vínculos de v_vinculo).
        obras = _linhas(con, """SELECT o.id, o.titulo, o.ano_publicacao, e.nome AS editora, om.isbn, om.fonte, om.verificado_em::VARCHAR AS verificado_em,
                                       list(DISTINCT v.tipo ORDER BY v.tipo) AS vinculos,
                                       EXISTS (SELECT 1 FROM indicacao i WHERE i.obra_id = o.id) AS nos_premios
                                FROM v_vinculo v JOIN obra o ON o.id = v.entidade_id LEFT JOIN editora e ON e.id = o.editora_id
                                LEFT JOIN obra_mapeada om ON om.obra_id = o.id AND om.municipio = v.municipio
                                WHERE v.entidade = 'obra' AND v.municipio = ? GROUP BY ALL ORDER BY o.titulo""", [mun])
        credito = {}
        for oid, pid, papel in con.execute("""SELECT obra_id, pessoa_id, papel FROM (SELECT obra_id, pessoa_id, papel FROM autoria UNION SELECT * FROM mapeamento_autoria)
                                              WHERE papel IN ('autor','ilustrador','organizador') ORDER BY ALL""").fetchall():
            credito.setdefault(oid, []).append([pid, papel])
        nomes = dict(con.execute("SELECT id, nome FROM pessoa").fetchall())
        for o in obras:
            o["autoria"] = [[pid, nomes[pid], papel] for pid, papel in credito.get(o["id"], [])]
        obras = _sem_nulos(obras)
        datas = [x["verificado_em"] for x in livrarias + clubes + editoras + obras if x.get("verificado_em")]
        payload = {"municipio": mun, "nome": nome, "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                   "verificado_ate": max(datas) if datas else None, "livrarias": livrarias, "clubes": clubes, "editoras": editoras,
                   "pessoas": pessoas, "obras": obras}
        (pasta / f"{mun}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")
        for p in ids_p:
            indice["pessoa"].setdefault(p, []).append(mun)
        for o in obras:
            indice["obra"].setdefault(o["id"], []).append(mun)
        for e in editoras:
            indice["editora"].setdefault(e["id"], []).append(mun)
    indice["municipios"] = dict(con.execute(f"SELECT codigo, nome FROM territorio WHERE codigo IN ({','.join('?' * len(muns))})", muns).fetchall())
    (pasta / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def exportar_busca(con, web: Path):
    """Índice de busca para todas as páginas (CA-31.5, D37): o que não depende de dados.json. Hrefs relativos à raiz do site
    (todas as páginas ficam em web/). Compacto: {tipos, e: [[tipo, rótulo, detalhe, href, extra?]]}."""
    tipos = ["Pessoa", "Editora", "Estado", "Município", "Indicador", "Livraria", "Clube"]
    e = []
    for pid, nome, uf, ano, pais in con.execute("""SELECT id, nome, uf_nascimento, ano_nascimento, pais_nascimento FROM pessoa ORDER BY id""").fetchall():
        sub = " · ".join(str(x) for x in ((pais if uf == "EX" else uf), ano) if x)
        e.append([0, nome, sub, f"premios.html#/pessoa/{pid}"])
    for eid, nome, mun, uf in con.execute("""SELECT id, nome, municipio_sede, uf_sede FROM editora
                                             WHERE id IN (SELECT editora_id FROM obra UNION SELECT editora_id FROM indicacao) ORDER BY id""").fetchall():
        e.append([1, nome, " · ".join(x for x in (mun, uf) if x and x != "EX"), f"premios.html#/editora/{eid}"])
    for uf, nome, regiao in con.execute("SELECT uf, nome, regiao FROM uf WHERE uf <> 'EX' ORDER BY uf").fetchall():
        e.append([2, nome, f"{uf} · {regiao}", f"premios.html#/uf/{uf}", uf])
    if con.execute("SELECT COUNT(*) FROM indicador_valor").fetchone()[0]:
        for cod, nome, uf in con.execute("""SELECT m.codigo, m.nome, u.sigla FROM territorio m JOIN territorio u ON u.codigo = m.pai
                                            WHERE m.tipo = 'municipio' ORDER BY m.codigo""").fetchall():
            e.append([3, nome, uf, f"leitura.html#/municipio/{cod}"])
        for iid, nome, fonte in con.execute("SELECT id, nome, fonte_nome FROM indicador ORDER BY ordem").fetchall():
            e.append([4, nome, fonte, f"leitura.html?i={iid}"])
    for lid, nome, tipo, bairro, mnome in con.execute("""SELECT l.id, l.nome, l.tipo, l.bairro, t.nome FROM livraria l JOIN territorio t ON t.codigo = l.municipio ORDER BY 1""").fetchall():
        e.append([5, nome, " · ".join(x for x in (bairro, mnome) if x), f"mapeamento.html#/livraria/{lid}"])
    for cid, nome, mnome in con.execute("SELECT c.id, c.nome, t.nome FROM clube c JOIN territorio t ON t.codigo = c.municipio ORDER BY 1").fetchall():
        e.append([6, nome, mnome, f"mapeamento.html#/clube/{cid}"])
    (web / "busca.json").write_text(json.dumps({"tipos": tipos, "e": e}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


PARTES_POR_PREMIO = ["participacao", "pessoas", "obras", "editoras", "midia", "jurados", "categorias", "edicoes", "cobertura", "distincoes"]  # = metricas.CHAVES_PARTES


def dividir(payload: dict, prefixo: str = "dados") -> tuple[dict, dict]:
    """Um arquivo por prêmio (CA-26.14, RNF-06): dados.json fica com o prêmio padrão e o que é comum (prêmios, edições,
    categorias, júri, cobertura, fontes); cada outro prêmio vai para dados-<id>.json, com a participação dele e as pessoas,
    obras, editoras e mídias que ainda não estavam em arquivo anterior. O navegador junta tudo (metricas.juntar).
    Com um prêmio só, nada muda. Devolve (base, {nome do arquivo: parte})."""
    if len(payload.get("premios", [])) + len(payload.get("premios_distincao", [])) < 2:
        return payload, {}
    vistos = {k: set() for k in ("pessoas", "obras", "editoras")}
    obra_ed = {o["id"]: o.get("editora_id") for o in payload["obras"]}

    def recorte(linhas, jurados=(), distincoes=()):
        ps = {l["pessoa_id"] for l in linhas} | {j["pessoa_id"] for j in jurados} | {p for d in distincoes for p in [d["pessoa_id"], *d.get("juri", [])]}
        os_ = {l["obra_id"] for l in linhas}
        eds = {e for l in linhas for e in (l.get("editora_id") or None, obra_ed.get(l["obra_id"])) if e}
        novos = {"pessoas": ps - vistos["pessoas"], "obras": os_ - vistos["obras"], "editoras": eds - vistos["editoras"]}
        for k, v in novos.items():
            vistos[k] |= v
        return {"participacao": linhas,
                "pessoas": [p for p in payload["pessoas"] if p["id"] in novos["pessoas"]],
                "obras": [o for o in payload["obras"] if o["id"] in novos["obras"]],
                "editoras": [e for e in payload["editoras"] if e["id"] in novos["editoras"]],
                "midia": [m for m in payload["midia"] if m["pessoa_id"] in novos["pessoas"]]}

    outros = [p["id"] for p in payload["premios"][1:] + payload.get("premios_distincao", [])]
    # Júri, categorias, edições e cobertura de cada prêmio também vão para a parte dele (e as pessoas do júri junto).
    do = lambda chave, p: [x for x in payload[chave] if x.get("premio") == p]
    por_premio = lambda p: {k: do(k, p) for k in ("jurados", "categorias", "edicoes", "cobertura", "distincoes")}
    base = {**payload, **por_premio(None), **recorte([l for l in payload["participacao"] if "premio" not in l], do("jurados", None), do("distincoes", None))}
    partes = {f"{prefixo}-{p}.json": {"premio": p, **por_premio(p),
                                       **recorte([l for l in payload["participacao"] if l.get("premio") == p], do("jurados", p), do("distincoes", p))}
              for p in outros}
    return {**base, "partes": list(partes)}, partes


def build(dados: Path = RAIZ / "dados", db: Path = RAIZ / "literadados.duckdb", saida: Path = RAIZ / "web" / "dados.json") -> dict:
    tmp = db.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    con = duckdb.connect(str(tmp))
    try:
        carregar(con, dados)
        checar(con)
        payload = exportar(con)
        logos = {r.pop("editora_id"): r for r in _linhas(con, "SELECT * FROM editora_logo ORDER BY editora_id")}
        exportar_banco(con, saida.parent)
        exportar_busca(con, saida.parent)
        exportar_leitura(con, saida.parent)
        exportar_mapeamento(con, saida.parent)
        saida.parent.mkdir(exist_ok=True)
        (saida.parent / "edicoes.json").write_text(json.dumps(contextos(con), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        seo.gerar(con, saida.parent)
    except BaseException:
        con.close()
        tmp.unlink(missing_ok=True)
        raise
    con.close()
    os.replace(tmp, db)  # troca atômica: o servidor nunca vê banco pela metade
    saida.parent.mkdir(exist_ok=True)
    # qids_repetidos é aviso do build, não do painel. Fora do dados.json (RNF-06, D34): capas, lidas só no perfil de livro,
    # e fontes por domínio, lidas só na página de método.
    base, partes = dividir({k: v for k, v in payload.items() if k not in ("qids_repetidos", "capas", "fontes")}, saida.stem)
    escrever = lambda arq, obj: arq.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")
    escrever(saida.parent / "capas.json", {"sites": SITES_CAPA, "capas": payload["capas"]})
    escrever(saida.parent / "editoras-logos.json", logos)
    escrever(saida.parent / "fontes.json", payload["fontes"])
    escrever(saida, base)
    for velho in saida.parent.glob(f"{saida.stem}-*.json"):  # parte de prêmio que saiu da base
        if velho.name not in partes:
            velho.unlink()
    for nome, parte in partes.items():
        escrever(saida.parent / nome, parte)
    return payload


def main():
    try:
        p = build()
    except BuildError as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"ok: {len(p['participacao'])} participações, {len(p['pessoas'])} pessoas, edições coletadas {p['anos_coletados']}")
    print(f"prêmios: {', '.join(x['nome'] for x in p['premios'])}; pessoas em mais de um prêmio: {p['pessoas_em_varios_premios']}")
    padrao = p["premios"][0]["id"] if p["premios"] else ""
    print("cobertura (% das pessoas-autoras por prêmio e edição):")
    print(f"  {'prêmio':<10} {'ano':>4} {'pessoas':>7} {'gênero':>7} {'UF':>6} {'raça':>6} {'busca raça completa':>20} {'idade':>6}")
    for c in p["cobertura"]:
        print(f"  {c.get('premio', padrao):<10} {c['ano']:>4} {c['pessoas']:>7} {c['pct_genero']:>7} {c['pct_uf']:>6} {c['pct_raca']:>6} {c['pct_busca_raca']:>20} {c['pct_idade']:>6}")
    # Mesmo QID em mais de uma pessoa = provável duplicata por grafia (ou pseudônimo): decida em <premio>/casamentos.csv.
    for qid, ids in p["qids_repetidos"].items():
        print(f"ATENÇÃO: {qid} está em mais de uma pessoa ({', '.join(ids)}): duplicata ou pseudônimo? Decida em casamentos.csv")
    # Casamentos de pessoa só pelo nome ainda sem decisão (coleta.py normalizar, CA-26.5): valem, mas pedem conferência.
    for arq in sorted((RAIZ / "dados" / "coleta").glob("*/casamentos_revisar.csv")):
        n = sum(1 for _ in arq.open(encoding="utf-8")) - 1
        print(f"ATENÇÃO: {n} casamento(s) de pessoa para conferir em {arq.relative_to(RAIZ)} (decida em casamentos.csv)")
    # Município da base sem código do IBGE e sem decisão em municipio_casamento (CA-32.3, D38).
    con = duckdb.connect(str(RAIZ / "literadados.duckdb"), read_only=True)
    for m, uf in municipios_sem_codigo(con):
        print(f"ATENÇÃO: município sem código do IBGE: {m} ({uf}); decida em dados/municipio_casamento.csv")


def municipios_sem_codigo(con) -> list[tuple]:
    """Nomes de município (nascimento e sede, no Brasil) que não casam com territorio nem têm decisão em municipio_casamento."""
    return con.execute("""
        SELECT DISTINCT municipio_nascimento, uf_nascimento FROM pessoa
        WHERE municipio_nascimento IS NOT NULL AND uf_nascimento IS NOT NULL AND uf_nascimento <> 'EX'
          AND id NOT IN (SELECT pessoa_id FROM v_pessoa_municipio)
          AND (municipio_nascimento, uf_nascimento) NOT IN (SELECT municipio, uf FROM municipio_casamento)
        UNION
        SELECT DISTINCT municipio_sede, uf_sede FROM editora
        WHERE municipio_sede IS NOT NULL AND uf_sede IS NOT NULL AND uf_sede <> 'EX'
          AND id NOT IN (SELECT editora_id FROM v_editora_municipio)
          AND (municipio_sede, uf_sede) NOT IN (SELECT municipio, uf FROM municipio_casamento)
        ORDER BY ALL""").fetchall()


if __name__ == "__main__":
    main()
