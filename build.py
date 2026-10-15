"""CSVs de dados/ → jabuti.duckdb + web/dados.json, com checagens (spec RF-01)."""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb

RAIZ = Path(__file__).parent
TABELAS = ["editora", "pessoa", "obra", "autoria", "categoria_edicao", "indicacao", "jurado"]  # ordem das FKs


class BuildError(Exception):
    pass


def _linhas(con, sql, params=None):
    cur = con.execute(sql, params or [])
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def carregar(con, dados: Path):
    con.execute((RAIZ / "schema.sql").read_text())
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
    for r in _linhas(con, """
        SELECT c.ano, c.nome_original, c.vagas_lista, c.vagas_curta, c.vagas_premio,
               COUNT(i.obra_id) AS n, SUM(i.lista_curta) AS n_curta, COUNT(i.colocacao) AS n_premio
        FROM categoria_edicao c LEFT JOIN indicacao i USING (ano, nome_original)
        WHERE c.ano IN (SELECT DISTINCT ano FROM indicacao)
        GROUP BY ALL ORDER BY c.ano, c.nome_original"""):
        rotulo = f"{r['ano']} {r['nome_original']}"
        if r["vagas_lista"] is not None and r["n"] != r["vagas_lista"]:
            erros.append(f"{rotulo}: lista tem {r['n']} obras, esperado {r['vagas_lista']}")
        if r["vagas_curta"] is not None and (r["n_curta"] or 0) != r["vagas_curta"]:
            erros.append(f"{rotulo}: {r['n_curta'] or 0} finalistas, esperado {r['vagas_curta']}")
        if r["n_premio"] != r["vagas_premio"]:
            erros.append(f"{rotulo}: {r['n_premio']} premiadas, esperado {r['vagas_premio']}")
    for r in _linhas(con, "SELECT id FROM obra WHERE id NOT IN (SELECT obra_id FROM autoria WHERE papel = 'autor')"):
        erros.append(f"obra sem autor: {r['id']}")
    # Colocação repetida é legítima (empates: Livro do Ano Não Ficção 2016, 3º lugar de Contos 2014);
    # o total de premiadas já é conferido contra vagas_premio acima.
    if erros:
        raise BuildError("checagens falharam:\n  " + "\n  ".join(erros))


def exportar(con) -> dict:
    anos_coletados = [r["ano"] for r in _linhas(con, "SELECT DISTINCT ano FROM indicacao ORDER BY ano")]
    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "anos": [2010, 2025],
        "anos_coletados": anos_coletados,
        "participacao": _linhas(con, "SELECT * FROM v_participacao ORDER BY ano, categoria, obra_id, papel, pessoa_id"),
        "pessoas": _linhas(con, """SELECT id, nome, wikidata, genero, genero_fonte, raca, raca_evidencia, raca_fonte,
                                          raca_trecho, raca_busca, ano_nascimento, municipio_nascimento, uf_nascimento,
                                          nascimento_fonte FROM pessoa ORDER BY nome"""),
        "jurados": _linhas(con, """SELECT j.ano, c.categoria, j.pessoa_id FROM jurado j
                                   JOIN categoria_edicao c USING (ano, nome_original) ORDER BY ALL"""),
        "categorias": _linhas(con, "SELECT * FROM categoria_edicao ORDER BY ano, categoria, nome_original"),
        "editoras": _linhas(con, "SELECT * FROM editora ORDER BY nome"),
        "ufs": _linhas(con, "SELECT * FROM uf ORDER BY uf"),
        "cobertura": _linhas(con, "SELECT * FROM v_cobertura ORDER BY ano"),
    }


def build(dados: Path = RAIZ / "dados", db: Path = RAIZ / "jabuti.duckdb", saida: Path = RAIZ / "web" / "dados.json") -> dict:
    tmp = db.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    con = duckdb.connect(str(tmp))
    try:
        carregar(con, dados)
        checar(con)
        payload = exportar(con)
    except BaseException:
        con.close()
        tmp.unlink(missing_ok=True)
        raise
    con.close()
    os.replace(tmp, db)  # troca atômica: o servidor nunca vê banco pela metade
    saida.parent.mkdir(exist_ok=True)
    saida.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str))
    return payload


def main():
    try:
        p = build()
    except BuildError as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"ok: {len(p['participacao'])} participações, {len(p['pessoas'])} pessoas, edições coletadas {p['anos_coletados']}")
    print("cobertura (% das pessoas-autoras por edição):")
    print(f"  {'ano':>4} {'pessoas':>7} {'gênero':>7} {'UF':>6} {'raça':>6} {'busca raça completa':>20} {'idade':>6}")
    for c in p["cobertura"]:
        print(f"  {c['ano']:>4} {c['pessoas']:>7} {c['pct_genero']:>7} {c['pct_uf']:>6} {c['pct_raca']:>6} {c['pct_busca_raca']:>20} {c['pct_idade']:>6}")


if __name__ == "__main__":
    main()
