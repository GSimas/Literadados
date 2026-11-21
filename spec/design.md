# Design — Literadados

> Fase SDD 2/3 (como). Requisitos: [spec.md](spec.md). Tarefas: [tasks.md](tasks.md).

## 1. Arquitetura

```
dados/*.csv ──► build.py ──► literadados.duckdb ──► server.py ──► POST /api/chat ──► Claude (tool: consultar_sql)
 (verdade)        │  checagens                     │
                  └──► web/dados.json ──► web/ (index.html + app.js + style.css) ──► navegador
coleta.py: normalizar listas brutas · pré-preencher via Wikidata · verificar trechos de raça
```

- **Por que JSON estático no frontend:** o volume é pequeno (centenas a poucos milhares de linhas). O navegador filtra e agrega tudo com d3, o painel funciona como site estático e o servidor só é necessário para o chat.
- **Por que DuckDB:** lê CSV com célula vazia como NULL, aplica CHECK e chaves estrangeiras, abre em modo somente leitura e permite desligar o acesso externo. Isso é a base da segurança do chat.
- **Módulos (RF-31, D37 a D40):** um build e um banco para tudo, uma página por módulo em `web/` (`index.html` = portal, `premios.html`, `leitura.html`, `mapeamento.html`), cada uma com os seus JSONs. O território (`territorio`, D38) liga os módulos; pessoa, obra e editora são as mesmas tabelas nos prêmios e no mapeamento.

```
dados/*.csv + dados/indicador_valor/*.csv ──► build.py ──► literadados.duckdb
                                                 ├─► dados.json (+ partes) ──► premios.html
                                                 ├─► leitura.json + leitura/<UF>.json ──► leitura.html
                                                 ├─► mapeamento/<município>.json ──► mapeamento.html
                                                 ├─► números do portal ──► index.html
                                                 ├─► banco/*.parquet + modulos.json + contexto-<módulo>.json ──► Diadorim
                                                 └─► seo.py ──► /premios/ /leitura/ /mapeamento/ /pessoas/ … busca.json
```

## 2. Dados

- **Schema:** [`schema.sql`](../schema.sql). Tabelas `uf`, `premio`, `edicao`, `pessoa`, `editora`, `obra`, `autoria`, `categoria_edicao`, `indicacao`, `jurado` (as três últimas com `premio_id` na chave, D31). Views `v_participacao` (uma linha por pessoa por indicação) e `v_cobertura`.
- **CSVs:** um por tabela, em `dados/<tabela>.csv`, com cabeçalho igual às colunas. A carga é `INSERT INTO t BY NAME SELECT * FROM read_csv(...)`, na ordem das dependências.
- **Coleta bruta:** `dados/coleta/<premio>/` guarda as listas planas de cada prêmio (`edicoes.csv`, `categorias_edicao.csv`, `lista_AAAA.csv`, `jurados_AAAA.csv`); a pesquisa de pessoas (`pessoas_*.csv`) fica na raiz de `dados/coleta/`, porque pessoa é uma só. Os prêmios vêm de `dados/premio.csv`, editado à mão. `coleta.py normalizar` gera os CSVs normalizados, com IDs em slug. As listas têm as colunas `autores`, `ilustradores` e `organizadores` (nomes separados por `|`), que viram `autoria.papel` = `autor`, `ilustrador` e `organizador`.

### Etapas e regimes (vocabulário canônico)

| Etapa | Definição | Coluna |
|---|---|---|
| lista | entrou na 1ª lista pública (≈10) | toda linha de `indicacao` |
| finalista | entrou na 2ª lista (≈5), só de 2019 em diante | `lista_curta = 1` |
| premiada | recebeu colocação (1º a 3º até 2017; 1º depois) | `colocacao IS NOT NULL` |
| vencedora | 1º lugar | `colocacao = 1` |

Regimes: `1959–1992 vencedor por categoria`, `1993–2009 pódio`, `2010–2017 pódio`, `2018 transição`, `2019–2026 vencedor único` (coluna `regime`). De 1959 a 1999 não há lista pública: a etapa lista é só a das premiadas (`categoria_edicao.vagas_lista` vazio).

### `web/dados.json` (contrato)

```json
{
  "gerado_em": "ISO-8601",
  "anos": [1959, 2025],
  "anos_coletados": [1959, 1960, ...],
  "premios": [ { "id", "nome", "organizador", "ano_inicio", "abrangencia" } ],  // em premio.ordem; o 1º tem `premio` omitido nas linhas (só economia; o padrão do painel são todos, DA-4)
  "edicoes": [ { "premio"?, "ano", "regime" } ],  // "premio" (aqui e em participacao, categorias, jurados, cobertura) só quando não é o padrão
  "participacao": [ { "premio"?, "ano", "nome_original", "obra_id", "pessoa_id", "papel"?,
                      "lista_curta"?, "colocacao"?, "editora_id"? } ],  // papel só se não for autor; premiada/vencedora vêm da colocação;
                      // editora_id: ausente = a de obras[]; "" = nenhuma conhecida nesta indicação; outro = a edição que concorreu
  "obras": [ { "id", "titulo", "ano_publicacao", "editora_id" } ],  // editora_id = 1ª editora conhecida (perfil do livro)
  "pessoas": [ { "id", "nome", "genero", "genero_evidencia"?, "raca", "negra", "raca_evidencia", "raca_fonte", "raca_trecho",
                 "raca_busca", "ano_nascimento", "municipio_nascimento", "uf_nascimento", "pais_nascimento"?, "genero_fonte",
                 "nascimento_fonte", "wikidata" } ],  // fonte igual à página do Wikidata da pessoa vira "wd"
  "jurados": [ { "premio"?, "ano", "categoria", "pessoa_id" } ],
  "categorias": [ /* linhas de categoria_edicao, com etapa_lista */ ],
  "editoras": [ { "id", "nome", "grupo", "municipio_sede", "uf_sede" } ],
  "ufs": [ { "uf", "nome", "regiao", "populacao_2022" } ],
  "cobertura": [ /* linhas de v_cobertura, por prêmio e ano */ ],
  "midia": [ { "pessoa_id", "imagem"?, "imagem_autor"?, "imagem_licenca"?, "wikipedia_pt"?, "miniatura"?, "foto_url"?, "foto_pagina"?, "foto_fonte"? } ],  // só campos preenchidos
  "pessoas_em_varios_premios": 0,
  "partes": [ "dados-oceanos.json" ]  // só com mais de um prêmio (CA-26.14)
}
```
As capas ficam em `web/capas.json` (`{ "sites": build.SITES_CAPA, "capas": [ { "obra_id", "f", "i", "p"? } ] }`, compactas por `build._capa_compacta`), lido só quando um perfil de livro abre (D34, RNF-06). As fontes agrupadas por domínio (`[ { "dominio", "grupo", "registros", "exemplo" } ]`) ficam em `web/fontes.json`, lido só pela página de método.

Cada parte (`dados-<prêmio>.json`) tem `{ "premio", "participacao", "pessoas", "obras", "editoras", "midia" }` com o que ainda não veio em `dados.json` ou em parte anterior. `ui.carregarDados` busca as partes em paralelo, logo depois de `dados.json`, e `metricas.juntar` as soma antes de `expandir`. Todas carregam na abertura (cada arquivo < 1 MB): o carregamento sob demanda complicaria os filtros, que são síncronos, sem ganho real, porque o Netlify comprime e as partes são pequenas.

- **Mídia (RF-11):** `dados/pessoa_midia.csv` → tabela `pessoa_midia` (FK `pessoa`). Gerado por `coleta.py midia`: para cada pessoa com QID, lê `P18` (imagem) e o verbete da pt.wikipedia no Wikidata, e a autoria e a licença do arquivo na API do Commons (`extmetadata`). Só entram licenças livres (CC BY, CC BY-SA, CC0, "Attribution" do Commons, domínio público); o CHECK exige autor e licença quando há imagem. O navegador carrega a miniatura por `commons.wikimedia.org/wiki/Special:FilePath/<arquivo>?width=…`.
- **Fontes (RF-18):** agregadas no build a partir das URLs de `indicacao.fonte`, `categoria_edicao.fonte`, `jurado.fonte` e das fontes de atributo em `pessoa`, por domínio (`fontes`).
- **Malha (RF-07):** `web/br-uf.json`, GeoJSON das 27 UFs (IBGE, malha mínima, coordenadas com 3 casas), gerado por `coleta.py malha` com a sigla em `properties.uf`. Fica fora de `dados.json`; o painel desenha com `d3.geoPath(d3.geoIdentity().reflectY(true))`, que não depende do sentido dos anéis.

- **Participação compacta (D13):** cada linha guarda só as chaves e o que é da indicação. Gênero, raça, UF, título e editora ficam uma vez em `pessoas`, `obras` e `editoras`. Ao carregar, `metricas.expandir(D)` faz as junções e devolve linhas com as mesmas colunas, na mesma ordem, de `v_participacao`. O resto do painel não muda.
- **Regras ficam no SQL:** `regime`, `negra`, `premiada` e `vencedora` vêm prontos do banco (`regimes`, `pessoas.negra` e as colunas da participação). O JavaScript só faz junções e `idade_no_premio = ano - ano_nascimento`.
- O teste `test_json_compacto_reconstroi_v_participacao` roda `expandir` no Node sobre o JSON do build e compara linha a linha com `v_participacao` no DuckDB.

## 3. Backend (`server.py`)

- `http.server.ThreadingHTTPServer` da biblioteca padrão. Serve `web/` como estático, com `Cache-Control: no-cache`, mais dois endpoints usados pela Diadorim (D20).
- **`GET /api/contexto`** → `{"sistema": str}`: regras de análise (português; mostrar o n; raça é piso; `papel='autor'` por padrão; nunca inferir raça; gênero atribuído; edições coletadas) e o DDL das tabelas e views. Montado uma vez e guardado em memória.
- **`POST /api/sql`**: o corpo é `{"sql": str}` (até 10 000 caracteres). Resposta 200: `{"sql", "colunas", "linhas", "truncado"}`. Respostas 400: JSON inválido, SQL recusado ou erro do DuckDB, com `{"erro": str}`.
- A IA não roda no servidor: o navegador chama o OpenRouter com a chave de quem entrou (D20).

### Execução segura de SQL (RNF-03)

1. Conexão `duckdb.connect(db, read_only=True, config={"enable_external_access": False})`, seguida de `SET lock_configuration = true`.
2. Remover comentários. Exigir um único comando que comece com `SELECT` ou `WITH`. Bloquear palavras-chave perigosas (`COPY`, `ATTACH`, `INSTALL`, `LOAD`, `PRAGMA`, `SET`, `CALL`, `EXPORT`, `IMPORT`, `CREATE`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`) e funções de leitura de arquivo (`read_*`, `*_scan`, `glob`). Isso é defesa em profundidade: a garantia real vem do item 1.
3. Limite de 200 linhas devolvidas, com a indicação `truncado`. Tempo limite de 5 s via `con.interrupt()`.
4. Uma conexão por requisição (o DuckDB em modo leitura aceita várias).

## 4. Frontend (`web/`)

- Bibliotecas, sem build: `d3@7.9.0`, `@observablehq/plot@0.6.16`, `d3-sankey@0.12.3` (jsdelivr). Fontes do Google Fonts (Fraunces para títulos, Inter para texto).
- **Estrutura da página (RF-15):** abertura → história guiada → explorador (panorama, linha do tempo, evolução, funil, categorias, geografia, idade, editoras, júri) → pessoas → pergunte → metodologia e referências. Navegação fixa com a seção atual marcada por `IntersectionObserver`; filtros num painel recolhível com resumo do recorte.
- **História (RF-16):** seção com gráfico `position: sticky` e passos de texto. Um único SVG com um ponto por pessoa-autora; cada passo define posição e cor (grade de unidades agrupada) e o d3 anima a transição. O passo ativo vem de `IntersectionObserver`; `scroll-snap-type: y proximity` na página e `scroll-snap-align: center` em cada passo (desligados com `prefers-reduced-motion`). Os números vêm de `metricas.historia(linhas)`.
- **Perfis (RF-11):** rota por hash (`#/pessoa/<id>`) abre o perfil num `<dialog>` grande; fechar volta ao hash anterior. Avatar: iniciais com matiz derivado do hash do id (nunca de atributos).
- **Linha do tempo (RF-17):** faixa horizontal rolável por edição (marcos, vencedoras por categoria) e pequenos múltiplos de composição por edição de `metricas.porEdicao`.
- `app.js`:
  - carrega `dados.json`
  - mantém o estado dos filtros (sincronizado com a URL)
  - cada seção é uma função `render<Secao>(linhasFiltradas)`
  - agregações com `d3.rollup`
- Tema claro e escuro por tokens CSS. Paleta categórica fixa por grupo, a mesma cor para o mesmo grupo em todos os gráficos.

| RF | Visualização | Implementação |
|---|---|---|
| 03 | Cartões e faixa de cobertura | HTML + CSS |
| 04 | Barras 100% por ano e marcos | `Plot.barY` + `Plot.stackY({offset:"normalize"})`, `Plot.ruleX` e `Plot.text` para os marcos, lacunas como `Plot.text("sem dados")` |
| 05 | Funil (inclinação em várias etapas) | `Plot.line` + `Plot.dot` + rótulos de n |
| 06 | Mapa de calor | `Plot.cell` + `Plot.text` |
| 07 | Coroplético e Sankey | `d3.geoPath` sobre `br-uf.json`, escala sequencial; `d3.sankey` em SVG |
| 08 | Enxame (beeswarm) | `Plot.dot` + `Plot.dodgeY`, `Plot.ruleX` para medianas |
| 09 | Barras de editoras | `Plot.barX` empilhado |
| 10 | Júri × lista × vencedoras | `Plot.barX` agrupado com `fy` |
| 11 | Galeria, tabela e perfil | cartões HTML + `<table>` + `<dialog>` com rota por hash |
| 15 | Abertura e navegação | HTML + CSS, `IntersectionObserver` |
| 16 | História guiada | SVG com d3 (transições), passos com `IntersectionObserver` e `scroll-snap` |
| 17 | Linha do tempo | HTML rolável + `Plot.line`/`Plot.dot` em pequenos múltiplos |
| 18 | Referências | lista HTML de `fontes` |
| 12 | Chat | `<form>` + `fetch`, markdown simples renderizado com segurança (texto escapado) |
| 13 | Metodologia | HTML + tabela de `cobertura` |
| 14 | CSV | `d3.csvFormat` + `Blob` |

### Grupos (dimensões)

- **gênero:** mulher, homem, não binário, não identificado
- **raça declarada:** negra (preta, parda ou negra sem especificar), indígena, amarela, branca, sem declaração
- **região de nascimento:** as cinco regiões, Exterior e sem dado

## 5. Testes (mapa de critérios de aceitação para testes)

- `tests/test_app.py` (pytest) usa os dados reais de `dados/` e uma cópia temporária para os casos de falha.
- `tests/metricas.test.mjs` (`node --test`) testa `web/metricas.js`. As agregações do painel são funções puras, sem d3, importadas por `app.js`, de modo que o teste exercita o mesmo código que o navegador roda.

| CA | Teste |
|---|---|
| 01.1, 01.4 | `test_build_gera_banco_e_json` |
| 01.2 | `test_build_falha_raca_sem_fonte`, `test_build_falha_categoria_fora` |
| 01.5 | `test_obra_so_com_organizador_e_valida`, `test_build_falha_obra_sem_autor_nem_organizador`; `metricas.test.mjs` (`filtrar` exclui organizadores) |
| 01.3 | `test_build_falha_lista_incompleta` |
| 03.1, 05.1, 06.2, 09.2 | `metricas.test.mjs` (KPIs, funil, Duncan, grupos editoriais sobre dados pequenos controlados) |
| 12.2 | `test_sql_seguro_*` |
| 12.4 | `test_chat_sem_chave_503` |
| — | `test_perguntas_originais` (as três perguntas do projeto rodam e devolvem número) |
| 07.3 | `test_malha_uf_tem_27_ufs` |
| 11.3 | `test_midia_exige_licenca_livre`, `test_build_exporta_midia`; `metricas.test.mjs` (`corAvatar` não depende de atributos) |
| 16.2 | `metricas.test.mjs` (`historia` sobre dados controlados) |
| 17.2 | `metricas.test.mjs` (`porEdicao`) |
| 18.1 | `test_build_exporta_fontes_por_dominio` |
| 12.1 (P3) | `test_chat_real_perguntas_originais`, marcado `integracao`: com `ANTHROPIC_API_KEY`, o chat real responde às três perguntas originais citando os mesmos números do SQL de referência e consultando o banco; sem a chave é pulado (`pytest -q -rs` mostra o motivo) |
| RNF-06.1, RNF-06.2 | `test_json_real_menor_que_1mb`, `test_json_compacto_reconstroi_v_participacao`; `metricas.test.mjs` (`expandir`) |
| 26.3, 26.4, 26.6, DA-3 | `test_taxonomia_e_etapa_lista`, `test_editora_da_indicacao`, `test_pais_de_nascimento`; `metricas.test.mjs` (`expandir`: país) |
| 26.8, 26.9, 26.11 | `metricas.test.mjs` (filtro com prêmio, `facetar`, `entrePremios`, `edicoesSemLista`, `marcosDe`, Duncan sem Geral); conferência visual com prêmio fictício (👁) |
| 26.5 | `test_coleta.py` (`test_casamento_*`), `test_vagas_conferidas_por_premio` (`pessoas_em_varios_premios`) |
| 26.6 | `test_editora_da_indicacao`, `test_indicacao_sem_editora_nao_herda_da_obra`; `test_coleta.py` (`test_editora_de_outro_pais_e_outra_editora`, `test_editora_vazia_nao_herda_de_outro_premio`, `test_livro_do_ano_herda_editora_da_mesma_edicao`) |
| 26.7, 26.13, RF-18 | `test_cobertura_e_prompt_por_premio` (cobertura separada, prompt com os dois prêmios e os formatos, grupo de fonte do prêmio) |
| 26.12 | `metricas.test.mjs` (busca: edição filtrada, país no lugar de EX, Entre prêmios) |
| 26.14 | `test_json_dividido_por_premio`, `test_json_real_menor_que_1mb` (cada arquivo); `metricas.test.mjs` (`juntar`) |
| DA-3 | `test_pais_de_nascimento`; `metricas.test.mjs` (`porPais`, `paisOuExterior`) |
| DA-4 | `test_premio_padrao_e_a_ordem_1` (ordem); `test_coleta.py` (`test_nova_no_premio_padrao_e_recusada`); `metricas.test.mjs` (filtro com todos os prêmios como padrão, história com vários prêmios, marcos `null` = todos) |
| 26.15, DA-5 | `test_textos_de_plataforma` (varredura de `web/` e README), `test_textos_sem_periodo_antigo_fixo` (prompt sem prêmio padrão) |
| 27.1–27.6 | `tests/test_seo.py` (`test_paginas_geradas`, `test_metadados_e_json_ld`, `test_regras_eticas_nas_paginas`, `test_numeros_iguais_ao_painel`, `test_sitemap_estavel_e_textos_para_ias`, `test_faq_responde_com_n`) |
| 29.1, 29.3 | `metricas.test.mjs` (`perfilEditora`), `test_paginas_geradas`, `test_numeros_iguais_ao_painel` (por editora) |
| 28.2, 28.3, 28.4 | `metricas.test.mjs` (`perfilEdicao`), `test_contexto_vai_para_edicoes_json_e_pagina`, `test_build_falha_contexto_invalido`, `test_numeros_iguais_ao_painel` (por edição) |
| 26.1, 26.2 | `test_etapa0_so_jabuti`, `test_build_falha_edicao_antes_do_premio`, `test_build_falha_premio_inexistente`, `test_vagas_conferidas_por_premio`; `metricas.test.mjs` (`expandir` com prêmio padrão) |
| 31.1, 31.3 | testes atuais apontando para `premios.html`; `test_rotas_antigas_redirecionam` (script do portal no Node) |
| 31.2, 31.4, 31.6 | `test_portal_numeros_do_build`, `test_cabecalho_igual_em_todas_as_paginas`, `test_textos_de_plataforma` (páginas novas e frases de plataforma) |
| 31.5 | `test_busca_json` (hrefs válidos, sem duplicata com o índice de `premios.html`); `metricas.test.mjs` (`buscar` com entradas de outros módulos) |
| 31.7, 31.8, 31.9 | `test_contexto_e_banco_por_modulo`, `diadorim.test.mjs` (`contexto-premios.json`), `test_json_real_menor_que_1mb` (todo JSON de abertura), `test_build_falha_diz_o_modulo` |
| 32.1, 32.2, 32.5 | `test_territorio_completo`, `test_build_falha_territorio_inexistente`, `test_uf_bate_com_territorio`, `test_malha_municipal` |
| 32.3 | `test_codigo_municipio_pessoas_e_editoras` (Florianópolis e um caso de `municipio_casamento.csv`), `test_etapa0_so_jabuti` sem mudança |
| 33.1, 33.2, 33.3 | `test_build_falha_indicador_*` (sem fonte, território, percentual, recorte, chave repetida, amostral sem amostra), `test_suprimido_sem_valor` |
| 33.5, 33.7, 33.8 | `test_cobertura_leitura`, `test_json_leitura_reconstroi_v_indicador`; `metricas.test.mjs` (`leituraParaTexto`/`leituraDeTexto`, `valoresLeitura`, `serieLeitura`); `test_seo.py` (páginas de indicador e bloco de UF) |
| 34.1, 34.3 | `test_coleta.py` (`test_mapeamento_entra_pelo_normalizar`, `test_mapeamento_nao_muda_premios`, `test_remocao_respeitada`), `test_vinculos_derivados` |
| 34.2, 34.4, 34.5, 34.8 | `test_build_falha_mapeamento_*` (sem fonte, sem data, casa com endereço, online com endereço, livraria de clube inexistente) |
| 34.10, 34.12 | `metricas.test.mjs` (`resumoMapeamento`); `test_seo.py` (páginas de livraria e clube sem endereço de casa, JSON-LD), `test_json_mapeamento_sem_campos_extras` |

## 6. Decisões registradas

- **D1** UF = nascimento.
- **D2** Romance de Entretenimento fora.
- **D3** Livro do Ano de Ficção e de Não Ficção (até 2017) dentro.
- **D4** Ilustradores coletados, mas fora das contagens por padrão.
- **D14** Organizadores (antologia, obra reunida, edição póstuma) têm `papel = 'organizador'` e nunca contam: o perfil medido é o de quem escreveu. O filtro "autores e ilustradores" (`papel = 'todos'` em `metricas.filtrar`) inclui só esses dois papéis. Antologia creditada só ao organizador fica sem autor na base e sai das contagens de pessoas; a checagem do build passa a exigir autor **ou** organizador em cada obra.
- **D5** Raça só autodeclarada; o indicador é um piso.
- **D6** Slugs como IDs.
- **D7** O frontend agrega no navegador.
- **D8** O chat usa texto→SQL, não RAG.
- **D9** "Infantil e Juvenil" (2018) é uma categoria canônica própria. Fundi-la com Infantil ou Juvenil distorceria as duas séries.
- **D11** `pessoa.raca_busca` ∈ {completa, parcial}: separa "procurei e não achei" de "não deu para procurar" (a cota de buscas web esgotou na coleta piloto). Pessoa com raça declarada tem busca `completa` por definição. `v_cobertura.pct_busca_raca` expõe isso.
- **D12** Gentílico ("mineira", "capixaba", "paulistana") não basta para UF de nascimento. Valem "nasceu em", "natural de" e a notação bibliográfica "(UF, ano)".
- **D13** `dados.json` normalizado: a participação não repete atributos de pessoa e de obra, e o navegador remonta a tabela larga (`metricas.expandir`). Com as 16 edições, a forma larga chegava a 970 KB, perto do limite de 1 MB (RNF-06); a compacta fica em ~710 KB. Formato colunar ficou de fora: ganharia mais ~100 KB, mas tornaria o JSON ilegível para quem o inspeciona.
- **D15** Interface narrativa (RF-15 a RF-18): a página abre com uma história guiada e só depois o explorador. "Scrolljacking" aqui é só encaixe por passo (`scroll-snap` em modo `proximity`), nunca sequestro da roda do mouse: o leitor controla a velocidade, e `prefers-reduced-motion` desliga o encaixe. Fotos só do Commons com licença livre e crédito; quem não tem foto livre recebe avatar de iniciais com cor neutra (derivada do id), para que a cor nunca sugira gênero ou raça.
- **D16** Gênero atribuído (CA-11.4): depois de esgotadas as buscas (Wikidata, Wikipédia, biografias), quem segue sem fonte recebe gênero pelo primeiro nome, em `dados/coleta/pessoas_zgenero_N.csv` (o `z` faz o arquivo ser aplicado por último: arquivos anteriores gravam `nao_identificado` explícito), com `pessoa.genero_evidencia = 'atribuicao'` e `genero_fonte` vazio. Apelido ambíguo (Duda, Rai, Del) ou só iniciais continuam `nao_identificado`. A view expõe `genero_atribuido`, que `metricas.kpis` e `metricas.historia` contam (`generoAtribuido`). A interface põe asterisco nos números de gênero e uma nota de rodapé com o n e o contato para correção. Raça nunca é atribuída: no Brasil o nome não indica raça, e publicar raça inferida de pessoa identificada é tratamento de dado sensível (LGPD, art. 11). A fonte que aparecer depois substitui a atribuição: quem a aplicar limpa `genero_evidencia`, e o CHECK impede atribuição com fonte.
- **D17** Sistema visual próprio (RF-19), sem biblioteca nova. **Motion:** tokens `--dur-*` e `--curva-*` em `style.css`. Revelação ao rolar por `IntersectionObserver` (classe `.visivel`). Diálogo e menus abrem por classe e fecham depois de `animationend`, porque `display` não anima em todos os navegadores. **Selects:** `ui.melhorarSelect` mantém o `<select>` nativo escondido, como fonte do valor e dos eventos `change`, e desenha um botão com `listbox`. O setter `value` da instância é sobrescrito para o menu acompanhar mudanças programáticas, e um `MutationObserver` refaz as opções. **Rolagem:** `::-webkit-scrollbar` de 14 px. `scrollbar-color` fica só onde não há `::-webkit-scrollbar` (Firefox), porque no Chrome ele desligaria a barra larga. **Dicas do Plot:** `--plot-background` = superfície do tema. **Logotipo:** SVG inline com 7 células hexagonais, o casco do jabuti como grade de dados, e `web/logo.svg` para README e favicon. **Contraste:** `tests/contraste.test.mjs` lê os tokens dos dois temas e exige 4,5:1 nos pares de texto.
- **D18** Método e Referências em `web/metodo.html` + `web/metodo.js` (RF-13, RF-18). A página carrega o mesmo `dados.json` e só usa `cobertura`, `fontes`, `anos_coletados` e `gerado_em`. O tema saiu de `app.js` para `web/tema.js` (`montarTema(aoTrocar)`), usado pelas duas páginas. O cabeçalho é repetido no HTML, porque o projeto não tem etapa de build. A paginação da galeria (CA-11.5) usa `metricas.paginas(atual, total)`, função pura que devolve os números de página e `null` para as reticências.
- **D19** Gráficos em janelas (RF-20): cada bloco antigo virou um `<dialog class="janela">` com o **mesmo id** da seção, e os seletores de render (`#g-…`, `#t-…`) não mudaram. `app.js` tem o registro `JANELAS` (id → funções de render). `renderTudo` só desenha as janelas abertas, e `abrirJanela` desenha na abertura, quando a largura é conhecida. Rota única por hash: `#/grafico/<id>` abre a janela; `#/pessoa/<id>` abre o perfil por cima, sem fechar a janela; qualquer outro hash fecha os dois. **Destaque no hover (CA-19.9):** `ui.desenhar` chama `realcarNoHover` em todo gráfico do Plot. No `pointermove`, ele escolhe a forma sob o ponteiro, ou a mais próxima a até 28 px, entre barras, células, pontos e retângulos, e marca `.em-foco`; o CSS esmaece as outras (`svg.com-foco`). Mapa, Sankey e história fazem o mesmo por CSS `:has(:hover)`. **Fade das dicas (CA-19.8):** a dica própria some com `.saindo`. A do Plot é recriada a cada movimento e some na hora em que o ponteiro sai: `suavizarDicas` reinsere uma cópia com animação de saída quando o grupo `tip` esvazia.
- **D20** Diadorim (RF-12) substitui o chat com a Anthropic no servidor. O navegador faz o PKCE do OpenRouter: `code_verifier` em `sessionStorage`, desafio S256 por `crypto.subtle`, redirecionamento para `openrouter.ai/auth?callback_url=<página>`, e na volta `POST /api/v1/auth/keys` com `code` e `code_verifier`. A chave vai para o `localStorage`. O laço de ferramentas usa `POST /api/v1/chat/completions` com `model: "openrouter/free"` e a ferramenta `consultar_sql`, que chama `POST /api/sql` no nosso servidor (mesmo `validar_sql`/`executar_sql` de antes). Máximo de 6 rodadas. O prompt de sistema vem de `GET /api/contexto` (regras e DDL, como antes) mais a persona e as regras de link. A resposta é Markdown mínimo: o texto é escapado e depois ganha negrito, listas e links, com `href` permitido só para `#…`, `metodo.html…` e `https://`. Persona: inspirada na Diadorim do livro, sem citar trechos. O retrato é um SVG próprio. `server.py` perde `anthropic`, `/api/chat` e `responder`.
- **D21** Anel de retratos (CA-11.5, CA-11.6): `metricas.anel(n, largura)` é uma função pura. Ela calcula o diâmetro do círculo, o raio do miolo vazio e as posições (x, y) a partir do centro, enchendo cada anel até a capacidade (circunferência ÷ (diâmetro + folga)), do anel de dentro para fora; o último anel distribui o resto por igual. O diâmetro diminui até o anel caber na largura. Os retratos são `<button>` posicionados em absoluto. O centro é um `<div aria-live>` que troca de conteúdo com fade no `pointerenter` e no `focus`. A paginação é de 100 por página, com setas laterais. O miolo vale 24% da largura. O centro tem largura e altura fixas (nunca `aspect-ratio`, que deixa a altura crescer com o texto e vira oval), com `container-type: size` e fontes em `cqi`. A `metricas.paginas` (números com reticências) saiu.
- **D22** Filtros por parte (RF-02): `app.js` guarda um estado por parte (`filtros[parte]`, com parte = `panorama`, `autores` e os ids das janelas). `ui.montarFiltro` desenha a barra (selects próprios, menu de categorias com caixas de seleção, resumo, limpar, CSV) e altera o estado da sua parte, e só aquela parte é redesenhada. A URL guarda `?<parte>=<texto>` por `metricas.filtroParaTexto` e `metricas.filtroDeTexto`, que são puras e testadas: `ini-fim`, mais `~cat1,cat2` quando nem todas as categorias estão marcadas, mais `~todos` para autores e ilustradores. O texto vazio é o padrão. Saíram o painel de filtros do cabeçalho e a barra fixa de recorte.
- **D23** Busca e perfis de lugar (RF-21, RF-22). `metricas.indiceBusca(D)` monta entradas `{tipo, rotulo, sub, href, chave}`, com `chave` normalizada (sem acento, minúscula); `metricas.buscar(indice, termo, n)` pontua e ordena. As duas são puras e testadas. `web/busca.js` é o combobox do cabeçalho; em `metodo.html`, os links internos ganham o prefixo `./`. `metricas.perfilLugar(linhas, pred)` calcula os números do lugar sobre `papel = 'autor'` no recorte completo; a parcela usa como base as participações com UF conhecida no Brasil. `web/lugares.js` monta o HTML e desenha os gráficos depois de o diálogo abrir (largura conhecida), via `ui.desenhar` (com hover e fade de dica). A malha das UFs vem de `mapa.obterMalha()`. A rota em `app.js` trata `#/pessoa/`, `#/uf/` e `#/regiao/` no mesmo `<dialog id="perfil">`.
- **D24** Diadorim, segunda rodada (CA-12.8–12.11): `responder(pergunta, historico, chave, {modelo, aoPasso})`. `aoPasso({tipo, texto})` é chamado em cada etapa (`contexto`, `rodada`, `sql`, `resultado`, `erro`, `escrita`), e a interface monta uma lista viva dentro do balão. O modelo escolhido vai no corpo do pedido e fica em `localStorage.dd_modelo`. A lista de modelos é buscada uma vez por abertura do painel de configuração (endpoint público, sem chave), e "suporta ferramentas" vem de `supported_parameters` conter `tools`. Escolher um modelo sem ferramentas é permitido, com aviso de que ele não consulta o banco.
- **D25** Exportação (CA-14.2, CA-14.3), em `web/exportar.js`. **Gráfico:** clona o SVG principal e copia para atributos `style` os estilos calculados (cor, fonte, traço, opacidade), porque as variáveis CSS e as classes não vão junto. Acrescenta título, legenda (lida das amostras do Plot) e rodapé, desenha num `<canvas>` com escala 2× e baixa como `image/jpeg` (fundo `--superficie`) ou `image/png` (transparente). **Tabela:** lê o DOM (`thead`/`tbody`); `xlsx(linhas)` monta um ZIP sem compressão (STORE, com CRC-32) com `[Content_Types].xml`, `_rels`, `workbook` e uma planilha de strings inline. Ficou de fora o SheetJS, cuja versão no npm está parada desde 2022 e tem CVE. Os botões entram por `ui.desenhar` (gráficos do Plot), pelo mapa e pelo Sankey, e por `ui.tabela`, de modo que todo novo desenho já sai com eles. Uma janela única (`#exportar`) atende às duas páginas.
- **D26** Banco no navegador (RNF-07, CA-12.4): o Netlify não roda Python, e as funções dele não aceitam Python. O build exporta cada tabela para `web/banco/<tabela>.parquet`, as views de `schema.sql` para `web/banco/views.sql` e o prompt de regras + DDL para `web/contexto.json`. `web/banco.js` abre, na primeira pergunta, o DuckDB-WASM 1.32.0 (jsDelivr; worker por Blob), cria as tabelas a partir dos Parquet, recria as views e só então faz `SET enable_external_access = false` e `SET lock_configuration = true`. `validarSQL` (o mesmo filtro do antigo `server.validar_sql`, testado no Node) recusa escrita, mais de um comando e funções de leitura de arquivo; o resultado é cortado em 200 linhas. O `server.py` vira só servidor estático (sem `/api`), e a garantia de leitura deixa de ser do servidor: qualquer escrita, se passasse, mudaria só a cópia em memória da aba de quem perguntou.
- **D27** Desempenho (RNF-08). **Fontes:** Inter e Fraunces variáveis (subconjuntos latin e latin-ext do Google Fonts, OFL) em `web/fontes/`, com `preload` dos dois arquivos latin; faces "Inter fallback" (Arial) e "Fraunces fallback" (Georgia) com `size-adjust`/`ascent-override`/`descent-override` calculados com fontTools sobre uma frase da abertura. **Bibliotecas:** o Plot depende do d3 inteiro, por isso trocar o d3 por módulos não reduz nada; o ganho real é tirar Plot e d3-sankey da carga (`ui.carregarGraficos`, chamado pela rota antes de desenhar janela ou perfil de lugar, e pré-carregado em `requestIdleCallback`). **Fotos:** `coleta.py miniaturas` grava `web/fotos/<id>-160.webp` e `-480.webp` (Pillow); o build marca `midia.miniatura` só quando os dois arquivos existem, e `ui.srcFoto` escolhe a local ou o Commons.
- **D28** Resposta seca da Diadorim (CA-12.12): regra no prompt (`build.prompt_sistema` e persona), na descrição da ferramenta, uma insistência automática e, por fim, o detalhamento determinístico. `consultaDeDetalhe` só reescreve o caso simples `SELECT <agregado> FROM v_participacao [WHERE …]` (sem GROUP BY/WITH/UNION/JOIN), trocando a lista de colunas pelas da pessoa e da obra; outro formato fica sem o bloco. A consulta automática passa por `validarSQL` e pelo banco somente leitura, como as do modelo.
- **D28b** Ferramenta em texto (CA-12.13): o roteador `openrouter/free` às vezes cai num modelo que escreve a chamada no `content`. `chamadasNoTexto` reconhece os dois formatos vistos (`<invoke name><parameter name>` e JSON dentro de `<tool_call>`) e o laço reescreve a mensagem como `tool_calls` padrão antes de seguir; `semFerramentas` tira qualquer marcação restante do texto final. No Mapeamento, o prompt avisa que não há coordenada de bairro: "perto de X" vira uma consulta só por `bairro IN (…)` com os vizinhos, dita como aproximada.
- **D29** Ranking e perfil de livro (RF-23, RF-24). `metricas.ranking` é pura e testada; `renderRanking` usa o índice que o Plot liga a cada barra para o clique. Capas em `dados/obra_capa.csv` (tabela `obra_capa`): Google Books primeiro (cota anônima diária compartilhada; quando acaba, segue só com a Open Library e não marca "sem capa"), Open Library depois. Obras procuradas nas duas fontes sem resultado ficam em `dados/coleta/capas_sem_resultado.txt` e não são buscadas de novo. Capa é exibida da fonte, com `referrerpolicy="no-referrer"`, sem cópia no site.
- **D10** As vagas variam por edição (empates criaram listas de 11 a 16 e pódios de 4; houve empate no Livro do Ano de 2016). Nenhum código assume 10/5/3; tudo vem de `categoria_edicao`.
- **D30** Série completa por padrão (CA-25.2 a CA-25.5). O build deixa de exportar `recorte`; o padrão de toda parte é `D.anos` (do primeiro ao último ano coletado; hoje 1959–2026), e `metricas.filtrar` sem período não corta anos. `filtroDeTexto(texto, anos, cats)` perde o 4º parâmetro (padrão próprio por parte): o padrão é sempre a série. O conjunto de edições sem lista pública (`semLista`, calculado em `app.js` a partir de `vagas_lista`) vai no contexto das partes, para o resumo do filtro, a linha do tempo e o aviso do funil. Textos com período leem `D.anos`/`D.anos_coletados` (história, perfil de lugar) ou o filtro da parte (rodapé da exportação, via `data-anos` no elemento da parte). `metricas.editoras` ignora obra sem editora e `metricas.semEditora` conta essas indicações para a nota. Eixo de anos: `metricas.passoAnos(n, largura)` (1, 2, 5 ou 10; pura e testada) decide quais rótulos aparecem; a folga das barras da evolução é uma fração da banda, para nunca passar da largura da barra. Os rótulos dos marcos da evolução vão para a primeira linha livre (sem encostar no anterior) e, perto das bordas, alinham pela ponta. O resumo do funil só chama de queda uma diferença de pelo menos meio ponto (abaixo disso, os dois % arredondam iguais).
- **D32** Páginas estáticas e perfil de edição (RF-27, RF-28). **Gerador:** `seo.py`, chamado no fim de `build.build` com a conexão do build (só quando a saída é `web/dados.json` do projeto ou um diretório pedido nos testes). Números em SQL sobre `v_participacao` com as regras de `metricas.historia` (papel = autor; pessoas distintas; % sobre todas as pessoas; negras = preta, parda ou negra); a paridade é testada rodando `metricas.historia` no Node. Páginas em `web/premios/`, `web/pessoas/`, `web/estados/`, `web/perguntas/`, `web/dados-abertos/` (pastas inteiras geradas: o build apaga o que não gerou de novo), mais `sitemap.xml`, `llms.txt`, `llms-full.txt`. Caminhos absolutos (`/style.css`), servidos igual pelo `server.py` e pelo Netlify. Sem JavaScript, exceto o script inline do tema. Grava só o que mudou, e o `lastmod` do sitemap vem do sitemap anterior quando a página não mudou (nada de data do build no conteúdo). `index.html` tem um trecho entre `<!-- build:numeros -->` e `<!-- /build:numeros -->` que o build reescreve com os três números (é a única parte gerada de um arquivo escrito à mão). JSON-LD: pessoa sem raça e com gênero só se tiver fonte (RNF-04). Sem licença declarada no repositório, o `Dataset` não tem `license` (decisão do mantenedor). **Edição:** `dados/edicao_contexto.csv` vira a tabela `edicao_contexto` (FK para `edicao`, `fontes` NOT NULL); o build exporta `web/edicoes.json` (textos e fontes, ~150 KB, fora do `dados.json` para não passar de 1 MB), carregado só quando um perfil de edição abre. `metricas.perfilEdicao(linhas, premio, ano)` é pura; `edicoes.js` monta o perfil (`#/edicao/<prêmio>/<ano>`) e desenha os gráficos com o Plot já usado nas janelas.
- **D33** Perfil de editora (RF-29). A participação expandida não tem `editora_id` (a paridade com `v_participacao` é por coluna), mas o nome da editora é único (`editora.nome`), então o painel liga nome → id por `D.editoras`. `metricas.perfilEditora(linhas, nome)` é pura e conta indicações como `metricas.editoras` (só autoria, obra distinta por prêmio, ano e categoria). `editoras.js` monta `#/editora/<id>`; `seo.py` gera `/editoras/<id>/` e `/editoras/`, com os números de `resumo` sobre as linhas da editora.
- **D35** Marcas de editoras e capas em perspectiva (CA-29.4, CA-24.3). `editora_logo.csv` registra URL HTTPS, página, fonte e fundo claro/escuro do logotipo oficial; o build valida as referências e exporta `editoras-logos.json`, carregado sob demanda no perfil, e inclui a mesma marca na página permanente. Imagens externas usam `no-referrer`, proporções preservadas e crédito. Até carregar, sem logo ou em caso de erro, aparece SVG tipográfico com iniciais e legenda explícita (alternativa aprovada pelo responsável); a marca oficial só fica visível após `load`. O efeito da capa fica em `capas-3d.js`: eventos de ponteiro no contêiner imóvel atualizam variáveis CSS da capa, com ângulos limitados; saída, cancelamento, perda de foco e mudança de preferência restauram a posição. CSS cria lombada, páginas e brilho sem alterar a imagem ou o crédito. Só ponteiro fino com hover e sem preferência por movimento reduzido ativa o efeito.
- **D36** Conjunto da obra e inéditos por edição (RF-30, CA-26.19 a CA-26.22). **Base:** `categoria_edicao.categoria` aceita `Conjunto da obra`; tabela `distincao (premio_id, ano, nome_original, pessoa_id, fonte)` com FK para `categoria_edicao`, então o júri usa a tabela `jurado` sem mudança. `edicao.obras` (nulo = `premio.obras`) marca a edição de inéditos (Saramago desde 2022). `checar` confere distinções contra `vagas_premio` e recusa mistura de indicação e distinção na mesma categoria. View `v_distincao` com os atributos de pessoa de `v_participacao`. **Coleta:** `dados/coleta/<prêmio>/homenageados.csv` (`ano,nome_original,nome,fonte_1,fonte_2,observacao`), lido pelo `normalizar` com o mesmo casamento de pessoas das listas; `edicoes.csv` aceita a coluna opcional `obras`. **Exportação:** `premios` só com prêmios que têm indicação de livro (o painel por livro não muda); `premios_distincao` com os que só têm distinção (Camões); `distincoes` = `{premio, ano, nome_original, pessoa_id}` mais `juri` por distinção. `categorias`, `jurados` e `edicoes` excluem o que é só conjunto da obra. Na divisão por prêmio, as pessoas das distinções (e do júri delas) entram na parte do prêmio, e os prêmios só de distinção ganham parte própria. **Painel:** `metricas.distincoes(D, premio)` (pura, testada) dá a composição por gênero, raça e região com n; janela `#/grafico/conjunto-da-obra` com uma linha por prêmio; perfil de pessoa e de edição listam as distinções; a busca acha pessoas só distinguidas. **Páginas estáticas:** a página de pessoa lista as distinções; quem só tem distinção também ganha página.
- **D34** Imagens com direitos reservados (CA-11.3, CA-24.2). Agentes gravam `dados/coleta/imagens/fotos_<fonte>.csv` e `capas_<fonte>.csv` pelo `PROTOCOLO.md` da pasta; `coleta.py imagens` junta em `dados/pessoa_foto.csv` (`pessoa_id, foto_url, pagina, fonte`; só quem não tem foto livre; o primeiro arquivo em ordem alfabética vence) e acrescenta capas a `dados/obra_capa.csv` (`fonte` = nome legível do site, `pagina` obrigatória fora de Open Library/Google Books). Tabela separada de `pessoa_midia` porque `coleta.py midia` reescreve aquela do zero. No `dados.json`, `midia[]` ganha `foto_url`, `foto_pagina`, `foto_fonte` só para quem não tem foto livre; `ui.srcFoto` usa miniatura local → Commons → `foto_url` (com `referrerpolicy="no-referrer"`), e `ui.credito` mostra "Foto: <site> · direitos reservados" com link. Nada dessas imagens é copiado para `web/`.
- **D31** Vários prêmios (RF-26). Decisões DA-1 a DA-5 aprovadas em 2026-10-16, como estão abaixo. A implementação começa pela etapa 0.

  **Schema.**
  - `premio (id, nome, organizador, ano_inicio, abrangencia ∈ {nacional, lusofono}, fonte)`, com `'jabuti'` como primeira linha. Não há coluna de tipo: o conjunto da obra é uma categoria da edição (`Conjunto da obra`, D36), e um prêmio pode ter as duas coisas (ABL).
  - `edicao (premio_id, ano, regime, fonte)` substitui o `CASE` de regime de `v_participacao` (CA-26.4) e serve de âncora para os marcos da linha do tempo.
  - `categoria_edicao` ganha `premio_id` na chave `(premio_id, ano, nome_original)` e `etapa_lista` (o que a "lista" é ali: `indicados`, `semifinalistas`, `finalistas` ou `premiados`; no Jabuti, `premiados` sem lista pública, `finalistas` até 2018 e `semifinalistas` de 2019 em diante). O CHECK de `ano` passa a ir do `ano_inicio` do prêmio até o ano corrente (verificado no build, já que o CHECK não lê outra tabela). O CHECK de `categoria` ganha `Geral` e o que a DA-1 trouxer.
  - `autoria` ganha `premio_id` na chave: o crédito é de cada prêmio (a CBL credita ilustradores como autores em 2023; outro prêmio pode listar um coautor ou um tradutor), e `v_participacao` junta a autoria pelo prêmio da indicação. Sem isso, incluir um prêmio mudava os números do Jabuti (achado do gauntlet 2; `test_outro_premio_nao_muda_o_jabuti`).
  - `indicacao` e `jurado` ganham `premio_id` (FK para `categoria_edicao`). `indicacao.editora_id` é opcional e, quando preenchida, vale no lugar de `obra.editora_id` (`COALESCE` na view; CA-26.6). O `normalizar` só a preenche quando a editora da linha difere da editora da obra, e a obra fica com a primeira editora não vazia: a linha do Livro do Ano, sem editora, não apaga mais a da categoria. Isso corrigiu quatro obras do Jabuti (Budapeste, Vozes do Deserto, Cinzas do Norte, Manual da Paixão Solitária), que estavam sem editora.
  - `v_participacao` ganha `premio` e `premio_nome`; `v_cobertura` agrupa por `premio, ano`.
  - `jabuti.duckdb` vira `literadados.duckdb` (build, testes, `.gitignore`, CLAUDE.md).

  **Etapa 0 (CA-26.2).** A migração entra com só o Jabuti: `premio_id = 'jabuti'` em todos os CSVs, `edicao` gerada a partir do `CASE` atual, e os mesmos números. Os testes atuais passam sem mudança de valor. Na migração, `v_participacao` e `v_cobertura` (sem as colunas de prêmio) foram comparadas byte a byte com um retrato tirado antes, e deram iguais. Um retrato no repositório quebraria a cada dado novo, por isso o teste permanente `test_etapa0_so_jabuti` confere o que a migração mexeu: só há o Jabuti, o regime de cada edição é o do antigo `CASE`, e o prêmio padrão fica fora do JSON. A fonte de cada edição do Jabuti é a página oficial de premiados do ano.

  **Coleta.**
  - As listas brutas passam para `dados/coleta/<premio>/` (`lista_AAAA.csv`, `jurados_AAAA.csv`, `categorias_edicao.csv`). As do Jabuti são movidas com `git mv`. Os arquivos de pessoas (`pessoas_*.csv`) continuam na raiz de `dados/coleta/`, porque pessoa é uma só.
  - `normalizar` processa o Jabuti primeiro, para os ids atuais não mudarem (fotos, capas e links dependem deles), e depois os outros prêmios na ordem de `premio`.
  - **Casamento de pessoa:** `dados/coleta/<premio>/casamentos.csv` (`nome`, `wikidata`, `pessoa_id`) guarda o que foi conferido. A ordem é: decisão humana (`pessoa_id` = um id da base, ou `nova` para homônimo, que vira `<slug>-<premio>`); depois o QID, que casa com quem já tem esse `pessoa.wikidata` (pessoa nova herda o QID); por último o nome normalizado. O casamento só pelo nome com pessoa de outro prêmio, e o nome igual com QID diferente (que vira pessoa nova), vão para `casamentos_revisar.csv` na mesma pasta. Esse arquivo é refeito a cada `normalizar` e some quando não há pendência. Para resolver, copie a linha para `casamentos.csv` com a decisão. Dentro de um prêmio, o nome continua sendo a identidade.
  - **Casamento de obra:** mesmo título normalizado e a MESMA pessoa na autoria (na antologia sem autor, o organizador). Só o sobrenome em comum não junta: vira outra obra (`<título>-<ano>`, `-2`… se colidir) e as pessoas vão para revisão. Entre prêmios diferentes, com a mesma pessoa, vale também uma chave tolerante (sem subtítulo depois de `:`/`–`/`(`, sem artigos e preposições, sem espaços). Grafia que diverge demais tem decisão humana em `<premio>/obras_casamentos.csv` (`titulo`, `obra_id`). No Jabuti, as regras dão exatamente os mesmos ids da regra antiga.
  - **Editora na coleta:** a coluna opcional `editora_pais` separa editoras homônimas de outro país (`<nome> (PT)`, sede EX). Num prêmio que tem a coluna, país vazio vira `<nome> (país não informado)`, sem sede. Na coedição vale a 1ª editora: separa `A / B` e `A | B`; separa `A e B`, `A - B` e `A, B` só se todas as partes forem editoras conhecidas. `normalizar` grava só as editoras usadas, e as grafias são unificadas por `canonico`.
  - **Avisos do build:** casamentos de pessoa a conferir e QID em mais de uma pessoa (duplicata por grafia ou pseudônimo).
  - O build informa quantas pessoas estão em mais de um prêmio (`pessoas_em_varios_premios` no `dados.json`).

  **`dados.json`.**
  - Entram `premios` e `edicoes`, que substitui `regimes`.
  - Na participação, o campo `premio` fica fora quando é `jabuti`, como já acontece com `papel = 'autor'` (D13, T21.6). Assim a base atual não cresce.
  - Com mais de um prêmio, o build divide (`build.dividir`, CA-26.14): `dados.json` fica com o prêmio padrão e o que é comum, e cada outro prêmio ganha um `dados-<premio>.json` (ver o contrato na seção 2). Todas as partes carregam em paralelo na abertura, e `metricas.juntar` as soma antes de `expandir`.

  **Painel.**
  - O texto do filtro ganha o segmento `~p:jabuti,oceanos`, omitido no padrão (DA-4). `filtroDeTexto`/`filtroParaTexto` recebem a lista de prêmios da base e o padrão da parte: todos os prêmios em todas as partes (DA-4 revista). Sem a lista, o filtro não tem o campo `premios` e funciona como antes. O menu de prêmios (`ui.menuMarcavel`, o mesmo das categorias) só aparece quando a base tem mais de um prêmio. Desmarcar tudo volta a marcar todos (o recorte nunca fica vazio).
  - `metricas.filtrar` recebe `premios`. `metricas.facetar(linhas, fn)` aplica a agregação a cada prêmio e marca o resultado com `premio`/`premio_nome`. Funil (um resumo de maior queda por prêmio), evolução (lacunas só a partir do `ano_inicio` do prêmio), categorias, júri e linha do tempo usam `fy` = prêmio quando há mais de um (CA-26.9); com um só, o gráfico é o de antes. O índice de Duncan é calculado dentro de cada prêmio, sem `Geral` e sem `Livro do Ano`. Os marcos (`MARCOS`) têm prêmio, e `marcosDe` mostra só os dos prêmios do recorte. Toda chave de indicação leva o prêmio (`premio|ano|nome_original|obra_id`).
  - Edições sem lista pública por prêmio: `metricas.edicoesSemLista` devolve chaves `prêmio|ano` a partir de `etapa_lista`.
  - `CATEGORIAS` (e `PREMIOS`, `NOME_PREMIO`) vêm dos dados por `ui.definirDados`, chamado logo depois de carregar. A busca gera "<Prêmio sem 'Prêmio'> AAAA" para cada edição com dados, e os livros dizem o prêmio quando há mais de um.
  - Perfis: a trajetória junta todos os prêmios, com o selo do prêmio em cada item quando há mais de um; o resultado diz a etapa pelo nome (`etapa_lista`: semifinalista, finalista) em vez de "lista"; o nascimento fora do Brasil mostra o país (`Intl.DisplayNames`). A história guiada e os perfis de lugar ficam no prêmio padrão.
  - Janela nova `entre-premios`, alimentada por `metricas.entrePremios(linhas, ordem, etapa)`, que é pura e testada (CA-26.11): sobreposição de cada par (n e base) em mapa de calor e a lista de quem passou por mais de um, em ordem de chegada. O cartão só aparece com dois prêmios ou mais.
  - Textos: título e sobretítulo da abertura vêm do prêmio padrão; rodapés (`data-premios-texto`) e o rodapé da exportação (`data-premios` na parte) dizem os prêmios; o Método ganha "Vários prêmios", o quadro de prêmios com regimes e a cobertura por prêmio e edição.
  - Diadorim: `build.prompt_sistema` descreve cada prêmio (período, edições, categorias), a regra de não somar prêmios e o padrão (todos os prêmios, comparados lado a lado), `pais_nascimento`, `etapa_lista`, `Geral` e a editora da edição. `validarSQL` não muda.
  - O build agrupa as referências pelo domínio dos novos prêmios (RF-18).

  **Decisões (aprovadas).**
  - **DA-1:** o **Oceanos** é o piloto, porque tem listas públicas de semifinalistas e finalistas parecidas com as do Jabuti de 2019 em diante e testa logo a DA-3. Depois vem o **Prêmio Literário da Biblioteca Nacional**, cujas categorias por gênero mapeiam direto na taxonomia, mas que em geral só tem premiados públicos. Depois, o São Paulo de Literatura. As categorias ficam nos mesmos gêneros do recorte atual, mais `Geral`. Formatos e períodos de cada prêmio são conferidos na coleta, com fonte, como foi com o Jabuti.
  - **DA-2** (revista em 2026-11-19): prêmios pelo conjunto da obra **entram à parte**, na tabela `distincao` (D36), fora de `v_participacao` e das métricas por livro.
  - **DA-3:** autores de fora do Brasil **entram**. Sem eles, o Oceanos perde parte do que premia. A tabela `pessoa` ganha `pais_nascimento` (ISO 3166-1 alfa-2), gravado só para quem nasceu fora do Brasil (CHECK: exige `uf_nascimento = 'EX'` e recusa `BR`). A view e `metricas.expandir` derivam `BR` de qualquer UF brasileira, sem repetir o dado em mil linhas. As pessoas que já estavam com `EX` receberam o país pelo município de nascimento já registrado (`pessoas_pais_1.csv`). O mapa continua sendo do Brasil, e a geografia ganha a dimensão "país". Raça segue o mesmo protocolo (autodeclaração literal com URL, nunca inferência), e o Método avisa que os termos seguem as categorias do IBGE.
  - **DA-4** (revista em 2026-10-16, a pedido do mantenedor: "plataforma que agrega diversos prêmios"): o padrão de toda parte são **todos os prêmios**. `filtroDeTexto`/`filtroParaTexto` recebem a lista de prêmios como padrão; o texto `~p:` só vai para a URL quando o recorte não é "todos". Link antigo sem `~p:` passa a abrir com todos. A História guiada ganha um seletor (Todos / cada prêmio), que redesenha os pontos e os textos (`metricas.historia` sobre o recorte escolhido). Perfis de lugar contam todos os prêmios. `premio.ordem` só ordena listas, facetas e a coleta; no JSON, `premio` continua omitido para o 1º da ordem, por economia, sem significado de "principal".
  - **DA-5** (revista em 2026-10-16): título "Quem chega aos prêmios literários?" (o sobretítulo que listava os prêmios saiu em 2026-11-21, a pedido do mantenedor); descrição, rodapés, placeholder da Diadorim, rótulos e o prompt falam de prêmios. Regra de um prêmio só (marcos, anos sem lista pública, júri divulgado, formatos de pódio) aparece com o nome do prêmio. O logotipo vira um hexágono com as sete células de dados (sem cabeça, patas e cauda), mantendo a animação das células. CA-26.15 tem teste de varredura de frases que fixam um prêmio.
- **D37** Portal e módulos (RF-31, DB-1, DB-4). Decisões DB-1 a DB-7 fechadas em 2026-11-20.

  **Uma página por módulo, na raiz de `web/`.** `web/index.html` vira o portal; o painel de prêmios muda para `web/premios.html` (`git mv`, sem reescrever); os módulos novos são `web/leitura.html` e `web/mapeamento.html`. É o mesmo padrão de `metodo.html` (D18): sem etapa de build, todos os caminhos relativos (`style.css`, `app.js`, `dados.json`, imports `./ui.js`) continuam valendo. Ficou de fora pôr cada painel numa pasta (`/premios/painel/`): exigiria trocar todos os caminhos relativos por absolutos e mexeria nas pastas que o `seo.py` gera e limpa (`PASTAS`). As páginas estáticas (`/premios/`, `/leitura/`, `/mapeamento/`) continuam sendo do `seo.py`, para buscadores, e cada uma leva ao painel do módulo.

  **Links antigos (CA-31.3).** O hash não chega ao servidor, então redirecionamento do Netlify não resolve. O portal tem, no `<head>`, um script inline (`<script id="rotas-antigas">`, antes da primeira pintura) que faz `location.replace("premios.html" + location.search + location.hash)` quando a URL tem qualquer parâmetro (`?panorama=…`, `?funil=…`, `?code=` do PKCE antigo) ou um hash que não é âncora do próprio portal (`#/pessoa/…`, `#/grafico/…`, `#panorama`, `#autores`…). O teste extrai o script do HTML e o roda no Node com uma tabela de URLs antigas e novas.

  **Etapa 0 (CA-31.1).** Só a mudança de página, sem dado novo: os testes atuais passam, apontando para `premios.html` onde liam `index.html`; o marcador `<!-- build:numeros -->` vai junto para `premios.html`. Nada em `dados.json`, `v_participacao` ou nas páginas estáticas muda, além dos links "abrir no painel" (`/#/pessoa/<id>` → `/premios.html#/pessoa/<id>`) e da navegação do `seo.py` (`NAV`).

  **Portal (CA-31.2).** HTML estático, sem `dados.json`: os números de cada módulo são gravados pelo build entre `<!-- build:portal -->` e `<!-- /build:portal -->`, como já se faz com `build:numeros` (D32). Cartão de módulo sem dado não é gravado. Prêmios: pessoas-autoras distintas e prêmios; Leitura: indicadores e territórios com valor; Mapeamento: livrarias ativas e autoras e autores mapeados. A única JS do portal é o tema e a busca.

  **Cabeçalho (CA-31.4).** Uma fonte só: `seo.cabecalho(atual)` gera o bloco (logotipo, módulos, Método, busca, tema e a barra de progresso), as páginas estáticas o usam no molde e `seo.gravar_cabecalhos` o grava nas páginas escritas à mão a cada build (troca o `<header class="barra">` inteiro; `PAGINAS_CABECALHO` diz o item atual de cada uma). Links e `busca.json` usam caminhos absolutos, para valer em qualquer pasta; as páginas estáticas ganham o módulo de tema e busca. `test_cabecalho_igual_em_todas_as_paginas` exige o mesmo bloco em todas, fora o `aria-current`.

  **Busca (CA-31.5).** O build grava `web/busca.json` com as entradas que não dependem de `dados.json` (`{tipo, rotulo, sub, href}`, `href` absoluto para a página do módulo): municípios, indicadores, livrarias, clubes, pessoas e editoras (nome e UF · ano, para o portal e os outros módulos acharem gente da base). `busca.js` carrega o arquivo no primeiro foco do campo e pontua com o mesmo `metricas.buscar`. Em `premios.html`, o índice rico de `metricas.indiceBusca(D)` continua, e as entradas de `busca.json` com o mesmo `href` são descartadas.

  **Diadorim por módulo (CA-31.7).** `<body data-modulo="premios|leitura|mapeamento">`. O build grava `web/contexto-<módulo>.json` (`{tabelas, views, sistema}`, de `build.modulos_banco` e `build.prompt_sistema(con, modulo)`: regras gerais, regras do módulo e DDL só das tabelas dele); cada Parquet continua um arquivo só em `web/banco/`, e `views.sql` tem todas as views (o navegador cria só as do módulo). `banco.js` carrega só as tabelas do módulo da página, cria só as views dele e trava a configuração como hoje (D26). O portal não tem Diadorim. Perguntas que cruzam módulos ficam para depois (o território comum já permite).

  **Dados por módulo (CA-31.8).** Prêmios: `dados.json` e partes, como hoje. Leitura: `leitura.json` + `leitura/<UF>.json` (D39). Mapeamento: `mapeamento/<código do município>.json` (D40). `test_json_real_menor_que_1mb` passa a percorrer todo JSON que uma página carrega na abertura.

  **Textos (CA-31.6).** `FIXAM_UM_PREMIO` ganha as frases que reduzem a plataforma a prêmios (título "Quem chega aos prêmios literários?" fora de `premios.html`, "plataforma de prêmios"), e a varredura inclui as páginas novas. `premios.html` mantém "Quem chega aos prêmios literários?" como título do módulo.

- **D38** Território (RF-32).

  **Tabela.** `territorio (codigo TEXT PRIMARY KEY, tipo ∈ {pais, regiao, uf, municipio}, nome, sigla, pai, populacao_2022)`. Os códigos não colidem entre níveis: país ISO alfa-2 (`BR`), região do IBGE com 1 dígito (`1`–`5`), UF com 2 (`42`), município com 7 (`4205407`); `pai` aponta o nível acima (município → UF → região → `BR`). `dados/territorio.csv` é gerado por `coleta.py territorio` a partir de `servicodados.ibge.gov.br/api/v1/localidades/municipios` (com UF e região aninhadas) e da população do Censo 2022 do mesmo agregado já usado em `uf_populacao.csv` (4709, variável 93), no nível `N6[all]`. Por `curl`, por causa do certificado do Python do python.org (CLAUDE.md). Checagens do build: 27 UFs, 5 regiões, todo município com UF existente, população não nula.

  **A tabela `uf` fica.** O módulo Prêmios continua lendo `uf` (sigla, região, `EX`), e a etapa 0 não muda. O build confere que sigla, nome, região e população das 27 UFs batem entre `uf` e `territorio`. ponytail: dado duplicado nas 27 UFs; trocar `uf` por uma view sobre `territorio` quando outro módulo precisar de `EX` ou quando a duplicação incomodar.

  **Código do município nos prêmios (CA-32.3), calculado no build, não gravado.** A view `v_pessoa_municipio (pessoa_id, codigo)` casa `pessoa.municipio_nascimento` + `uf_nascimento` com `territorio` por nome normalizado (`strip_accents(lower(...))`, sem hífen e apóstrofo), e o mesmo vale para `v_editora_municipio`. Exceções (grafia antiga, distrito que virou município, "Desterro") ficam em `dados/municipio_casamento.csv` (`municipio, uf, codigo, observacao`; decisão humana, como os casamentos de pessoa). Nome que não casa nem tem exceção vira aviso do build, com a lista. Calcular em vez de gravar evita mexer em `pessoa.csv`, que `aplicar_pessoas` reescreve a partir de vários arquivos (o último vence). `v_participacao` não muda. O build grava `web/pessoa-municipio.json` (`{pessoa_id: código}`, ~30 KB), carregado só quando um perfil de pessoa abre: o `dados.json` já está com 992 KB e não comporta o código em `pessoas[]`. O perfil de pessoa liga o município ao perfil de município.

  **Perfil de município (CA-32.4)** mora em `leitura.html` (`#/municipio/<código>`), onde estão os dados municipais. Bloco de leitura: os indicadores do município, com fonte e ano. Bloco de prêmios: pessoas-autoras nascidas ali (nome, link `premios.html#/pessoa/<id>`), lido de `leitura/<UF>.json`, onde o build põe essa lista curta por município. Bloco de mapeamento: só quando existe `mapeamento/<código>.json`, com os números e o link para `mapeamento.html`. Os perfis de UF e região de `premios.html` (`lugares.js`) ganham o bloco de leitura a partir de `leitura.json`, carregado na abertura do perfil. O nome do município no perfil de pessoa leva a `leitura.html#/municipio/<código>`.

  **Malha (CA-32.5).** `coleta.py malha` ganha a malha municipal por UF: `servicodados.ibge.gov.br/api/v3/malhas/estados/<UF>?intrarregiao=municipio&qualidade=minima&formato=application/vnd.geo+json`, coordenadas com 3 casas, código em `properties.codigo`, gravada em `web/malha/<UF>.json`. O mapa de municípios mostra sempre uma UF por vez; no Brasil inteiro, o mapa é por UF (`br-uf.json`). Ficou de fora uma malha nacional de 5.570 municípios: vários MB, ou TopoJSON e uma biblioteca nova, e um SVG pesado demais para o celular. `test_malha_municipal` confere que cada UF tem os municípios de `territorio`.

- **D39** Módulo Leitura (RF-33).

  **Schema.**
  - `indicador (id, nome, definicao, unidade ∈ {percentual, contagem, media}, tipo_fonte ∈ {censo, registro_administrativo, pesquisa_amostral}, nivel ∈ {brasil, regiao, uf, municipio}, fonte_nome, fonte_url, limitacoes, ordem)`: catálogo editado à mão em `dados/indicador.csv`. `limitacoes` vai para o Método.
  - `recorte (dimensao, categoria, rotulo, ordem)`: o vocabulário do CA-33.2, em `dados/recorte.csv`; `total/total` é a linha sem recorte.
  - `indicador_valor (indicador_id, territorio, ano, dimensao, categoria, valor, numerador, denominador, amostra, margem, suprimido, fonte_url)`, com chave `(indicador_id, territorio, ano, dimensao, categoria)` e FKs para `indicador`, `territorio` e `recorte`. `suprimido = true` com `valor` nulo é o valor que a fonte não publica ou marca como não confiável (CA-33.3). CHECKs: `valor` não nulo quando não suprimido, `numerador <= denominador`, `margem >= 0`. No build: percentual entre 0 e 100; pesquisa amostral exige `amostra`; censo e registro, quando unidade é percentual, exigem numerador e denominador.
  - Um CSV por indicador em `dados/indicador_valor/<indicador_id>.csv`, lido por `read_csv('dados/indicador_valor/*.csv', union_by_name = true)`: um arquivo de centenas de milhares de linhas ficaria ilegível no diff, e cada coleta reescreve só o seu.
  - View `v_indicador`: `indicador_valor` com nome e unidade do indicador, nome, tipo, UF e região do território e `por_100mil = valor / populacao_2022 * 100000` para contagem de estabelecimentos (regra no SQL, D13). O Método avisa que a população é a de 2022, mesmo para contagens de outro ano.

  **Coleta** (`coleta.py leitura <fonte>`). Downloads brutos ficam fora do repositório, em `~/Library/Caches/literadados/<fonte>/`, e não são versionados (o CNPJ tem vários GB). Cada comando agrega e grava só `dados/indicador_valor/<id>.csv`, com `fonte_url` em cada linha. A nota de cada fonte (tabela, arquivo, data do download, armadilhas) vai em `dados/coleta/leitura/LEIA.md`.
  - **`alfabetizacao`** (Censo 2022): API do SIDRA (`servicodados.ibge.gov.br/api/v3/agregados/<tabela>/...`), município (`N6`), UF, região e Brasil, total e por sexo, cor ou raça e faixa etária. A tabela é identificada na coleta e anotada no LEIA. Numerador = pessoas alfabetizadas de 15 anos ou mais; denominador = pessoas de 15 anos ou mais.
  - **`escolas_biblioteca`** (Censo Escolar): microdados do INEP por ano, lidos com DuckDB (`;`, latin-1). Escolas em atividade, por município e rede (`TP_DEPENDENCIA`: federal, estadual e municipal → pública; privada → privada). Numerador = escolas com biblioteca ou sala de leitura; denominador = escolas em atividade. A coluna `IN_BIBLIOTECA_SALA_LEITURA` existe com o mesmo nome em todos os anos de 2015 a 2024 (conferido nos cabeçalhos). Últimos 10 anos disponíveis (2025 ainda não publicado em nov/2026); `fonte_url` = o arquivo do ano no INEP. O código de município do INEP já é o do IBGE.
  - **`livrarias_cnpj`, `editoras_cnpj`** (Receita Federal): arquivos `Estabelecimentos*` do mês da coleta, filtro `situacao_cadastral = 02` (ativa) e CNAE principal (4761-0/01; 5811-5/00 e 5821-2/00). Armadilha: o município da Receita usa o código do SIAFI/TOM, não o do IBGE. O de-para é pelo nome + UF da tabela de municípios da própria Receita contra `territorio`, com exceções em `dados/coleta/leitura/cnpj_municipios.csv`, e o comando falha se sobrar município sem código. Ano = ano do arquivo. Contagem por município, UF, região e Brasil.
  - **`leitores`, `livros_por_ano`** (Retratos da Leitura): transcrição das tabelas do relatório de cada edição (PDF, `pypdf`), com a página em `fonte_url` (`…pdf#page=N`), a amostra e a margem de erro declaradas na edição. Brasil e regiões, por sexo, cor ou raça, faixa etária e escolaridade. Duas conferências: a soma das categorias de cada recorte com o total, ponderada quando a edição dá os pesos, e a releitura de uma amostra de linhas contra o PDF.
  - Fonte que não tiver o nível territorial ou o recorte do CA-33.4 sai da leva, com o motivo no LEIA e no Método (nota do spec).

  **`leitura.json` e `leitura/<UF>.json`.** `leitura.json`: `indicadores`, `recortes`, `territorios` (Brasil, regiões, UFs), `valores` só de Brasil, regiões e UFs, compactos como no D13 (`[indicador, territorio, ano, dimensao, categoria, valor, numerador?, denominador?, amostra?, margem?]` em lista, chaves de dimensão e categoria por índice em `recortes`) e `cobertura` (CA-33.5). `leitura/municipios/<UF>.json`: municípios da UF (código, nome, população) e as pessoas-autoras nascidas em cada município (D38); `leitura/<indicador>/<UF>.json`: os valores municipais de um indicador, no mesmo formato (um arquivo único por UF passaria de 1 MB em MG). Carregados quando o mapa desce para a UF ou um perfil de município abre; `leitura.json` lista em `por_uf` os pares existentes. Cada arquivo < 1 MB (`test_json_real_menor_que_1mb`). `metricas.expandirLeitura` remonta as linhas de `v_indicador`; paridade testada no Node contra o DuckDB, como `test_json_compacto_reconstroi_v_participacao`.

  **Painel (`leitura.html`, `leitura.js`).**
  - Controles: indicador, ano (só os que têm valor), recorte (só os que o indicador tem) e território. Mapa: `br-uf.json` no Brasil e `malha/<UF>.json` numa UF, com uma função coroplética própria em `leitura.js` (a de `mapa.js` é acoplada às métricas dos prêmios e ficou como está). Indicador só de Brasil e regiões (Retratos) vira barras por região. Dica e tabela equivalente com valor, n (amostra) ou numerador e denominador, ano e fonte. Suprimido aparece como "não publicado pela fonte", com hachura, nunca como zero.
  - Série temporal (`Plot.line` + `Plot.dot`, faixa de margem com `Plot.areaY` quando houver) e comparação por recorte (`Plot.barX`, com a margem como `Plot.ruleX`). Dois indicadores nunca dividem um eixo (CA-33.3): cada gráfico é de um indicador só.
  - Estado na URL (CA-33.7): `?i=<indicador>&a=<ano>&r=<dimensao>&t=<territorio>`, padrão omitido, por `metricas.leituraParaTexto`/`leituraDeTexto` (puras, ida e volta testadas). Números de `metricas.valoresLeitura(linhas, filtro)` e `metricas.serieLeitura`, puras e testadas.
  - Rota `#/municipio/<código>` (D38) e `#/uf/<UF>` no `<dialog>` de perfil, como em `premios.html`.

  **Páginas estáticas e Método (CA-33.8).** `seo.py` gera `/leitura/` (lista de indicadores, com definição e fonte) e `/leitura/<indicador>/` (tabela por UF no ano mais recente, com n e fonte, e JSON-LD `Dataset`); `PASTAS` ganha `leitura`. As páginas `/estados/<UF>/` ganham o bloco de leitura. `/dados-abertos/` lista `indicador_valor` (um CSV por indicador). `metodo.html` ganha a seção "Leitura", montada de `leitura.json` (definição, tipo de fonte, nível, anos, limitações, cobertura).

  **Diadorim (CA-31.7).** Módulo `leitura`: tabelas `territorio`, `indicador`, `recorte`, `indicador_valor` e a view `v_indicador`. Regras no prompt: dizer o ano e a fonte de todo número; amostral com margem; nunca comparar indicadores de definições diferentes como se fossem a mesma medida; contagem de CNPJ é presença declarada, não censo de livrarias; cor ou raça é a autodeclaração do respondente, nas categorias do IBGE.

- **D40** Módulo Mapeamento, Florianópolis (RF-34, DB-2, DB-3, DB-5, DB-6).

  **Armadilha que decide o desenho.** `coleta.py normalizar` reescreve `obra.csv`, `autoria.csv` e `editora.csv` inteiros a partir das listas dos prêmios, e grava só as editoras usadas. Obra ou editora de Florianópolis escrita direto nesses CSVs sumiria no próximo `normalizar`. Por isso o mapeamento entra **pelo `normalizar`, como mais uma fonte**, depois de todos os prêmios (os ids atuais não mudam), com o mesmo casamento de pessoa e de obra (CA-26.5, CA-34.1).

  **Coleta bruta** em `dados/coleta/mapeamento/<código do município>/` (hoje só `4205407/`), escrita sempre pelo módulo `csv`:
  - `obras.csv`: `titulo, autores, ilustradores, organizadores, editora, ano, isbn, ambientada, fonte, verificado_em, observacao` (nomes separados por `|`, como nas listas). `ambientada = 1` exige uma fonte que diga isso.
  - `editoras.csv`: `nome, tipo, municipio_sede, site, situacao, ano_encerramento, fonte, verificado_em`.
  - `pessoas.csv`: `nome, vinculo (= atuacao), fonte, verificado_em`. O vínculo de nascimento não é coletado aqui: sai do município de nascimento da pessoa (D38). Gênero, raça e nascimento seguem os `pessoas_*.csv` de sempre (`aplicar_pessoas`), com arquivos `pessoas_floripa_N.csv`.
  - `casamentos.csv` e `obras_casamentos.csv`: as mesmas decisões humanas dos prêmios (D31). O agente registra em `casamentos.csv` toda pessoa que já está na base, mesmo com grafia igual (aprendizado da ABL no CLAUDE.md).
  - `LEIA.md`: o protocolo de coleta (definições do CA-34.4 a CA-34.8, fontes, privacidade).

  **O que o `normalizar` grava.** Obras e editoras do mapeamento entram em `obra.csv` e `editora.csv` (e contam como usadas). O crédito vai para uma tabela própria, `mapeamento_autoria (obra_id, pessoa_id, papel)`: `autoria` tem `premio_id` na chave e FK para `premio` (crédito por prêmio, D31), e pôr o mapeamento em `premio` o faria aparecer como prêmio no painel. As tabelas novas são `obra_mapeada (obra_id, municipio, isbn, ambientada, fonte, verificado_em)`, `editora_mapeada (editora_id, municipio, tipo, site, situacao, ano_encerramento, fonte, verificado_em)` e `pessoa_atuacao (pessoa_id, municipio, fonte, verificado_em)`. Uma obra do mapeamento que também foi indicada a um prêmio é um registro só: os dois créditos convivem, cada um na sua tabela.

  **Livrarias e clubes** não dependem de pessoa nem de obra, então são editados direto em `dados/livraria.csv` e `dados/clube.csv` (como `premio.csv`), com id em slug:
  - `livraria (id, nome, municipio, tipo ∈ {geral, sebo, especializada, cafe_livraria, online}, foco, rede BOOL, endereco, bairro, lat, lon, site, redes, situacao, ano_abertura, ano_encerramento, fonte, verificado_em)`. CHECKs: `online` sem endereço nem coordenadas; os outros tipos com bairro; `especializada` com foco; `encerrada` pode ter `ano_encerramento`.
  - `clube (id, nome, municipio, formato ∈ {presencial, online, hibrido}, periodicidade, foco, aberto BOOL, organizacao, local_tipo ∈ {livraria, biblioteca, cafe, espaco_publico, casa, online}, livraria_id, local_nome, bairro, lat, lon, link, situacao, fonte, verificado_em)`. CHECKs de privacidade (DB-6): `local_tipo = 'casa'` exige `bairro`, `lat`, `lon` e `local_nome` nulos; `local_tipo = 'livraria'` exige `livraria_id` (FK), e as coordenadas vêm da livraria; `organizacao` é o nome da instituição ou `independente`, nunca o nome de uma pessoa (conferido na revisão, já que o CHECK não distingue).
  - Candidatas: `coleta.py mapeamento candidatas <código>` cruza os CNPJs ativos com CNAE 4761-0/01 no município (o mesmo arquivo do D39) com os pontos `shop=books` do OpenStreetMap (Overpass API, uma consulta por município), e grava `dados/coleta/mapeamento/<código>/candidatas.csv` para a conferência humana. Só vira linha de `livraria.csv` o que a conferência confirmar (CA-34.4). Coordenadas: do próprio ponto do OSM ou do Nominatim pelo endereço (1 pedido por segundo, User-Agent só com o nome e a URL do projeto, sem e-mail; CLAUDE.md 2026-10-17).

  **Vínculos são regra no SQL** (D13), na view `v_vinculo (entidade, entidade_id, municipio, tipo, fonte)`:
  - pessoa `nascimento`: o código de `v_pessoa_municipio` (D38), fonte `nascimento_fonte`;
  - pessoa `atuacao`: `pessoa_atuacao`;
  - obra `autoria`: autor ou ilustrador com vínculo de pessoa, por `autoria` ou `mapeamento_autoria`;
  - obra `editora`: obra (ou indicação) com editora sediada no município, pela editora da obra, por `v_editora_municipio`;
  - obra `ambientacao`: `obra_mapeada.ambientada`.
  Assim, quem nasceu em Florianópolis e já está nos prêmios (como Edla Van Steen) aparece no mapeamento sem nova coleta. Para entrar nas listas do módulo, a pessoa precisa de vínculo e de ao menos uma obra na base (CA-34.6). O build falha com `obra_mapeada` ou `pessoa_atuacao` sem fonte ou sem `verificado_em`, e com vínculo apontando para município sem `territorio`.

  **`mapeamento/<código>.json`.** `municipio`, `livrarias`, `clubes`, `editoras` (com tipo e situação), `pessoas` (só as que têm vínculo: id, nome, gênero e evidência, raça e evidência, ano de nascimento, vínculos com fonte, se está nos prêmios), `obras` (título, ano, editora, ISBN, autoria, vínculos, capa quando houver em `capas.json`) e `verificado_ate` (a data mais recente). Sem campo que o painel não mostre (CA-34.12). `metricas.resumoMapeamento(M)` é pura e testada: contagens por critério de vínculo (nascimento, atuação, os dois), livrarias ativas por tipo, % de mulheres e piso de pessoas negras com n, "a conferir" (verificação com mais de 12 meses, a partir da data de geração, para o número não mudar sozinho no navegador).

  **Painel (`mapeamento.html`, `mapeamento.js`).**
  - Mapa da cidade sem mapa de fundo de terceiros: `coleta.py malha_cidade <código>` grava `web/malha/<código>.json` (~110 KB) com o contorno do município, os distritos (`admin_level=9`), as lagoas e os municípios vizinhos do OpenStreetMap. O Overpass acha as relações, e o Nominatim devolve a geometria já simplificada (`polygon_threshold=0.0002`). O arquivo fica em `web/malha/` porque o build limpa `web/mapeamento/*.json`. Sem esse arquivo, o mapa volta ao polígono mínimo do IBGE. O desenho é `d3.geoIdentity().reflectY(true)`, nunca `geoMercator`: a projeção esférica lia o contorno do IBGE ao avesso. O zoom é `d3.zoom` (1–12×). Raio, fonte e espessura são divididos por k em estilo em linha, porque o CSS dos gráficos venceria o atributo. Rótulo de distrito aparece quando cabe e não colide com o de um distrito maior. Os pontos são livrarias e clubes presenciais, por cor de tipo e com dica; cada um leva ao perfil, que traz o link "ver no OpenStreetMap". Cumpre o RNF-09 sem chave, sem biblioteca nova e sem pedido a servidor de terceiros durante a navegação. ponytail: sem ruas no mapa; se a falta de ruas atrapalhar, trocar por Leaflet 1.9.4 com tiles do OSM, respeitando a política de uso dos tiles.
  - A lista equivalente fica ao lado do mapa (RNF-05): livrarias e clubes com os mesmos filtros (tipo, situação, formato). Abaixo, abas Editoras, Autoras e autores e Obras, com busca e filtros (vínculo, tipo, situação), pela mesma `ui.tabela` com exportação.
  - Perfis no `<dialog>` do módulo: `#/livraria/<id>`, `#/clube/<id>`, `#/pessoa/<id>`, `#/obra/<id>`, `#/editora/<id>`, cada um com o vínculo, a fonte, `verificado_em` e o selo "a conferir" quando for o caso. Pessoa, obra e editora que estão nos prêmios ganham o link `premios.html#/pessoa/<id>` (ou `obra`, `editora`). No `premios.html`, o perfil de pessoa, obra e editora com vínculo ganha o bloco "Em Florianópolis", com link para `mapeamento.html#/…`, a partir de `mapeamento/indice.json` (`{pessoa|obra|editora: {id: [códigos]}}`), carregado só quando um perfil abre: o `dados.json` está perto de 1 MB.
  - Os textos de número sempre dizem o critério e "mapeados até agora · conferido até <data>" (CA-34.10).

  **Sugerir, corrigir, sair (CA-34.11, DB-5).** Netlify Forms: `<form name="mapeamento" method="POST" data-netlify="true" netlify-honeypot="campo-isca">` no HTML estático de `mapeamento.html`. Campos: pedido (`sugerir`, `corrigir`, `remover`), tipo de registro, nome do registro, descrição, fonte (URL) e contato (opcional, com o aviso de para que serve). O envio vai para uma página estática de agradecimento. Os envios ficam no painel do Netlify, com aviso por e-mail ao mantenedor, que revisa e edita os CSVs. Nada é publicado sozinho. Exige ligar a detecção de formulários no Netlify (tarefa do mantenedor). No `server.py` local o formulário não envia, e a página diz isso quando aberta em `localhost`. Pedido de remoção de pessoa: as linhas saem de `pessoas.csv`, `obras.csv` (ou só o crédito) e `pessoas_floripa_*.csv`, e o id vai para `dados/coleta/mapeamento/<código>/remocoes.csv`, que o `normalizar` respeita, para a pessoa não voltar numa coleta futura.

  **Páginas estáticas (CA-34.12).** `seo.py` gera `/mapeamento/` (municípios mapeados, hoje só um), `/mapeamento/florianopolis/` (as listas, com o critério e a data), `/mapeamento/florianopolis/livrarias/<id>/` (JSON-LD `BookStore`, com endereço só de estabelecimento) e `/mapeamento/florianopolis/clubes/<id>/` (JSON-LD `Organization`, sem endereço de casa). `PASTAS` ganha `mapeamento`. As páginas de pessoa existentes (`/pessoas/<id>/`) ganham o vínculo. Quem só está no mapeamento ganha página em `/mapeamento/<cidade>/pessoas/<id>/` (fora de `/pessoas/`, que é a lista de quem chegou aos prêmios), com as mesmas regras de raça e gênero (CA-27.3). `/dados-abertos/` lista `livraria.csv`, `clube.csv` e um CSV de pessoas e obras mapeadas, só com os campos que o painel mostra.

  **Diadorim (CA-31.7).** Módulo `mapeamento`: `territorio`, `pessoa`, `obra`, `editora`, `livraria`, `clube`, `obra_mapeada`, `editora_mapeada`, `pessoa_atuacao`, `mapeamento_autoria` e as views `v_vinculo` e `v_pessoa_municipio`. Regras no prompt: é cadastro, não censo ("mapeados até agora"); dizer o critério de vínculo; não dar endereço de clube que não tenha local público; raça e gênero como no módulo Prêmios.

- **D41** Módulo Eventos literários (RF-35, DB-8 a DB-10).

  **Schema.** `evento (id, nome, tipo, municipio → territorio, organizador, site, redes, ano_inicio, fonte, verificado_em)` e
  `evento_edicao (evento_id, numero, ano, data_inicio, data_fim, municipio → territorio, local, tema, situacao, formato, publico,
  publico_fonte, fonte, verificado_em)`, com chave `(evento_id, data_inicio)`. CHECKs: `data_fim >= data_inicio`, `ano = year(data_inicio)`,
  `publico` só com `publico_fonte`. No build: `prevista` com `data_fim` antes de `verificado_em` e `realizada` com `data_inicio` depois
  de `verificado_em` falham (DB-10). Homenageados em `evento_homenageado (evento_id, data_inicio, nome, pessoa_id)`: `pessoa_id` só
  quando o slug do nome é exatamente o id de uma pessoa da base (casamento conservador; o resto fica só com o nome, CA-35.2).
  View `v_evento_edicao`: edição com nome e tipo do evento, nome e UF do município.

  **Coleta.** Agentes gravam `dados/coleta/eventos/eventos_N.csv` e `edicoes_N.csv` (um par por agente, sem colisão; protocolo em
  `dados/coleta/eventos/LEIA.md`). `coleta.py eventos` junta os lotes em `dados/evento.csv`, `evento_edicao.csv` e
  `evento_homenageado.csv`: id do evento em slug do nome; município por nome + UF contra `territorio` (sem acento, caixa e
  pontuação), com exceções em `dados/coleta/eventos/municipios.csv`; o comando falha listando o que não casa.

  **`eventos.json`.** `{gerado_em, verificado_ate, eventos: [...], edicoes: [...], municipios: {código: [nome, UF]}, homenageados: [...]}`,
  sem chaves nulas (D13); pequeno (centenas de edições), carregado inteiro. Funções puras em `metricas.js`: `proximosEventos(edicoes,
  hoje)`, `resumoEventos(J, hoje)`, `filtrarEventos(edicoes, filtro)` e
  `eventosParaTexto`/`eventosDeTexto` (URL `?tipo=&uf=&ano=&sit=`, padrão fora da URL). "Hoje" é parâmetro: o navegador passa a
  data local, os testes passam uma data fixa.

  **Painel (`eventos.html`, `eventos.js`).** Próximos eventos (cartões), números, filtros, gráfico de tempo do ano (`Plot.barX` de
  `inicio` a `fim + 1 dia`, uma linha por edição em ordem de data, grade mensal, `Plot.ruleX` em hoje; a tabela de edições é a
  alternativa acessível), mapa por UF (`br-uf.json`, projeção plana, contagem de edições no ano, tabela equivalente), tabela de edições exportável e
  perfil `#/evento/<id>` com a linha do tempo das edições (`Plot.dot` por ano, cor pela situação). O perfil de município
  (`leitura.html`) e a página do mapeamento da cidade leem `eventos.json` sob demanda e listam os eventos do município.

  **Páginas estáticas.** `/eventos/` (próximos e por UF) e `/eventos/<id>/` com JSON-LD `Event` por edição (`eventStatus`
  `EventScheduled`, `EventCancelled`, `EventPostponed`; `location` `Place` com cidade e UF). `PASTAS` ganha `eventos`.
  Busca (`busca.json`), cartão do portal, cabeçalho (`MODULOS`), dados abertos e Diadorim (`contexto-eventos.json`) como nos outros módulos.

  **Segunda leva e panorama (CA-33.9, CA-33.10, 2026-11-21).** `indicador` ganha `tema` (`habitos`, `alfabetizacao`, `escola`, `mercado`,
  `bibliotecas`) e a unidade aceita `moeda` (R$ correntes do ano) e `pontuacao` (escala da avaliação). Fontes transcritas de PDF ou
  planilha chegam por agentes em `dados/coleta/leitura/<fonte>.csv` (mesmo formato de `retratos.csv`, mais `numerador`/`denominador`) com o
  catálogo proposto em `<fonte>_indicadores.csv`; `coleta.py leitura arquivo <fonte>` converte (protocolo em `dados/coleta/leitura/PROTOCOLO.md`).
  A PNAD Contínua sai da API do SIDRA (`coleta.py leitura pnad`). O panorama é desenhado de `leitura.json` (só Brasil): um cartão por
  indicador do tema, com o último valor e `Plot.line` pequeno da série.

- **D42** Atualização automática dos dados públicos, sem publicar sozinha (2026-11-21).

  **O quê.** GitHub Actions `.github/workflows/atualizar-dados.yml`, mensal (cron `0 9 1 * *`) e manual (`workflow_dispatch`).
  Ubuntu, Python 3.14, `requirements.txt`; roda `coleta.py territorio`, `leitura alfabetizacao`, `leitura pnad` e
  `malha_cidade 4205407`, depois `build.py`, e abre (ou atualiza) um PR do ramo `atualizar-dados` com `peter-evans/create-pull-request`.
  O PR ganha a prévia de deploy do Netlify; o site só muda no merge para `main`, por decisão humana.

  **Critério para ser automático.** Coleta de API pública, sem cota nem login, que reescreve o arquivo inteiro e cujo resultado o
  build consegue checar: IBGE (localidades, SIDRA 4709, 9542, 7113, 7125) e OpenStreetMap (Overpass + Nominatim, 1 pedido/s).
  User-Agent `Literadados (https://literadados.gustavosimas.com)`, nunca e-mail (já é o `UA` de `coleta.py`).

  **Fica manual.** Tudo o que pede julgamento ou transcrição: listas de prêmios, raça por autodeclaração, Retratos da Leitura,
  INAF, SAEB, PISA, mercado do livro, SNBP/MUNIC (`leitura arquivo`), mapeamento e eventos. Também `leitura cnpj` (base do CNPJ
  da Receita, vários GB, pré-filtrada fora do repositório) e `leitura escolas_biblioteca` (microdados do Censo Escolar, ~10 ZIPs
  anuais de dezenas a centenas de MB), que leem de `CACHE` (`~/Library/Caches/literadados` no macOS, `~/.cache/literadados` no
  Linux) e mudam uma vez por ano; e `malha`/`malha_municipios` (só com malha nova do IBGE).

  **Falhas.** Coleta com erro ou `BuildError` (`build.py` sai com 1 e imprime `ERRO: ...`) deixam o job vermelho e não abrem PR.
  Como o build carimba `gerado_em` nos JSON, o PR só é aberto quando `dados/` ou `web/malha/` mudaram depois das coletas.
  O workflow só vale para o que está em `main` (agendamento do GitHub usa o ramo padrão). O repositório precisa permitir que o
  GitHub Actions crie pull requests (Settings → Actions → General).
