# Eventos literários do Brasil — protocolo de coleta

Módulo Eventos (spec RF-35, design D41). **Cadastro curado, não censo**: só entra o que tem fonte pública. Na dúvida, fica de fora.
Todo CSV é escrito com o módulo `csv` do Python, UTF-8, cabeçalho exatamente como abaixo. Datas em ISO (`2026-07-29`).
Fonte é sempre uma URL da página onde a informação está (site oficial, matéria, Wikipédia com a edição, programação em PDF).

## O que entra (DB-8)

Evento aberto ao público cujo centro é a literatura ou o livro: feira do livro, festa literária, bienal do livro, festival
literário, encontro de escritores, jornada literária, salão do livro. **Fora**: evento interno de uma escola, lançamento de
livro, sarau recorrente semanal, congresso acadêmico, feira genérica com um estande de livros.

Tipos: `festival`, `feira`, `bienal`, `festa_literaria`, `encontro`, `jornada`, `salao`, `outro`.

## Edições (DB-9)

Para cada evento: todas as edições de 2015 em diante que tenham data com fonte, mais as anteriores quando houver lista
pública completa (ex.: verbete da Wikipédia com a lista de edições e datas), mais a próxima edição se já anunciada.
- `situacao`: `realizada` (já aconteceu), `prevista` (anunciada, ainda não aconteceu), `cancelada`, `adiada`.
- `ano` = ano da data de início. Evento que acontece duas vezes no mesmo ano: `numero` com sufixo (`12a`, `12b`).
- Se só souber o mês (sem dia), NÃO invente o dia: deixe a edição de fora e anote em `observacao` de outra linha ou no relatório.
- Público estimado só com a fonte que o diz (`publico_fonte`).
- Homenageados: nomes separados por `|`, como a fonte escreve. Nada de gênero ou raça a partir do evento.

## Arquivos (um par por agente: `_N` = número do lote)

### `eventos_N.csv`
`nome,tipo,municipio,uf,organizador,site,redes,ano_inicio,fonte,verificado_em,observacao`
(`municipio` = nome oficial do município-sede, como no IBGE; `uf` = sigla; `redes` = perfis públicos separados por ` ; `).

### `edicoes_N.csv`
`evento,ano,numero,data_inicio,data_fim,municipio,uf,local,tema,homenageados,situacao,formato,publico,publico_fonte,fonte,verificado_em,observacao`
(`evento` = nome exato da linha de `eventos_N.csv`; `municipio`/`uf` da edição, que pode mudar; `formato` ∈ `presencial`, `online`, `hibrido`).

## Fontes sem cota de busca que funcionam por curl

- Sites oficiais dos eventos (página "edições anteriores", "história", programação).
- API da pt.wikipedia (`action=query&prop=extracts` ou `index.php?title=…&action=raw`), com User-Agent só com o nome e a URL do
  projeto: `Literadados (https://literadados.gustavosimas.com)` (nunca e-mail).
- PublishNews, G1, agências estaduais de notícias.
- Não use Instagram nem redes que exigem login.

Depois de coletar: `python coleta.py eventos` (junta os lotes em `dados/evento.csv` e `dados/evento_edicao.csv`) e `python build.py`.
