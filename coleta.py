"""Ferramentas de coleta (PLANO_COLETA.md). Uso:
  python coleta.py normalizar   # dados/premio.csv + dados/coleta/<premio>/{edicoes,categorias_edicao,lista_*,jurados_*}.csv → dados/*.csv (preserva enriquecimentos)
  python coleta.py wikidata     # pré-preenche gênero/nascimento de pessoas sem QID; candidatos em dados/coleta/wikidata_candidatos.csv
  python coleta.py aplicar_pessoas  # incorpora dados/coleta/pessoas_*.csv (pesquisa de nascimento e raça)
  python coleta.py verificar    # confere se cada raca_trecho aparece na página de raca_fonte
  python coleta.py midia        # foto (Commons, licença livre) e verbete da pt.wikipedia das pessoas com QID → dados/pessoa_midia.csv
  python coleta.py malha        # limites das UFs (IBGE, malha mínima) → web/br-uf.json
"""
import csv
import glob
import html
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).parent
DADOS = RAIZ / "dados"
BRUTO = DADOS / "coleta"
UA = "Literadados/0.1 (pesquisa sobre o Prêmio Jabuti)"

CAMPOS = {
    "pessoa": ["id", "nome", "wikidata", "genero", "genero_fonte", "genero_evidencia", "raca", "raca_evidencia", "raca_fonte", "raca_trecho", "raca_busca",
               "ano_nascimento", "municipio_nascimento", "uf_nascimento", "pais_nascimento", "nascimento_fonte", "revisado_em"],
    "editora": ["id", "nome", "grupo", "municipio_sede", "uf_sede"],
    "obra": ["id", "titulo", "editora_id", "ano_publicacao"],
    "autoria": ["obra_id", "pessoa_id", "papel"],
    "edicao": ["premio_id", "ano", "regime", "fonte"],
    "categoria_edicao": ["premio_id", "ano", "nome_original", "categoria", "vagas_lista", "vagas_curta", "vagas_premio", "etapa_lista", "fonte"],
    "indicacao": ["premio_id", "ano", "nome_original", "obra_id", "lista_curta", "colocacao", "editora_id", "fonte"],
    "jurado": ["premio_id", "ano", "nome_original", "pessoa_id", "fonte"],
    "obra_capa": ["obra_id", "capa_url", "fonte", "pagina"],
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def ler(nome: str) -> list[dict]:
    p = DADOS / f"{nome}.csv"
    return list(csv.DictReader(p.open(encoding="utf-8"))) if p.exists() else []


def gravar(nome: str, linhas: list[dict]):
    with (DADOS / f"{nome}.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS[nome], extrasaction="ignore")
        w.writeheader()
        w.writerows(linhas)


def nomes(campo: str) -> list[str]:
    return [n.strip() for n in (campo or "").split("|") if n.strip()]


CAMPOS_REVISAR = ["nome", "pessoa_id", "motivo", "wikidata_base", "premios_base"]


def normalizar():
    pessoas = {p["id"]: p for p in ler("pessoa")}
    editoras = {e["id"]: e for e in ler("editora")}
    obras, autoria, indicacoes, jurados = {}, set(), {}, {}

    # Um prêmio por pasta (dados/coleta/<premio>/), na ordem de premio.csv (coluna `ordem`; 1 = o padrão do painel, DA-4):
    # o Jabuti vem primeiro, e os ids atuais (fotos, capas, links) não mudam quando entra outro prêmio (design D31).
    premios = sorted(ler("premio"), key=lambda p: (int(p.get("ordem") or 99), p["id"]))
    ordem = {pr["id"]: k for k, pr in enumerate(premios)}

    # Casamento de pessoa entre prêmios (CA-26.5). dados/coleta/<premio>/casamentos.csv (nome, wikidata, pessoa_id):
    # pessoa_id = decisão humana (um id da base, ou "nova" para homônimo); wikidata = QID conferido, que casa com quem
    # já tem esse QID. Sem isso, o nome casa sozinho, mas o casamento com pessoa de um prêmio anterior na ordem vai para
    # casamentos_revisar.csv do prêmio que chegou depois. Dentro do mesmo prêmio, o nome continua sendo a identidade.
    casam = {}
    for pr in premios:
        arq = BRUTO / pr["id"] / "casamentos.csv"
        casam[pr["id"]] = {c["nome"]: c for c in csv.DictReader(arq.open(encoding="utf-8"))} if arq.exists() else {}
    if any((c.get("pessoa_id") or "").strip() == "nova" for c in casam.get(premios[0]["id"], {}).values()):
        raise SystemExit(f"{premios[0]['id']}/casamentos.csv: 'nova' não vale no prêmio padrão (renomearia quem já está na base)")
    por_qid = {p["wikidata"]: i for i, p in pessoas.items() if p.get("wikidata")}
    revisar = {pr["id"]: {} for pr in premios}

    def arquivos(pr: dict, padrao: str) -> list[Path]:
        # Listas: 2010+ primeiro, para os ids de obra dessas edições não mudarem quando entra a série histórica (um título
        # antigo igual recebe o sufixo -ano, não o contrário). Jurados: em ordem de nome.
        fs = glob.glob(str(BRUTO / pr["id"] / padrao))
        return [Path(f) for f in sorted(fs, key=lambda f: (int(re.search(r"(\d{4})", Path(f).name).group(1)) < 2010, f))]

    # 1ª passada: em que prêmios cada nome aparece (listas e júri), para que a revisão independa da ordem de leitura.
    premios_do_nome = {}
    for pr in premios:
        for arq in arquivos(pr, "lista_*.csv"):
            for r in csv.DictReader(open(arq, encoding="utf-8")):
                for n in nomes(r["autores"]) + nomes(r["ilustradores"]) + nomes(r.get("organizadores")):
                    premios_do_nome.setdefault(slug(n), set()).add(pr["id"])
        for arq in arquivos(pr, "jurados_*.csv"):
            for r in csv.DictReader(open(arq, encoding="utf-8")):
                premios_do_nome.setdefault(slug(r["nome"]), set()).add(pr["id"])

    def pessoa(nome: str, premio_id: str) -> str:
        c = casam[premio_id].get(nome, {})
        decisao, qid = (c.get("pessoa_id") or "").strip(), (c.get("wikidata") or "").strip()
        base = slug(nome)
        if decisao == "nova":
            pid = f"{base}-{premio_id}"
        elif decisao:
            if decisao not in pessoas:
                raise SystemExit(f"{premio_id}/casamentos.csv: {nome} → pessoa_id {decisao} não existe")
            pid = decisao
        elif qid and qid in por_qid:
            pid = por_qid[qid]
        else:
            pid = base
            ja = pessoas.get(pid, {}).get("wikidata")
            antes = {p for p in premios_do_nome.get(base, set()) if ordem[p] < ordem[premio_id]}
            if qid and ja and ja != qid:  # mesmo nome, outra pessoa no Wikidata: homônimo
                pid = f"{base}-{premio_id}"
                revisar[premio_id][nome] = {"nome": nome, "pessoa_id": pid, "motivo": f"QID diferente ({qid} × {ja}): criada pessoa nova",
                                            "wikidata_base": ja, "premios_base": ",".join(sorted(antes))}
            elif antes:
                revisar[premio_id][nome] = {"nome": nome, "pessoa_id": pid, "motivo": "casou só pelo nome com pessoa de outro prêmio",
                                            "wikidata_base": ja or "", "premios_base": ",".join(sorted(antes))}
        if pid not in pessoas:
            pessoas[pid] = {"id": pid, "nome": nome, "genero": "nao_identificado", "raca": "sem_declaracao"}
            if qid and qid not in por_qid:
                pessoas[pid]["wikidata"], por_qid[qid] = qid, pid
        return pid

    # Casamento de obra (CA-26.5): mesmo título e a MESMA PESSOA na autoria (na antologia sem autor, o organizador).
    # Só o sobrenome em comum não junta (juntaria "Poesia reunida" de dois Silva): vira outra obra, com o ano no id, e as
    # pessoas vão para revisão. Se forem a mesma pessoa, a decisão em casamentos.csv junta pessoa e, com ela, a obra.
    por_titulo = {}

    def obra(titulo: str, nomes_: list[str], pids: list[str], ano: str, ed_id: str, premio_id: str) -> str:
        base = slug(titulo)
        for oid in por_titulo.get(base, []):
            o = obras[oid]
            if o["_pids"] & set(pids) or not (o["_pids"] or pids):
                o["_pids"] |= set(pids)
                o["editora_id"] = o["editora_id"] or ed_id  # 1ª editora não vazia, só para o perfil e o JSON compacto
                return oid
        for oid in por_titulo.get(base, []):
            for n, p in zip(nomes_, pids):
                decidido = any((casam[premio_id].get(n, {}).get(k) or "").strip() for k in ("pessoa_id", "wikidata"))
                if sobrenome(n) and sobrenome(n) in obras[oid]["_sob"] and not decidido:
                    revisar[premio_id][n] = {"nome": n, "pessoa_id": p, "wikidata_base": "", "premios_base": "",
                                             "motivo": f"'{titulo}' já existe como {oid} ({', '.join(sorted(obras[oid]['_pids']))}), com o mesmo sobrenome: "
                                                       "se for a mesma pessoa, decida em casamentos.csv e a obra se junta"}
        oid, n = (base if base not in obras else f"{base}-{ano}"), 2
        while oid in obras:
            oid, n = f"{base}-{ano}-{n}", n + 1
        obras[oid] = {"id": oid, "titulo": titulo, "editora_id": ed_id, "_sob": {sobrenome(x) for x in nomes_} - {""}, "_pids": set(pids)}
        por_titulo.setdefault(base, []).append(oid)
        return oid
    edicoes, cats = [], []
    for pr in premios:
        pasta = BRUTO / pr["id"]
        edicoes += [{**e, "premio_id": pr["id"]} for e in csv.DictReader((pasta / "edicoes.csv").open(encoding="utf-8"))]
        cats += [{**c, "premio_id": pr["id"]} for c in csv.DictReader((pasta / "categorias_edicao.csv").open(encoding="utf-8"))]
    gravar("edicao", edicoes)
    gravar("categoria_edicao", cats)

    # Um prêmio de cada vez, listas e depois júri: a revisão de um nome vai sempre para o prêmio que chegou depois.
    for premio_id, arq, tipo in [(pr["id"], a, t) for pr in premios for t in ("lista", "jurados") for a in arquivos(pr, f"{t}_*.csv")]:
        if tipo == "jurados":
            for r in csv.DictReader(open(arq, encoding="utf-8")):
                pid = pessoa(r["nome"], premio_id)
                jurados[(premio_id, r["ano"], r["nome_original"], pid)] = {
                    "premio_id": premio_id, "ano": r["ano"], "nome_original": r["nome_original"], "pessoa_id": pid, "fonte": r["fonte"]}
            continue
        for r in csv.DictReader(open(arq, encoding="utf-8")):
            autores = nomes(r["autores"])
            # Coedição ("Objetiva / Alfaguara", ou "A | B"): vale a 1ª editora. Só " / " com espaços, porque "S/A" é sufixo.
            eds = [e.strip() for e in re.split(r"\|| +/ +", r["editora"] or "") if e.strip()]
            ed_nome = eds[0] if eds else ""
            # Editora de outro país (coluna opcional editora_pais, ISO): outra editora, mesmo com o mesmo nome de uma
            # brasileira (Companhia das Letras de Lisboa ≠ de São Paulo). Id e nome levam o país; sede no exterior.
            ed_pais = (r.get("editora_pais") or "").strip().upper()
            estrangeira = bool(ed_nome) and ed_pais not in ("", "BR")
            ed_id = (slug(f"{ed_nome} {ed_pais}") if estrangeira else slug(ed_nome)) if ed_nome else ""
            if ed_id:
                editoras.setdefault(ed_id, {"id": ed_id, "nome": f"{ed_nome} ({ed_pais})", "uf_sede": "EX"} if estrangeira else {"id": ed_id, "nome": ed_nome})
            orgs = [n for n in nomes(r.get("organizadores")) if n not in autores]  # fora das contagens (design D14)
            pa, po = [pessoa(n, premio_id) for n in autores], [pessoa(n, premio_id) for n in orgs]
            oid = obra(r["titulo"], autores or orgs, pa or po, r["ano"], ed_id, premio_id)
            autoria.update((oid, p, "autor") for p in pa)
            autoria.update((oid, p, "organizador") for p in po)
            for n in nomes(r["ilustradores"]):
                if n not in autores:
                    autoria.add((oid, pessoa(n, premio_id), "ilustrador"))
            fonte = " ; ".join(f for f in (r["fonte_1"], r["fonte_2"]) if f)
            indicacoes[(premio_id, r["ano"], r["nome_original"], oid)] = {
                "premio_id": premio_id, "ano": r["ano"], "nome_original": r["nome_original"], "obra_id": oid,
                "lista_curta": r["lista_curta"], "colocacao": r["colocacao"], "fonte": fonte, "_ed": ed_id}

    # Editoras: sede/grupo levantados à parte; `canonico` unifica duplicatas (ex.: "record" → "editora-record").
    enr_arq, alias = BRUTO / "editoras_enriquecidas.csv", {}
    if enr_arq.exists():
        enr = {e["id"]: e for e in csv.DictReader(enr_arq.open(encoding="utf-8"))}
        alias = {i: e["canonico"] for i, e in enr.items() if e.get("canonico") and e["canonico"] != i}
        for o in obras.values():
            o["editora_id"] = alias.get(o["editora_id"], o["editora_id"])
        editoras = {i: {**e, **{k: enr[i][k] for k in ("nome", "grupo", "municipio_sede", "uf_sede")}} if i in enr else e
                    for i, e in editoras.items() if i not in alias}
        for i in set(alias.values()) - set(editoras):
            editoras[i] = {k: enr[i][k] for k in ("id", "nome", "grupo", "municipio_sede", "uf_sede")} if i in enr else {"id": i, "nome": i}
    # Editora por indicação (CA-26.6): a da própria linha ou, vazia, a de outra linha da MESMA edição (o Livro do Ano
    # repete a obra da categoria sem editora). Nunca a de outro ano ou prêmio: editora sem fonte da época fica vazia.
    da_edicao = {}
    for i in indicacoes.values():
        if i["_ed"]:
            da_edicao.setdefault((i["premio_id"], i["ano"], i["obra_id"]), alias.get(i["_ed"], i["_ed"]))
    for i in indicacoes.values():
        i["editora_id"] = alias.get(i["_ed"], i["_ed"]) or da_edicao.get((i["premio_id"], i["ano"], i["obra_id"]), "")

    gravar("pessoa", sorted(pessoas.values(), key=lambda p: p["id"]))
    gravar("editora", sorted(editoras.values(), key=lambda e: e["id"]))
    gravar("obra", sorted(obras.values(), key=lambda o: o["id"]))
    gravar("autoria", [{"obra_id": o, "pessoa_id": p, "papel": t} for o, p, t in sorted(autoria)])
    gravar("indicacao", sorted(indicacoes.values(), key=lambda i: (i["premio_id"], i["ano"], i["nome_original"], i["obra_id"])))
    gravar("jurado", sorted(jurados.values(), key=lambda j: (j["premio_id"], j["ano"], j["nome_original"], j["pessoa_id"])))
    for premio_id, linhas in revisar.items():  # refeito a cada execução; sem pendência, o arquivo some
        arq = BRUTO / premio_id / "casamentos_revisar.csv"
        if linhas:
            with arq.open("w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=CAMPOS_REVISAR)
                w.writeheader()
                w.writerows(sorted(linhas.values(), key=lambda l: l["nome"]))
        else:
            arq.unlink(missing_ok=True)
    pendentes = sum(map(len, revisar.values()))
    print(f"{len(pessoas)} pessoas, {len(editoras)} editoras, {len(obras)} obras, {len(indicacoes)} indicações, {len(jurados)} jurados"
          + (f"; {pendentes} casamentos de pessoa para revisar (dados/coleta/<premio>/casamentos_revisar.csv)" if pendentes else ""))


GENERO = {"Q6581072": "mulher", "Q1052281": "mulher", "Q6581097": "homem", "Q2449503": "homem", "Q48270": "nao_binario"}


def api(**params) -> dict:
    """API de entidades do Wikidata (www.wikidata.org/w/api.php). Não depende do WDQS, que vive com limite de taxa."""
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for tentativa in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or tentativa == 4:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 10))


def _claim(ent: dict, prop: str):
    for c in ent.get("claims", {}).get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if v is not None:
            return v
    return None


_ENT = {}


def entidades(ids: list[str]) -> dict:
    faltam = [i for i in dict.fromkeys(ids) if i and i not in _ENT]
    for k in range(0, len(faltam), 50):
        r = api(action="wbgetentities", ids="|".join(faltam[k:k + 50]), props="claims|labels|descriptions", languages="pt|pt-br|en")
        _ENT.update(r.get("entities", {}))
    return {i: _ENT.get(i, {}) for i in ids if i}


def _rotulo(ent: dict) -> str:
    for lang in ("pt", "pt-br", "en"):
        if lang in ent.get("labels", {}):
            return ent["labels"][lang]["value"]
    return ""


def uf_de(local: str, profundidade: int = 6) -> str:
    """Sobe por P131 (localizado em) até um item P31 = Q485258 (UF do Brasil) e devolve a sigla de P300."""
    atual = local
    for _ in range(profundidade):
        ent = entidades([atual]).get(atual, {})
        tipos = [c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for c in ent.get("claims", {}).get("P31", [])]
        if "Q485258" in tipos:
            return (_claim(ent, "P300") or "").replace("BR-", "")
        pai = _claim(ent, "P131")
        if not pai:
            return ""
        atual = pai["id"]
    return ""


def pais_de(local: str) -> str:
    """País do local de nascimento (P17), como ISO 3166-1 alfa-2 do item do país (P297), para quem nasceu fora do Brasil
    (DA-3). País histórico sem código ISO (ex.: Reino de Portugal) devolve vazio: confira à mão."""
    ent = entidades([local]).get(local, {})
    pais = (_claim(ent, "P17") or {}).get("id", "")
    if not pais:
        return ""
    return (_claim(entidades([pais]).get(pais, {}), "P297") or "").upper()


def nascimento_de(local: str) -> dict:
    """UF (Brasil) ou 'EX' + país (exterior) a partir do item do local de nascimento."""
    uf = uf_de(local)
    if uf:
        return {"uf_nascimento": uf, "pais_nascimento": ""}
    pais = pais_de(local)
    return {"uf_nascimento": "EX", "pais_nascimento": pais} if pais and pais != "BR" else {"uf_nascimento": "", "pais_nascimento": ""}


def wikidata():
    pessoas = ler("pessoa")
    alvo = [p for p in pessoas if not p.get("wikidata")]
    linhas = []
    for n, p in enumerate(alvo, 1):
        achados = api(action="wbsearchentities", search=p["nome"], language="pt", uselang="pt", type="item", limit=7).get("search", [])
        ents = entidades([a["id"] for a in achados])
        humanos = {q: e for q, e in ents.items() if any(c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") == "Q5" for c in e.get("claims", {}).get("P31", []))}
        for q, e in humanos.items():
            gen = (_claim(e, "P21") or {}).get("id", "")
            nasc = (_claim(e, "P569") or {}).get("time", "")
            local = (_claim(e, "P19") or {}).get("id", "")
            linhas.append({"pessoa_id": p["id"], "nome": p["nome"], "qid": q, "rotulo": _rotulo(e), "n_candidatos": len(humanos),
                           "descricao": (e.get("descriptions", {}).get("pt") or e.get("descriptions", {}).get("en") or {}).get("value", ""),
                           "genero": GENERO.get(gen, ""), "ano_nascimento": nasc[1:5] if nasc.startswith("+") else "",
                           "municipio_nascimento": _rotulo(entidades([local]).get(local, {})) if local else "",
                           **(nascimento_de(local) if local else {"uf_nascimento": "", "pais_nascimento": ""})})
        if n % 20 == 0:
            print(f"  {n}/{len(alvo)}", flush=True)
    with (BRUTO / "wikidata_candidatos.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["pessoa_id", "nome", "qid", "rotulo", "n_candidatos", "descricao", "genero", "ano_nascimento", "municipio_nascimento", "uf_nascimento", "pais_nascimento", "confirmado"])
        w.writeheader()
        w.writerows(linhas)
    com = {l["pessoa_id"] for l in linhas}
    unicos = sum(1 for p in alvo if sum(l["pessoa_id"] == p["id"] for l in linhas) == 1)
    print(f"{len(alvo)} pessoas sem QID; {len(com)} com algum candidato humano; {unicos} com candidato único")
    print("Confira, marque confirmado=1 e rode: python coleta.py aplicar_wikidata")


def aplicar_wikidata():
    pessoas = ler("pessoa")
    conf = {c["pessoa_id"]: c for c in csv.DictReader((BRUTO / "wikidata_candidatos.csv").open(encoding="utf-8")) if c.get("confirmado") == "1"}
    n = 0
    for p in pessoas:
        c = conf.get(p["id"])
        if not c:
            continue
        url = f"https://www.wikidata.org/wiki/{c['qid']}"
        p["wikidata"] = c["qid"]
        if p.get("genero", "nao_identificado") == "nao_identificado" and c["genero"]:
            p["genero"], p["genero_fonte"] = c["genero"], url
        if not p.get("uf_nascimento") and c["uf_nascimento"]:
            p["uf_nascimento"], p["municipio_nascimento"], p["nascimento_fonte"] = c["uf_nascimento"], c["municipio_nascimento"], url
            if c["uf_nascimento"] == "EX":  # fora do Brasil: país ISO (DA-3); vazio se o Wikidata não deu código
                p["pais_nascimento"] = c.get("pais_nascimento", "")
        if not p.get("ano_nascimento") and c["ano_nascimento"]:
            p["ano_nascimento"] = c["ano_nascimento"]
            p["nascimento_fonte"] = p.get("nascimento_fonte") or url
        n += 1
    gravar("pessoa", pessoas)
    print(f"{n} pessoas atualizadas a partir do Wikidata")


def aplicar_pessoas():
    """Incorpora dados/coleta/pessoas_*.csv (pesquisa manual/assistida) em dados/pessoa.csv. Célula vazia não apaga dado."""
    from datetime import date
    pessoas = {p["id"]: p for p in ler("pessoa")}
    antes = {i: dict(p) for i, p in pessoas.items()}
    for arq in sorted(glob.glob(str(BRUTO / "pessoas_*.csv"))):
        for r in csv.DictReader(open(arq, encoding="utf-8")):
            p = pessoas.get(r["id"])
            if not p:
                print(f"  ignorado (id desconhecido): {r['id']} em {Path(arq).name}")
                continue
            for k in CAMPOS["pessoa"][2:-1]:
                if r.get(k, "").strip():
                    p[k] = r[k].strip()
            if r.get("genero_fonte", "").strip() and p.get("genero_evidencia"):  # fonte substitui gênero atribuído pelo nome (D16)
                p["genero_evidencia"] = ""
    n = 0
    for i, p in pessoas.items():
        if p != antes[i]:  # revisado_em só muda quando o resultado final muda
            p["revisado_em"] = date.today().isoformat()
            n += 1
    gravar("pessoa", sorted(pessoas.values(), key=lambda p: p["id"]))
    print(f"{n} pessoas atualizadas")


def _norm(s: str) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))  # páginas trazem entidades (&eacute;) e acentos em tags
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>|[^a-z0-9 ]", " ", s)).strip()


def verificar():
    """Confere cada trecho de raça contra a página citada. Resultado em dados/coleta/verificacao_raca.csv."""
    saida = []
    for p in ler("pessoa"):
        if p["raca"] == "sem_declaracao":
            continue
        status = "sem_trecho"
        if p.get("raca_trecho") and p.get("raca_fonte"):
            # curl e não urllib: o Python do python.org no macOS vem sem certificados (CERTIFICATE_VERIFY_FAILED)
            r = subprocess.run(["curl", "-sL", "--max-time", "40", "-A", "Mozilla/5.0 " + UA, "-w", "\n%{http_code} %{content_type}", p["raca_fonte"]],
                               capture_output=True)
            corpo, _, meta = r.stdout.rpartition(b"\n")
            codigo, _, tipo = meta.decode(errors="ignore").partition(" ")
            if r.returncode or not codigo.startswith("2"):
                status = f"erro: http {codigo or r.returncode}"  # fora do ar, bloqueio: conferência humana
            elif "pdf" in tipo:
                status = "pdf: conferir à mão"
            else:
                status = "confere" if _norm(p["raca_trecho"]) in _norm(corpo.decode("utf-8", "ignore")) else "nao_encontrado"
        saida.append({"pessoa_id": p["id"], "raca": p["raca"], "status": status, "fonte": p.get("raca_fonte", "")})
        print(f"{status:>16}  {p['id']}")
    with (BRUTO / "verificacao_raca.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["pessoa_id", "raca", "status", "fonte"])
        w.writeheader()
        w.writerows(saida)


# ---------- mídia e malha (interface narrativa, design D15) ----------

LICENCA_LIVRE = re.compile(r"^(cc[ -]by|cc0|public domain|pd\b|attribution$)", re.I)
NAO_RETRATO = re.compile(r"est[aá]tua|statue|busto|\bbust\b|assinatura|signature|t[uú]mulo|\bgrave\b", re.I)  # P18 que não é retrato


def _json(url: str) -> dict:
    """GET JSON via curl (certificados do sistema; urllib falha atrás de proxy com certificado próprio), com nova tentativa em 429/503."""
    for tentativa in range(5):
        r = subprocess.run(["curl", "-sL", "--max-time", "90", "-A", UA, "-w", "\n%{http_code}", url], capture_output=True)
        corpo, _, codigo = r.stdout.rpartition(b"\n")
        if r.returncode == 0 and codigo.startswith(b"2"):
            return json.loads(corpo)
        if codigo not in (b"429", b"503") or tentativa == 4:
            raise RuntimeError(f"GET {url[:80]}: curl {r.returncode}, http {codigo.decode() or '?'}")
        time.sleep(15)


def _texto(html_: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", html_ or ""))).strip()


def midia():
    """Para cada pessoa com QID: P18 (imagem) e verbete da pt.wikipedia; autoria e licença do arquivo no Commons."""
    pessoas = [p for p in ler("pessoa") if p.get("wikidata")]
    qids = sorted({p["wikidata"] for p in pessoas})
    ents = {}
    for k in range(0, len(qids), 50):
        r = api(action="wbgetentities", ids="|".join(qids[k:k + 50]), props="claims|sitelinks", sitefilter="ptwiki")
        ents.update(r.get("entities", {}))
    arquivos = {}
    for q, e in ents.items():
        img = _claim(e, "P18")
        if img:
            arquivos[q] = img
    meta = {}
    nomes_arq = sorted(set(arquivos.values()))
    for k in range(0, len(nomes_arq), 50):
        titulos = "|".join("File:" + a for a in nomes_arq[k:k + 50])
        r = _json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "query", "titles": titulos, "prop": "imageinfo", "iiprop": "extmetadata", "format": "json"}))
        norm = {n["to"]: n["from"] for n in r.get("query", {}).get("normalized", [])}
        for pg in r.get("query", {}).get("pages", {}).values():
            em = (pg.get("imageinfo") or [{}])[0].get("extmetadata", {})
            nome = norm.get(pg["title"], pg["title"]).removeprefix("File:")
            meta[nome] = {"autor": _texto(em.get("Artist", {}).get("value", "")),
                          "licenca": _texto(em.get("LicenseShortName", {}).get("value", "")),
                          "licenca_url": em.get("LicenseUrl", {}).get("value", "")}
    linhas, recusadas = [], []
    for p in sorted(pessoas, key=lambda p: p["id"]):
        e = ents.get(p["wikidata"], {})
        wiki = e.get("sitelinks", {}).get("ptwiki", {}).get("title", "")
        img = arquivos.get(p["wikidata"], "")
        m = meta.get(img, {}) if img else {}
        if img and (not (m.get("autor") and LICENCA_LIVRE.match(m.get("licenca", ""))) or NAO_RETRATO.search(img)):
            recusadas.append(f"{p['id']}: {img} ({m.get('licenca') or 'sem licença'}; autor: {m.get('autor') or '?'})")
            img, m = "", {}
        if img or wiki:
            linhas.append({"pessoa_id": p["id"], "imagem": img, "imagem_autor": m.get("autor", ""), "imagem_licenca": m.get("licenca", ""),
                           "imagem_licenca_url": m.get("licenca_url", ""), "wikipedia_pt": wiki})
    with (DADOS / "pessoa_midia.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["pessoa_id", "imagem", "imagem_autor", "imagem_licenca", "imagem_licenca_url", "wikipedia_pt"])
        w.writeheader()
        w.writerows(linhas)
    print(f"{len(pessoas)} pessoas com QID; {sum(1 for l in linhas if l['imagem'])} com foto livre; "
          f"{sum(1 for l in linhas if l['wikipedia_pt'])} com verbete na pt.wikipedia; {len(recusadas)} fotos recusadas")
    for r in recusadas:
        print("  recusada:", r)


IBGE_UF = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
           "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
           "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}


def malha():
    """Limites das UFs (IBGE, malha mínima) com a sigla em properties.uf e coordenadas com 3 casas."""
    g = _json("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?" + urllib.parse.urlencode(
        {"formato": "application/vnd.geo+json", "qualidade": "minima", "intrarregiao": "UF"}))

    def arred(c):
        return [round(c[0], 3), round(c[1], 3)] if isinstance(c[0], (int, float)) else [arred(x) for x in c]

    feats = [{"type": "Feature", "properties": {"uf": IBGE_UF[f["properties"]["codarea"]]},
              "geometry": {"type": f["geometry"]["type"], "coordinates": arred(f["geometry"]["coordinates"])}}
             for f in g["features"]]
    saida = RAIZ / "web" / "br-uf.json"
    saida.write_text(json.dumps({"type": "FeatureCollection", "fonte": "IBGE, API de malhas v3 (qualidade mínima)",
                                 "features": sorted(feats, key=lambda f: f["properties"]["uf"])}, separators=(",", ":")), encoding="utf-8")
    print(f"{len(feats)} UFs em {saida.name} ({saida.stat().st_size // 1024} KB)")


FOTOS = RAIZ / "web" / "fotos"
LARGURAS_FOTO = (160, 480)  # anel e abertura (até 128 px na tela, 2x) · perfil (220 px na tela, 2x)


def _baixar(url: str) -> bytes:
    """GET binário via curl, com nova tentativa em 429/503 (mesma política de _json)."""
    for tentativa in range(5):
        r = subprocess.run(["curl", "-sL", "--max-time", "90", "-A", UA, "-w", "\n%{http_code}", url], capture_output=True)
        corpo, _, codigo = r.stdout.rpartition(b"\n")
        if r.returncode == 0 and codigo.startswith(b"2"):
            return corpo
        if codigo not in (b"429", b"503") or tentativa == 4:
            raise RuntimeError(f"GET {url[:80]}: curl {r.returncode}, http {codigo.decode() or '?'}")
        time.sleep(15)


def miniaturas():
    """Fotos livres do Commons → web/fotos/<pessoa_id>-<largura>.webp (RNF-08): o site serve as próprias miniaturas,
    sem cookies de terceiros. Só baixa o que falta; o build marca quem tem miniatura (midia.miniatura)."""
    import io
    from PIL import Image  # só esta coleta usa o Pillow
    FOTOS.mkdir(exist_ok=True)
    novas = falhas = 0
    for m in ler("pessoa_midia"):
        alvos = {w: FOTOS / f"{m['pessoa_id']}-{w}.webp" for w in LARGURAS_FOTO}
        if not m.get("imagem") or all(a.exists() for a in alvos.values()):
            continue
        try:
            im = Image.open(io.BytesIO(_baixar("https://commons.wikimedia.org/wiki/Special:FilePath/"
                                               + urllib.parse.quote(m["imagem"]) + f"?width={max(LARGURAS_FOTO)}")))
            im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
            for w, alvo in alvos.items():
                c = im.copy()
                c.thumbnail((w, w * 3), Image.LANCZOS)
                c.save(alvo, "WEBP", quality=72, method=6)
            novas += 1
        except Exception as e:  # uma foto ruim não para as outras; fica sem miniatura e o site usa o Commons
            falhas += 1
            print(f"  {m['pessoa_id']}: {e}")
        time.sleep(0.3)
    total = sum(f.stat().st_size for f in FOTOS.glob("*.webp"))
    print(f"{novas} pessoas com miniaturas novas, {falhas} falhas; web/fotos com {total // 1024} KB")


# ---------- capas das obras (RF-24) ----------
SEM_CAPA = DADOS / "coleta" / "capas_sem_resultado.txt"  # obras já procuradas sem capa que bata (não repete a busca)


def sobrenome(nome: str) -> str:
    """Último nome que identifica (pula Júnior, Filho, Neto…): "Itamar Vieira Junior" → "vieira"."""
    partes = [p for p in _norm(re.sub(r"\(.*?\)", "", nome)).split(" ") if p not in {"junior", "jr", "filho", "neto", "sobrinho", "segundo"}]
    return partes[-1] if partes else ""


def casa_capa(titulo: str, sobrenomes: list[str], cand_titulo: str, cand_autores: list[str]) -> bool:
    """Aceita a capa só se o título bate (igual, ou um é o outro mais subtítulo) e um sobrenome de autor aparece no candidato."""
    t, c = _norm(titulo), _norm(cand_titulo)
    if not t or not c or not (t == c or c.startswith(t + " ") or t.startswith(c + " ")):
        return False
    autores = " " + _norm(" ".join(cand_autores)) + " "
    return any(f" {s} " in autores for s in sobrenomes if s)


def _capa_google(titulo: str, sobrenomes: list[str]):
    q = urllib.parse.quote(f'intitle:"{titulo}"' + (f" inauthor:{sobrenomes[0]}" if sobrenomes else ""))
    r = _json(f"https://www.googleapis.com/books/v1/volumes?q={q}&maxResults=10&printType=books&langRestrict=pt")
    for it in r.get("items", []):
        v = it.get("volumeInfo", {})
        img = (v.get("imageLinks") or {}).get("thumbnail")
        cand = " ".join(filter(None, [v.get("title"), v.get("subtitle")]))
        if img and casa_capa(titulo, sobrenomes, cand, v.get("authors", [])):
            img = img.replace("http://", "https://").replace("&edge=curl", "")
            return {"capa_url": img, "fonte": "google_books", "pagina": (v.get("canonicalVolumeLink") or v.get("infoLink") or "").replace("http://", "https://") or None}
    return None


def _capa_openlibrary(titulo: str, sobrenomes: list[str]):
    q = urllib.parse.urlencode({"title": titulo, "author": sobrenomes[0] if sobrenomes else "", "fields": "key,title,author_name,cover_i", "limit": 10})
    for d in _json(f"https://openlibrary.org/search.json?{q}").get("docs", []):
        if not casa_capa(titulo, sobrenomes, d.get("title", ""), d.get("author_name", [])):
            continue
        # A capa da obra (cover_i) pode ser de uma tradução: vale só a de uma edição em português.
        for ed in _json(f"https://openlibrary.org{d['key']}/editions.json?limit=100").get("entries", []):
            if ed.get("covers") and ed["covers"][0] > 0 and any(l.get("key") == "/languages/por" for l in ed.get("languages", [])):
                return {"capa_url": f"https://covers.openlibrary.org/b/id/{ed['covers'][0]}-M.jpg", "fonte": "open_library", "pagina": f"https://openlibrary.org{ed['key']}"}
    return None


def capas():
    """Capa de cada obra indicada: Google Books e, se não achar (ou a cota acabar), Open Library. Só grava o que bate
    título + sobrenome de autor. Retoma de onde parou: pula quem já tem capa e quem está em capas_sem_resultado.txt."""
    pessoa = {p["id"]: p["nome"] for p in ler("pessoa")}
    autores: dict[str, list[str]] = {}
    for a in ler("autoria"):
        if a["papel"] == "autor":
            autores.setdefault(a["obra_id"], []).append(sobrenome(pessoa.get(a["pessoa_id"], "")))
    obras = {o["id"]: o for o in ler("obra")}
    feitas = {c["obra_id"]: c for c in ler("obra_capa")}
    sem = set(SEM_CAPA.read_text(encoding="utf-8").split()) if SEM_CAPA.exists() else set()
    fila = sorted({i["obra_id"] for i in ler("indicacao")} - set(feitas) - sem)
    google = True
    print(f"{len(fila)} obras a procurar")
    for k, oid in enumerate(fila, 1):
        o, sob = obras[oid], autores.get(oid, [])
        achou = None
        if google:
            try:
                achou = _capa_google(o["titulo"], sob)
            except RuntimeError as e:
                print(f"  Google Books parou ({e}); seguindo só com a Open Library")
                google = False
        if not achou:
            try:
                achou = _capa_openlibrary(o["titulo"], sob)
            except RuntimeError as e:
                print(f"  {oid}: {e}")
                continue  # erro de rede: tenta de novo na próxima execução
        if achou:
            feitas[oid] = {"obra_id": oid, **achou}
        elif google:  # só marca "sem capa" se as duas fontes responderam; sem a cota do Google, tenta de novo outro dia
            sem.add(oid)
        if k % 25 == 0 or k == len(fila):  # grava aos poucos: dá para interromper e retomar
            gravar("obra_capa", sorted(feitas.values(), key=lambda c: c["obra_id"]))
            SEM_CAPA.write_text("\n".join(sorted(sem)) + "\n", encoding="utf-8")
            print(f"  {k}/{len(fila)}: {len(feitas)} com capa, {len(sem)} sem")
        time.sleep(0.5)


if __name__ == "__main__":
    {"normalizar": normalizar, "wikidata": wikidata, "aplicar_wikidata": aplicar_wikidata,
     "aplicar_pessoas": aplicar_pessoas, "verificar": verificar, "midia": midia, "malha": malha, "miniaturas": miniaturas, "capas": capas}[sys.argv[1]]()
