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
TABELAS = ["premio", "edicao", "edicao_contexto", "editora", "pessoa", "pessoa_midia", "pessoa_foto", "obra", "obra_capa", "autoria",
           "categoria_edicao", "indicacao", "jurado"]  # ordem das FKs


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
        if not csv.exists():
            continue
        try:
            # all_varchar: o DuckDB converte para o tipo da coluna no INSERT; evita inferência errada em colunas quase vazias
            con.execute(f"INSERT INTO {t} BY NAME SELECT * FROM read_csv('{csv}', all_varchar=true, header=true)")
        except duckdb.Error as e:
            raise BuildError(f"dados/{t}.csv: {e}") from None


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
        WHERE (c.premio_id, c.ano) IN (SELECT DISTINCT premio_id, ano FROM indicacao)
        GROUP BY ALL ORDER BY c.premio_id, c.ano, c.nome_original"""):
        rotulo = f"{r['premio_id']} {r['ano']} {r['nome_original']}"
        if r["vagas_lista"] is not None and r["n"] != r["vagas_lista"]:
            erros.append(f"{rotulo}: lista tem {r['n']} obras, esperado {r['vagas_lista']}")
        if r["vagas_curta"] is not None and (r["n_curta"] or 0) != r["vagas_curta"]:
            erros.append(f"{rotulo}: {r['n_curta'] or 0} finalistas, esperado {r['vagas_curta']}")
        if r["n_premio"] != r["vagas_premio"]:
            erros.append(f"{rotulo}: {r['n_premio']} premiadas, esperado {r['vagas_premio']}")
    # Antologia creditada só ao organizador é válida (design D14); obra sem nenhum dos dois, não.
    for r in _linhas(con, "SELECT id FROM obra WHERE id NOT IN (SELECT obra_id FROM autoria WHERE papel IN ('autor', 'organizador'))"):
        erros.append(f"obra sem autor nem organizador: {r['id']}")
    # Nome de editora é a chave do perfil de editora no painel (D33): dois ids com o mesmo nome = duplicata a unificar.
    for r in _linhas(con, "SELECT nome, string_agg(id, ', ' ORDER BY id) AS ids FROM editora GROUP BY nome HAVING COUNT(*) > 1 ORDER BY nome"):
        erros.append(f"editora com nome repetido: {r['nome']} ({r['ids']}); unifique por canonico em dados/coleta/editoras_enriquecidas.csv")
    # Texto de edição (CA-28.3): toda fonte é uma URL; a FK já recusa edição inexistente.
    for r in _linhas(con, "SELECT premio_id, ano, fontes FROM edicao_contexto ORDER BY ALL"):
        if any(not u.strip().startswith("http") for u in r["fontes"].split(" ; ")):
            erros.append(f"{r['premio_id']} {r['ano']}: texto de contexto com fonte que não é URL")
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
                "SELECT fonte FROM indicacao", "SELECT fonte FROM categoria_edicao", "SELECT fonte FROM jurado",
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
    premios = _linhas(con, "SELECT * EXCLUDE (fonte, ordem) FROM premio ORDER BY ordem")
    padrao = [premios[0]["id"]] if premios else [None]  # 1º da ordem: no JSON, `premio` só aparece quando é outro (economia; o painel abre com todos, DA-4)
    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "anos": [min(anos_coletados), max(anos_coletados)],  # série completa: toda parte do painel abre nela (CA-25.2, D30)
        "anos_coletados": anos_coletados,
        "premios": premios,
        # Participação compacta (design D13): atributos de pessoa e obra ficam uma vez em pessoas/obras/editoras,
        # e o navegador remonta as linhas de v_participacao com metricas.expandir.
        "edicoes": _sem_nulos(_linhas(con, "SELECT NULLIF(premio_id, ?) AS premio, ano, regime FROM edicao ORDER BY premio_id, ano", padrao)),
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
        "jurados": _sem_nulos(_linhas(con, """SELECT NULLIF(j.premio_id, ?) AS premio, j.ano, c.categoria, j.pessoa_id FROM jurado j
                                   JOIN categoria_edicao c USING (premio_id, ano, nome_original) ORDER BY j.premio_id, j.ano, c.categoria, j.pessoa_id""", padrao)),
        "categorias": _sem_nulos(_linhas(con, """SELECT NULLIF(premio_id, ?) AS premio, * EXCLUDE (premio_id, fonte) FROM categoria_edicao
                                                 ORDER BY premio_id, ano, categoria, nome_original""", padrao)),
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
                                    UNION SELECT DISTINCT pessoa_id, premio_id FROM jurado)
                          SELECT COUNT(*) FROM (SELECT pessoa_id FROM x GROUP BY pessoa_id HAVING COUNT(*) > 1)""").fetchone()[0]


# ---------- banco no navegador (Diadorim, design D26) ----------
# Regras de análise + DDL que a IA recebe como prompt de sistema (antes montado no server.py).
def prompt_sistema(con) -> str:
    ddl = (RAIZ / "schema.sql").read_text(encoding="utf-8").split("INSERT INTO uf")[0]
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
    recorte = "\n".join(f"  - {p['nome']} (premio = '{p['id']}', {p['organizador']}, {'lusófono' if p['abrangencia'] == 'lusofono' else 'nacional'}{', ORIGINAIS INÉDITOS de autores estreantes (não são livros do mercado; não compare com os outros sem dizer isso)' if p['obras'] == 'ineditas' else ''}): "
                        f"{p['de']}–{p['ate']}, {p['edicoes']} edições, categorias {p['cats']}. Formatos: {'; '.join(regimes.get(p['id'], []))}."
                        for p in premios)
    # DA-4/DA-5 (revistas): a plataforma é de prêmios, sem prêmio padrão; sem prêmio na pergunta, todos, lado a lado.
    regra_premios = ("""- Vários prêmios: se a pergunta não citar prêmio, responda sobre todos os prêmios da base, como o painel, e diga isso.
  Mostre cada prêmio com o próprio n e % (GROUP BY premio): nunca some ou faça média de percentuais de prêmios diferentes
  (formatos, vagas e períodos diferem). Contagem de pessoas na base toda pode vir junto, dita como tal: a mesma pessoa pode
  estar em mais de um prêmio (pessoa_id é o mesmo), e "pessoas distintas" na base toda é COUNT(DISTINCT pessoa_id) sobre todos.
""" if varios else "")
    return f"""Você responde sobre o Literadados, plataforma de dados sobre o perfil de quem chega a prêmios literários.
Prêmios na base: {nomes}.
Responda sempre em português do Brasil, começando pelo número pedido e, logo depois, com contexto: nunca só o número.
Contexto é dizer quem são (nome com link para o perfil, estado de nascimento, ano, categoria e obra; até 10 e quantos faltam),
comparar com o total do recorte (n e %) e fechar com uma frase de leitura. Para isso, além da contagem, consulte as linhas
por trás do número (pessoa_id, nome, uf_nascimento, ano, categoria, titulo, colocacao).

Use a ferramenta consultar_sql para obter qualquer número; nunca responda números de memória.
Regras de análise:
- Recorte da base, por prêmio (coluna premio de v_participacao; regime de cada edição em edicao):
{recorte}
{regra_premios}- Se a pergunta envolver edições fora desses períodos, diga que ainda não foram coletadas.
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


def exportar_banco(con, web: Path):
    """Tabelas em Parquet, views de schema.sql e o prompt da IA: o DuckDB-WASM recria o banco no navegador (D26)."""
    pasta = web / "banco"
    pasta.mkdir(parents=True, exist_ok=True)
    for t in ["uf", *TABELAS]:
        con.execute(f"COPY {t} TO '{pasta / f'{t}.parquet'}' (FORMAT parquet)")
    views = re.findall(r"CREATE VIEW .*?;", (RAIZ / "schema.sql").read_text(encoding="utf-8"), flags=re.S)
    (pasta / "views.sql").write_text("\n\n".join(views) + "\n", encoding="utf-8")
    (web / "contexto.json").write_text(json.dumps({"tabelas": ["uf", *TABELAS], "sistema": prompt_sistema(con)}, ensure_ascii=False), encoding="utf-8")


PARTES_POR_PREMIO = ["participacao", "pessoas", "obras", "editoras", "midia", "jurados", "categorias", "edicoes", "cobertura"]  # = metricas.CHAVES_PARTES


def dividir(payload: dict, prefixo: str = "dados") -> tuple[dict, dict]:
    """Um arquivo por prêmio (CA-26.14, RNF-06): dados.json fica com o prêmio padrão e o que é comum (prêmios, edições,
    categorias, júri, cobertura, fontes); cada outro prêmio vai para dados-<id>.json, com a participação dele e as pessoas,
    obras, editoras e mídias que ainda não estavam em arquivo anterior. O navegador junta tudo (metricas.juntar).
    Com um prêmio só, nada muda. Devolve (base, {nome do arquivo: parte})."""
    if len(payload.get("premios", [])) < 2:
        return payload, {}
    vistos = {k: set() for k in ("pessoas", "obras", "editoras")}
    obra_ed = {o["id"]: o.get("editora_id") for o in payload["obras"]}

    def recorte(linhas, jurados=()):
        ps = {l["pessoa_id"] for l in linhas} | {j["pessoa_id"] for j in jurados}
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

    outros = [p["id"] for p in payload["premios"][1:]]
    # Júri, categorias, edições e cobertura de cada prêmio também vão para a parte dele (e as pessoas do júri junto).
    do = lambda chave, p: [x for x in payload[chave] if x.get("premio") == p]
    por_premio = lambda p: {k: do(k, p) for k in ("jurados", "categorias", "edicoes", "cobertura")}
    base = {**payload, **por_premio(None), **recorte([l for l in payload["participacao"] if "premio" not in l], do("jurados", None))}
    partes = {f"{prefixo}-{p}.json": {"premio": p, **por_premio(p), **recorte([l for l in payload["participacao"] if l.get("premio") == p], do("jurados", p))}
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
        exportar_banco(con, saida.parent)
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


if __name__ == "__main__":
    main()
