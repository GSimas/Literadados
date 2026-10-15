# JabutiDados

Painel interativo e IA conversacional sobre quem chega ao Prêmio Jabuti (2010–2025): gênero, raça autodeclarada e estado de nascimento de autores na lista, entre finalistas e entre premiados.

## Rodar

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python build.py
.venv/bin/python server.py   # http://localhost:8000
```

O painel funciona sem chave. O chat ("Pergunte aos dados") precisa de `ANTHROPIC_API_KEY` no ambiente, ou de um `ant auth login`.

## Estrutura

| Caminho | O que é |
|---|---|
| `spec/` | Especificação (SDD): requisitos com critérios de aceitação, desenho técnico e tarefas |
| `schema.sql` | Modelo de dados (DuckDB) |
| `dados/*.csv` | Fonte da verdade, uma tabela por arquivo |
| `dados/coleta/` | Levantamentos brutos (listas com fontes) |
| `PLANO_COLETA.md` | Protocolo de coleta, inclusive o de raça |
| `build.py` | CSVs → `jabuti.duckdb` + `web/dados.json`, com checagens |
| `coleta.py` | Normalização, pré-preenchimento pelo Wikidata e verificação de trechos |
| `server.py` | Servidor estático + `/api/chat` (Claude com SQL somente leitura) |
| `web/` | Frontend sem build (Observable Plot, d3) |
| `tests/` | `pytest` (backend) e `node --test tests/*.test.mjs` (métricas) |

## Princípios

- **Raça:** só entra por autodeclaração pública, com link e trecho literal. O número de pessoas negras é um piso.
- **Estado:** UF de nascimento.
- **Percentuais:** todo percentual mostra o n.
- **Edições não coletadas:** aparecem como "sem dados", nunca como zero.
