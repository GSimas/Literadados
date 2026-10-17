<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/literadados-logo-escuro.png">
    <img src="docs/literadados-logo.png" width="420" alt="Literadados: logotipo (um hexágono com sete células hexagonais de dados) e o nome Literadados">
  </picture>
</p>

<p align="center"><b>Quem chega aos prêmios literários?</b><br>
Plataforma de dados abertos sobre gênero, raça autodeclarada e local de nascimento de quem escreveu as obras indicadas a prêmios literários de língua portuguesa, lado a lado. Hoje a base tem o Prêmio Jabuti (1959–2025) e o Prêmio Oceanos (2003–2025): painel interativo, perfis de pessoas, livros, editoras, edições e lugares, história guiada, páginas para buscadores e IAs, e uma IA que responde perguntas com SQL sobre a base.</p>

<p align="center">
  <a href="https://literadados.gustavosimas.com"><img alt="Site no ar" src="https://img.shields.io/website?url=https%3A%2F%2Fliteradados.gustavosimas.com&label=literadados.gustavosimas.com&up_message=no%20ar&down_message=fora%20do%20ar"></a>
  <a href="https://literadados.gustavosimas.com"><img alt="Deploy no Netlify" src="https://api.netlify.com/api/v1/badges/71004ad7-14d2-473b-8ac2-5244594d3421/deploy-status"></a>
  <a href="https://github.com/GSimas/Literadados/commits/main"><img alt="Último commit" src="https://img.shields.io/github/last-commit/GSimas/Literadados?label=%C3%BAltimo%20commit"></a>
  <a href="https://github.com/GSimas/Literadados"><img alt="Tamanho do repositório" src="https://img.shields.io/github/repo-size/GSimas/Literadados?label=reposit%C3%B3rio"></a>
  <br>
  <img alt="Python 3.14" src="https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white">
  <img alt="DuckDB 1.5" src="https://img.shields.io/badge/DuckDB-1.5-FFF000?logo=duckdb&logoColor=black">
  <img alt="DuckDB-WASM 1.32" src="https://img.shields.io/badge/DuckDB--WASM-1.32-FFF000?logo=webassembly&logoColor=black">
  <img alt="Observable Plot 0.6" src="https://img.shields.io/badge/Observable%20Plot-0.6-3167B1">
  <img alt="d3 7.9" src="https://img.shields.io/badge/d3-7.9-F9A03C?logo=d3dotjs&logoColor=white">
  <img alt="JavaScript sem build" src="https://img.shields.io/badge/JavaScript-m%C3%B3dulos%20ES%2C%20sem%20build-F7DF1E?logo=javascript&logoColor=black">
  <img alt="Node 24 para testes" src="https://img.shields.io/badge/Node-24%20(testes)-339933?logo=nodedotjs&logoColor=white">
  <br>
  <img alt="Testes: pytest e node:test" src="https://img.shields.io/badge/testes-pytest%20%2B%20node%3Atest-0f6b4f">
  <img alt="Acessibilidade: axe-core WCAG 2.1 AA" src="https://img.shields.io/badge/a11y-axe--core%20WCAG%202.1%20AA-0f6b4f">
  <img alt="Spec-Driven Development" src="https://img.shields.io/badge/m%C3%A9todo-SDD%20(spec%20%E2%86%92%20design%20%E2%86%92%20tarefas)-0f6b4f">
  <img alt="Dados abertos" src="https://img.shields.io/badge/dados-abertos%2C%20com%20fonte-0f6b4f">
  <img alt="SEO, AEO e GEO" src="https://img.shields.io/badge/SEO%20%C2%B7%20AEO%20%C2%B7%20GEO-sitemap%20%C2%B7%20JSON--LD%20%C2%B7%20llms.txt-0b5c43">
</p>

---

## Estado atual (out/2026)

| | |
|---|---|
| Prêmios | **Prêmio Jabuti**: 67 edições (1959–2025; listas públicas de 2000 em diante, antes só os premiados), 1.675 indicações, 1.021 pessoas-autoras. **Prêmio Oceanos**: 23 edições (2003–2025), 1.088 indicações, 642 pessoas-autoras |
| Base toda | 2.763 indicações em 2.498 obras; **1.411 pessoas-autoras** distintas (252 passaram pelos dois prêmios), 124 ilustradoras, 24 organizadoras e 225 juradas (há quem tenha mais de um papel); 430 editoras |
| Gênero (autoras) | 986 com fonte, **394 atribuídos pelo primeiro nome** (marcados com \*), 31 não identificados |
| Nascimento (autoras) | 732 com UF no Brasil, 112 nascidas fora do Brasil (com país, quando há fonte) |
| Raça declarada (autoras) | 42 autodeclarações públicas, 29 pessoas negras (piso). Busca do protocolo completa para 1.083 de 1.411 |
| Edições | **90 textos de contexto** (um por edição), no tom de jornalismo literário, com fontes; 26 marcados para revisão humana |
| Perfis | 904 QIDs do Wikidata, 379 fotos com licença livre, 285 capas |
| Fontes citadas | 187 domínios, agrupados na seção Referências |
| Páginas para buscadores e IAs | 2.232 URLs no `sitemap.xml` (prêmios, edições, pessoas, editoras, estados, perguntas, dados abertos) |

Categorias no recorte: Romance, Contos, Crônica, Poesia, Infantil, Juvenil, Infantil e Juvenil e Livro do Ano (no Jabuti), e a categoria única, Romance, Poesia, Conto/Crônica, Prosa e o Grande Prêmio (no Oceanos); detalhes por ano no Método. O painel abre com todos os prêmios na série completa de cada um; cada parte tem filtro de prêmio, período e categoria, e os gráficos de taxa mostram um painel por prêmio.

## O que o painel mostra

- **Abertura:** a pergunta central e três números do recorte completo, com um carrossel de fotos livres ao fundo.
- **História guiada:** um ponto por pessoa-autora, que se reorganiza a cada passo: gênero, da lista ao 1º lugar, piso racial e região de nascimento. Um seletor escolhe todos os prêmios (padrão) ou um deles.
- **Panorama:** cartões com n, cobertura e a faixa de edições coletadas. Cada ano da faixa abre o perfil da edição.
- **Gráficos:** uma grade de cartões. Cada cartão abre uma janela com endereço próprio (`#/grafico/<id>`): linha do tempo (composição de cada edição e vencedoras), mapa por UF de nascimento (absoluto ou por milhão de habitantes) com Sankey região → editora → resultado, evolução por edição, funil (lista → finalistas → premiadas → vencedoras), categorias (índice de Duncan), idade no ano do prêmio, editoras e júri. No hover, o elemento sob o mouse fica em destaque e os demais esmaecem.
- **Autores:** um anel de retratos ao redor de um centro vazio e circular, com 100 por página e setas laterais. No hover, o retrato brilha e o centro mostra o resumo da pessoa; o clique abre o perfil completo, com link próprio (`#/pessoa/<id>`) e a fonte de cada atributo. Há também a vista em tabela, com busca e ordenação.
- **Diadorim:** a IA do Literadados, num botão flutuante no canto da tela. O login é com a conta do OpenRouter (PKCE). O padrão é o roteador gratuito `openrouter/free`, e qualquer modelo do OpenRouter pode ser escolhido na configuração, numa lista buscada ao vivo com preço, contexto e suporte a ferramentas. Ela consulta o banco com SQL somente leitura e mostra ao vivo os passos (consultas e linhas devolvidas). Cada mensagem traz horário e modelo, e cada resposta traz o SQL usado e um bloco "Onde conferir" montado pelo próprio Literadados: perfis, estados, gráfico relacionado, fontes e Método. Há botão de nova conversa.
- **Busca** no cabeçalho (atalhos `/` e Ctrl/⌘+K): determinística, sem IA, sobre pessoas, livros, editoras, estados, regiões, categorias, edições, gráficos e seções. Cada resultado leva ao perfil (de pessoa, livro, editora, edição ou lugar), ao gráfico ou à seção certa.
- **Perfil de edição** (`#/edicao/jabuti/1968`): texto de contexto histórico e de como foi a premiação, com fontes; números da edição com n e a comparação com a anterior; gráficos de gênero, raça declarada e região (lista × premiadas, com tabela); cada categoria com as obras em ordem de resultado, editora e júri; edição anterior e seguinte.
- **Perfil de editora** (`#/editora/companhia-das-letras`): grupo ou independente, sede, indicações, premiadas e 1º lugares por prêmio, posição entre as editoras, perfil das pessoas-autoras que ela levou à lista, indicações por edição e todas as obras. O nome da editora vira link em todo o painel, e as barras do gráfico de editoras abrem o perfil.
- **Perfil de livro** (`#/obra/<id>`): autoria, ilustração e organização, editora, capa (Open Library ou Google Books, com crédito) e todas as participações.
- **Perfis de estados e regiões** (`#/uf/SP`, `#/regiao/Nordeste`): mapa com o lugar em destaque, números (pessoas-autoras e a parcela do Brasil, indicações, premiadas, % mulheres, piso de % negras, pessoas por milhão de habitantes comparadas à média), parcela por edição e por categoria, pessoas por UF (na região) e a lista de quem nasceu ali.
- **Exportar:** todo gráfico sai como JPG com fundo ou PNG sem fundo (com título, legenda e rodapé), e toda tabela como XLSX ou CSV. O XLSX é gerado no navegador, sem biblioteca.
- **Método e referências** ([`metodo.html`](web/metodo.html)): cobertura por edição, definições, protocolo de raça, gênero atribuído e todas as fontes, agrupadas por domínio.

## Para buscadores e IAs (SEO, AEO, GEO)

O painel é desenhado por JavaScript e os perfis vivem em rotas `#/...`, que buscadores e robôs de IA não indexam. Por isso o build (`seo.py`) gera, a partir dos mesmos dados, páginas estáticas sem JavaScript, com o mesmo visual e um link para o painel:

| Página | Conteúdo |
|---|---|
| [`/premios/`](https://literadados.gustavosimas.com/premios/), `/premios/<prêmio>/`, `/premios/<prêmio>/<ano>/` | Cada prêmio (números por etapa, mais premiados, formatos, edições) e cada edição (vencedores, texto de contexto, números, obras por categoria, júri) |
| [`/pessoas/`](https://literadados.gustavosimas.com/pessoas/), `/pessoas/<id>/` | Pessoas de A a Z; perfil com gênero, raça declarada (trecho e fonte), nascimento e trajetória |
| [`/editoras/`](https://literadados.gustavosimas.com/editoras/), `/editoras/<id>/` | Ranking de editoras; perfil de cada uma |
| [`/estados/`](https://literadados.gustavosimas.com/estados/), `/estados/<UF>/` | Onde nasceram as pessoas-autoras |
| [`/perguntas/`](https://literadados.gustavosimas.com/perguntas/) | Perguntas frequentes respondidas com números da base e n (`FAQPage`) |
| [`/dados-abertos/`](https://literadados.gustavosimas.com/dados-abertos/) | Tabelas para baixar (Parquet e CSV), regras de uso dos números e como citar (`Dataset`) |

Toda página tem título e descrição próprios, URL canônica, Open Graph e dados estruturados JSON-LD (`ProfilePage`/`Person`, `Book`, `Organization`, `ItemList`, `FAQPage`, `Dataset`, `BreadcrumbList`). As regras do painel valem nelas: percentual com n, piso de pessoas negras, raça só com autodeclaração (e nunca no JSON-LD), gênero atribuído marcado. Os números são testados contra o que o painel calcula. O build também grava `sitemap.xml` (o `lastmod` só muda quando a página muda), [`llms.txt`](https://literadados.gustavosimas.com/llms.txt) e [`llms-full.txt`](https://literadados.gustavosimas.com/llms-full.txt), e escreve na abertura (`index.html`) os números reais, para quem lê sem JavaScript. `robots.txt` libera buscadores e robôs de IA.

Não há filtro global. O panorama, cada gráfico e a galeria de autores têm **filtro próprio** (período, categorias e papel), com o resumo do recorte e um botão de CSV. Cada filtro fica na URL (`?funil=2019-2025~Poesia`), e o link pode ser compartilhado. A história e a Diadorim usam o recorte completo.

## Princípios (inegociáveis)

- **Raça só por autodeclaração pública**, ou por fonte curada por identidade (Literafro/UFMG), sempre com URL e trecho literal. Nunca por foto, sobrenome ou IA. O percentual de pessoas negras é um **piso** ("pelo menos"). "Sem declaração" não significa branca.
- **Gênero com fonte** (Wikidata, Wikipédia, biografias). Sem fonte, ele é **atribuído pelo primeiro nome** e aparece com asterisco e nota de rodapé. Apelidos ambíguos e iniciais ficam como "não identificado".
- **Estado = UF de nascimento.**
- **Todo percentual mostra o n.** As séries usam proporções, porque o número de vagas mudou em 2018.
- **Edições sem dados** aparecem como lacuna, nunca como zero.

> **Encontrou um erro?** Os dados atribuídos podem estar errados. Escreva para **contato@gustavosimas.com** com o nome, o dado correto e, se possível, uma fonte pública. A correção entra pelos arquivos de `dados/` e fica registrada.

## Rodar

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # uma vez
.venv/bin/python build.py      # CSVs → literadados.duckdb + web/dados.json + páginas estáticas (falha se o dado for inconsistente)
.venv/bin/python server.py     # http://localhost:8000 (servidor estático só para desenvolvimento)
```

O painel não precisa de chave nenhuma. Para conversar com a Diadorim, clique no botão do canto e entre com sua conta do OpenRouter: a chave fica só no seu navegador.

**No ar:** https://literadados.gustavosimas.com (Netlify, estático). O build gera `web/dados.json`, `web/edicoes.json`, `web/contexto.json`, `web/banco/*.parquet` e as páginas estáticas, e a Diadorim consulta o banco num DuckDB que roda no próprio navegador (DuckDB-WASM). Não há servidor de aplicação. Para publicar: `python build.py`, commit e push para o `main`. O Netlify está ligado ao repositório e publica `web/` a cada push; PRs ganham prévia de deploy.

## Testes

```bash
.venv/bin/python -m pytest -q        # build, checagens, banco do navegador igual ao build, mídia, fontes, páginas estáticas
node --test tests/*.test.mjs         # métricas, perfis de edição e editora, anel, busca, contraste AA, Markdown, SQL, Diadorim, XLSX
```

## Como o projeto é feito (SDD)

Toda mudança de comportamento segue a ordem `spec/spec.md` (requisito e critério de aceitação) → `spec/design.md` (decisão técnica) → `spec/tasks.md` (tarefas) → código. Critérios 🧪 têm teste em `tests/`; critérios 👁 são conferidos no navegador, nos temas claro e escuro e a 375 px.

## Estrutura

| Caminho | O que é |
|---|---|
| `spec/` | Especificação (SDD): requisitos, desenho técnico e tarefas |
| `schema.sql` | Modelo de dados (DuckDB) com CHECKs que barram raça sem fonte, gênero atribuído com fonte etc. |
| `dados/*.csv` | Fonte da verdade, uma tabela por arquivo |
| `dados/coleta/` | Levantamentos brutos (listas por edição, pesquisas de pessoas com `PROTOCOLO_PESSOAS.md`, textos das edições com `contexto/PROTOCOLO.md`) |
| `build.py` | CSVs → `literadados.duckdb` + `web/dados.json` + `web/edicoes.json`, com checagens de consistência |
| `seo.py` | Páginas estáticas, `sitemap.xml`, `llms.txt` e `llms-full.txt` (chamado pelo build) |
| `coleta.py` | `normalizar`, `aplicar_pessoas`, `wikidata`, `verificar` (trechos de raça), `midia` (fotos livres), `miniaturas`, `capas`, `malha` (UFs), `contexto` (textos das edições) |
| `server.py` | Servidor estático para desenvolvimento local (o site publicado não precisa dele) |
| `netlify.toml` | Publicação de `web/` no Netlify |
| `web/` | Frontend sem etapa de build: Observable Plot e d3 via CDN, módulos ES. Páginas geradas em `web/premios/`, `web/pessoas/`, `web/editoras/`, `web/estados/`, `web/perguntas/` e `web/dados-abertos/` (não edite à mão) |
| `docs/` | Logotipo em PNG para o README (temas claro e escuro) |
| `tests/` | `pytest` (build, banco, páginas estáticas) e `node --test` (métricas, contraste, Diadorim) |
| `PLANO_COLETA.md` | Protocolo de coleta das edições |

Para acrescentar dados, edite `dados/coleta/*` e rode `coleta.py normalizar` / `coleta.py aplicar_pessoas` (pessoas) ou `coleta.py contexto` (textos das edições) e depois `build.py`. Nunca edite `literadados.duckdb`, `web/dados.json` ou as páginas geradas à mão.

## Sistema visual

- **Logotipo:** um hexágono com sete células hexagonais de dados (`web/logo.svg`), sem referência a um prêmio. No cabeçalho, as células acendem em sequência no hover.
- **Componentes próprios:** menus de opções, caixas de seleção, diálogos, dicas dos gráficos e barras de rolagem grossas seguem a identidade do Literadados, sem a aparência nativa do sistema.
- **Links como chips:** nomes de pessoas, fontes e referências são chips clicáveis.
- **Motion:** transições sutis em botões, seções, perfis, menus e no carrossel da abertura. Tudo se desliga com `prefers-reduced-motion`.
- **Temas claro, escuro e automático:** escolhidos num menu no ícone do cabeçalho. O contraste AA dos dois temas é testado automaticamente.

## Segurança da Diadorim

A IA e o banco rodam no navegador de quem pergunta. O DuckDB-WASM é montado a partir dos Parquet do build e, depois da carga, fica com `enable_external_access=false` e `lock_configuration`. Só passam um `SELECT` ou `WITH`, sem funções de leitura de arquivo, e o resultado é cortado em 200 linhas. A chave do OpenRouter é de quem entrou e não passa por servidor nosso. As respostas são escapadas, e só viram link as rotas do painel, `metodo.html` e endereços `https`.

## Licença

O repositório ainda não declara licença. Até que declare, o código e os dados são públicos para consulta, mas sem permissão explícita de reúso; para citar, use a referência em [Dados abertos](https://literadados.gustavosimas.com/dados-abertos/).
