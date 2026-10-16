<p align="center">
  <img src="web/logo.svg" width="112" alt="Logotipo do Literadados: um jabuti visto de cima, com o casco feito de células hexagonais de dados">
</p>

<h1 align="center">Literadados</h1>

<p align="center"><b>Quem chega ao Prêmio Jabuti?</b><br>
Gênero, raça autodeclarada e estado de nascimento de quem escreveu as obras indicadas ao principal prêmio do livro no Brasil, de 1959 a 2025: painel interativo, história guiada e uma IA que responde perguntas com SQL sobre a base.</p>

---

## Estado atual (out/2026)

| | |
|---|---|
| Edições coletadas | **67 de 67** (1959–2025): listas públicas de 2000 em diante; de 1959 a 1999, só os premiados |
| Indicações | 1.675, em 1.640 obras |
| Pessoas na base | 1.228, entre elas **1.023 pessoas-autoras**, 124 ilustradoras, 24 organizadoras e 111 juradas (há quem tenha mais de um papel) |
| Editoras | 307, 278 com sede conhecida |
| Gênero (autoras) | 814 com fonte, **194 atribuídos pelo primeiro nome** (marcados com \*), 15 não identificados |
| UF de nascimento (autoras) | 680 de 1.023 |
| Raça declarada (autoras) | 35 autodeclarações públicas, 24 pessoas negras (piso). Busca do protocolo completa para 1.022 de 1.023 |
| Perfis | 714 QIDs do Wikidata, 656 verbetes da Wikipédia, 300 fotos com licença livre |
| Fontes citadas | 180 domínios, agrupados na seção Referências |

Categorias no recorte: Romance (Romance Literário a partir de 2020), Contos (e Crônicas, até 2017), Crônica (desde 2018), Poesia, Infantil, Juvenil, Infantil e Juvenil (2018 e edições antigas) e Livro do Ano. O painel abre na série completa; cada parte tem filtro de período.

## O que o painel mostra

- **Abertura:** a pergunta central e três números do recorte completo, com um carrossel de fotos livres ao fundo.
- **História guiada:** um ponto por pessoa-autora, que se reorganiza a cada passo: gênero, da lista ao 1º lugar, piso racial e região de nascimento.
- **Panorama:** cartões com n, cobertura e edições coletadas.
- **Gráficos:** uma grade de cartões. Cada cartão abre uma janela com endereço próprio (`#/grafico/<id>`): linha do tempo (composição de cada edição e vencedoras), mapa por UF de nascimento (absoluto ou por milhão de habitantes) com Sankey região → editora → resultado, evolução por edição, funil (lista → finalistas → premiadas → vencedoras), categorias (índice de Duncan), idade no ano do prêmio, editoras e júri. No hover, o elemento sob o mouse fica em destaque e os demais esmaecem.
- **Autores:** um anel de retratos ao redor de um centro vazio e circular, com 100 por página e setas laterais. No hover, o retrato brilha e o centro mostra o resumo da pessoa; o clique abre o perfil completo, com link próprio (`#/pessoa/<id>`) e a fonte de cada atributo. Há também a vista em tabela, com busca e ordenação.
- **Diadorim:** a IA do Literadados, num botão flutuante no canto da tela. O login é com a conta do OpenRouter (PKCE). O padrão é o roteador gratuito `openrouter/free`, e qualquer modelo do OpenRouter pode ser escolhido na configuração, numa lista buscada ao vivo com preço, contexto e suporte a ferramentas. Ela consulta o banco com SQL somente leitura e mostra ao vivo os passos (consultas e linhas devolvidas). Cada mensagem traz horário e modelo, e cada resposta traz o SQL usado e um bloco "Onde conferir" montado pelo próprio Literadados: perfis, estados, gráfico relacionado, fontes e Método. Há botão de nova conversa.
- **Busca** no cabeçalho (atalhos `/` e Ctrl/⌘+K): determinística, sem IA, sobre pessoas, livros, editoras, estados, regiões, categorias, edições, gráficos e seções. Cada resultado leva ao perfil, ao gráfico ou à seção certa.
- **Perfis de estados e regiões** (`#/uf/SP`, `#/regiao/Nordeste`): mapa com o lugar em destaque, números (pessoas-autoras e a parcela do Brasil, indicações, premiadas, % mulheres, piso de % negras, pessoas por milhão de habitantes comparadas à média), parcela por edição e por categoria, pessoas por UF (na região) e a lista de quem nasceu ali.
- **Exportar:** todo gráfico sai como JPG com fundo ou PNG sem fundo (com título, legenda e rodapé), e toda tabela como XLSX ou CSV. O XLSX é gerado no navegador, sem biblioteca.
- **Método e referências** ([`metodo.html`](web/metodo.html)): cobertura por edição, definições, protocolo de raça, gênero atribuído e todas as fontes, agrupadas por domínio.

Não há filtro global. O panorama, cada gráfico e a galeria de autores têm **filtro próprio** (período, categorias e papel), com o resumo do recorte e um botão de CSV. Cada filtro fica na URL (`?funil=2019-2025~Poesia`), e o link pode ser compartilhado. A história e a Diadorim usam o recorte completo.

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
.venv/bin/python build.py      # CSVs → literadados.duckdb + web/dados.json (falha se o dado for inconsistente)
.venv/bin/python server.py     # http://localhost:8000 (servidor estático só para desenvolvimento)
```

O painel não precisa de chave nenhuma. Para conversar com a Diadorim, clique no botão do canto e entre com sua conta do OpenRouter: a chave fica só no seu navegador.

**No ar:** https://literadados.gustavosimas.com (Netlify, estático). O build gera `web/dados.json`, `web/contexto.json` e `web/banco/*.parquet`, e a Diadorim consulta o banco num DuckDB que roda no próprio navegador (DuckDB-WASM). Não há servidor de aplicação. Para publicar: `python build.py`, commit e push para o `main`. O Netlify está ligado ao repositório e publica `web/` a cada push; PRs ganham prévia de deploy.

## Testes

```bash
.venv/bin/python -m pytest -q        # build, checagens, banco do navegador igual ao build, mídia, fontes
node --test tests/*.test.mjs         # métricas, anel, busca, contraste AA, Markdown, validação de SQL, laço da Diadorim, XLSX
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
| `build.py` | CSVs → `literadados.duckdb` + `web/dados.json`, com checagens de consistência |
| `coleta.py` | `normalizar`, `aplicar_pessoas`, `wikidata`, `verificar` (trechos de raça), `midia` (fotos livres), `malha` (UFs) |
| `server.py` | Servidor estático para desenvolvimento local (o site publicado não precisa dele) |
| `netlify.toml` | Publicação de `web/` no Netlify |
| `web/` | Frontend sem etapa de build: Observable Plot e d3 via CDN, módulos ES |
| `tests/` | `pytest` (backend) e `node --test` (métricas e contraste) |
| `PLANO_COLETA.md` | Protocolo de coleta das edições |

Para acrescentar dados, edite `dados/coleta/*` e rode `coleta.py normalizar` / `coleta.py aplicar_pessoas` e depois `build.py`. Nunca edite `literadados.duckdb` ou `web/dados.json` à mão.

## Sistema visual

- **Logotipo:** um jabuti visto de cima com o casco feito de células hexagonais de dados (`web/logo.svg`). No cabeçalho, as células acendem em sequência no hover.
- **Componentes próprios:** menus de opções, caixas de seleção, diálogos, dicas dos gráficos e barras de rolagem grossas seguem a identidade do Literadados, sem a aparência nativa do sistema.
- **Links como chips:** nomes de pessoas, fontes e referências são chips clicáveis.
- **Motion:** transições sutis em botões, seções, perfis, menus e no carrossel da abertura. Tudo se desliga com `prefers-reduced-motion`.
- **Temas claro, escuro e automático:** escolhidos num menu no ícone do cabeçalho. O contraste AA dos dois temas é testado automaticamente.

## Segurança da Diadorim

A IA e o banco rodam no navegador de quem pergunta. O DuckDB-WASM é montado a partir dos Parquet do build e, depois da carga, fica com `enable_external_access=false` e `lock_configuration`. Só passam um `SELECT` ou `WITH`, sem funções de leitura de arquivo, e o resultado é cortado em 200 linhas. A chave do OpenRouter é de quem entrou e não passa por servidor nosso. As respostas são escapadas, e só viram link as rotas do painel, `metodo.html` e endereços `https`.
