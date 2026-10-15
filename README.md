<p align="center">
  <img src="web/logo.svg" width="112" alt="Logotipo do Literadados: um jabuti visto de cima, com o casco feito de células hexagonais de dados">
</p>

<h1 align="center">Literadados</h1>

<p align="center"><b>Quem chega ao Prêmio Jabuti?</b><br>
Gênero, raça autodeclarada e estado de nascimento de quem escreveu as obras indicadas ao principal prêmio do livro no Brasil, de 2010 a 2025: painel interativo, história guiada e uma IA que responde perguntas com SQL sobre a base.</p>

---

## Estado atual (out/2026)

| | |
|---|---|
| Edições coletadas | **16 de 16** (2010–2025) |
| Indicações | 929, em 914 obras |
| Pessoas na base | 914, entre elas **713 pessoas-autoras**, 123 ilustradoras e 111 juradas (há quem tenha mais de um papel) |
| Editoras | 252, 226 com sede conhecida |
| Gênero (autoras) | 551 com fonte, **155 atribuídos pelo primeiro nome** (marcados com \*), 7 não identificados |
| UF de nascimento (autoras) | 442 de 713 |
| Raça declarada (autoras) | 35 autodeclarações públicas, 24 pessoas negras (piso). Busca do protocolo completa para 712 de 713 |
| Perfis | 475 QIDs do Wikidata, 426 verbetes da Wikipédia, 208 fotos com licença livre |
| Fontes citadas | 169 domínios, agrupados na seção Referências |

Categorias no recorte: Romance (Romance Literário a partir de 2020), Contos (e Crônicas, até 2017), Crônica (desde 2018), Poesia, Infantil, Juvenil, Infantil e Juvenil (só 2018) e Livro do Ano.

## O que o painel mostra

- **Abertura:** a pergunta central e três números do recorte completo, com um carrossel de fotos livres ao fundo.
- **História guiada:** um ponto por pessoa-autora, que se reorganiza a cada passo: gênero, da lista ao 1º lugar, piso racial e região de nascimento.
- **Panorama:** cartões com n, cobertura e edições coletadas.
- **Linha do tempo:** composição de cada edição e as obras vencedoras por categoria.
- **Mapa:** coroplético por UF de nascimento, em números absolutos ou por milhão de habitantes, e Sankey região → editora → resultado.
- **Análises:** evolução por edição, funil (lista → finalistas → premiadas → vencedoras), segregação por categoria (índice de Duncan), idade no ano do prêmio, editoras e júri.
- **Autores:** galeria e tabela com busca. Cada pessoa tem um perfil com link próprio (`#/pessoa/<id>`) e a fonte de cada atributo.
- **Pergunte aos dados:** pergunta em português → SQL somente leitura → resposta com o número, a tabela e o SQL usado.
- **Método e Referências:** cobertura por edição, definições, protocolo de raça e todas as fontes.

Os filtros de período, categoria e papel valem para todas as seções, menos a história e o chat, e ficam na URL.

## Princípios (inegociáveis)

- **Raça só por autodeclaração pública**, ou por fonte curada por identidade (Literafro/UFMG), sempre com URL e trecho literal. Nunca por foto, sobrenome ou IA. O percentual de pessoas negras é um **piso** ("pelo menos"). "Sem declaração" não significa branca.
- **Gênero com fonte** (Wikidata, Wikipédia, biografias). Sem fonte, ele é **atribuído pelo primeiro nome** e aparece com asterisco e nota de rodapé. Apelidos ambíguos e iniciais ficam como "não identificado".
- **Estado = UF de nascimento.**
- **Todo percentual mostra o n.** As séries usam proporções, porque o número de vagas mudou em 2018.
- **Edições sem dados** aparecem como lacuna, nunca como zero.

> **Encontrou um erro?** Os dados atribuídos podem estar errados. Escreva para **gustavosimassilva@gmail.com** com o nome, o dado correto e, se possível, uma fonte pública. A correção entra pelos arquivos de `dados/` e fica registrada.

## Rodar

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # uma vez
.venv/bin/python build.py      # CSVs → jabuti.duckdb + web/dados.json (falha se o dado for inconsistente)
.venv/bin/python server.py     # http://localhost:8000
```

O painel funciona sem chave. O chat precisa de `ANTHROPIC_API_KEY` no ambiente ou de `ant auth login`. Sem credencial, `/api/chat` responde 503 e o resto continua funcionando.

## Testes

```bash
.venv/bin/python -m pytest -q        # build, checagens, segurança do SQL, chat, mídia, fontes
node --test tests/*.test.mjs         # métricas do painel e contraste AA dos dois temas
```

## Como o projeto é feito (SDD)

Toda mudança de comportamento segue a ordem `spec/spec.md` (requisito e critério de aceitação) → `spec/design.md` (decisão técnica) → `spec/tasks.md` (tarefas) → código. Critérios 🧪 têm teste em `tests/`; critérios 👁 são conferidos no navegador, nos temas claro e escuro e a 375 px.

## Estrutura

| Caminho | O que é |
|---|---|
| `spec/` | Especificação (SDD): requisitos, desenho técnico e tarefas |
| `schema.sql` | Modelo de dados (DuckDB) com CHECKs que barram raça sem fonte, gênero atribuído com fonte etc. |
| `dados/*.csv` | Fonte da verdade, uma tabela por arquivo |
| `dados/coleta/` | Levantamentos brutos (listas por edição, pesquisas de pessoas, protocolo em `PROTOCOLO_PESSOAS.md`) |
| `build.py` | CSVs → `jabuti.duckdb` + `web/dados.json`, com checagens de consistência |
| `coleta.py` | `normalizar`, `aplicar_pessoas`, `wikidata`, `verificar` (trechos de raça), `midia` (fotos livres), `malha` (UFs) |
| `server.py` | Servidor estático + `/api/chat` (Claude com SQL somente leitura) |
| `web/` | Frontend sem etapa de build: Observable Plot e d3 via CDN, módulos ES |
| `tests/` | `pytest` (backend) e `node --test` (métricas e contraste) |
| `PLANO_COLETA.md` | Protocolo de coleta das edições |

Para acrescentar dados, edite `dados/coleta/*` e rode `coleta.py normalizar` / `coleta.py aplicar_pessoas` e depois `build.py`. Nunca edite `jabuti.duckdb` ou `web/dados.json` à mão.

## Sistema visual

- **Logotipo:** um jabuti visto de cima com o casco feito de células hexagonais de dados (`web/logo.svg`). No cabeçalho, as células acendem em sequência no hover.
- **Componentes próprios:** menus de opções, caixas de seleção, diálogos, dicas dos gráficos e barras de rolagem grossas seguem a identidade do Literadados, sem a aparência nativa do sistema.
- **Links como chips:** nomes de pessoas, fontes e referências são chips clicáveis.
- **Motion:** transições sutis em botões, seções, perfis, menus e no carrossel da abertura. Tudo se desliga com `prefers-reduced-motion`.
- **Temas claro, escuro e automático:** escolhidos num menu no ícone do cabeçalho. O contraste AA dos dois temas é testado automaticamente.

## Segurança do chat

Banco aberto só para leitura, `enable_external_access=false`, `lock_configuration`, apenas `SELECT`/`WITH`, limite de linhas e de tempo, e chave só no servidor.
