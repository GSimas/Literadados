# Prémio Literário José Saramago: coleta bruta

Fundação Círculo de Leitores, com a Fundação José Saramago. Bienal desde 1999. Coleta de novembro de 2026. Ainda não foi integrada à base (`coleta.py normalizar` não rodou).

- **13 edições (1999–2024), só vencedores.** O prémio nunca publicou finalistas, nem nas edições de livro publicado nem nas de inéditos. Por isso todas as `categorias_edicao` têm `etapa_lista = premiados`, `vagas_lista` vazio e `vagas_premio = 1`. Não houve ex aequo nem menção honrosa divulgada.
- **Categoria:** `Romance`. O regulamento premia "obra literária no domínio da ficção, romance ou novela", e todos os vencedores são romances.
- **13 vencedores, 12 já na base.** Só Paulo José Miranda (1999) é novo. Os 12 estão confirmados em `casamentos.csv` pelo QID da tabela da pt.wikipedia, que bate com `pessoa.csv`.
- **Júri:** 13 arquivos, de 1999 a 2024. O de 1999 tem só Nélida Piñon.
- **2026 fica fora.** A 14.ª edição abriu inscrições de 20/jan a 15/mai/2026 (https://www.josesaramago.org/14a-edicao-do-premio-literario-jose-saramago/, 13/jan/2026), mas o vencedor ainda não tinha sido anunciado em 19/nov/2026. O júri já foi divulgado: Guilhermina Gomes (presidente), Pilar del Río, Joana Matos Frias, Clara Rowland, Ana Lima Cecílio e Lídia Jorge (membro honorário). A Record (BR) é a nova editora parceira.

## Formato por período (`edicoes.csv`, colunas `regime` e `obras`)

| Edições | `obras` | Regra |
|---|---|---|
| 1999–2019 (1.ª a 11.ª) | `publicadas` | Ficção (romance ou novela) de autor com **até 35 anos à data da publicação**. A 1.ª edição tinha de ter saído em país lusófono nos dois anos anteriores ao prémio. 25 mil euros (5 mil contos em 2001). |
| 2022–2024 (12.ª e 13.ª) | `ineditas` | **Romance inédito**, inscrito com pseudónimo, de autor com **até 40 anos**. 40 mil euros. A obra sai depois pela Porto Editora (PT) e pela Globo Livros (BR); em 2026 a parceira brasileira passa a ser a Record. O júri passa a ter vencedores anteriores. |

- Em 2019 anunciou-se que o limite subiria para 40 anos; o Público de 8/out/2019 fala em "40 anos à data da publicação do livro". Mas não houve edição de livro publicado depois disso: em nov/2021 o prémio passou a premiar inéditos (Observador, 24/nov/2021).
- A edição de 2021 foi adiada pela pandemia para 2022. Por isso o ano salta de 2019 para 2022.
- Em out/2009 o LER anunciou que o prémio teria "carácter ibérico" e seria anual a partir de 2010, alternando entre Portugal e Espanha. Isso não aconteceu: a edição seguinte foi 2011, de novo bienal e lusófona.

## `ano` × ano do livro

`ano` é o ano do anúncio. Nas edições de livro publicado, o livro é de um ou dois anos antes. O ano de cada livro está em `observacao`:

| Ano | Obra | Editora (país) | Livro |
|---|---|---|---|
| 1999 | Natureza Morta, Paulo José Miranda | Cotovia (PT) | 1998 |
| 2001 | Nenhum Olhar, José Luís Peixoto | Temas e Debates (PT) | 2000 |
| 2003 | Sinfonia em Branco, Adriana Lisboa | Rocco (BR) | 2001 |
| 2005 | Jerusalém, Gonçalo M. Tavares | Círculo de Leitores (PT) | 2004 |
| 2007 | O Remorso de Baltazar Serapião, Valter Hugo Mãe | QuidNovi (PT) | 2006 |
| 2009 | As Três Vidas, João Tordo | QuidNovi (PT) | 2008 |
| 2011 | Os Malaquias, Andréa del Fuego | Língua Geral (BR) | 2010 |
| 2013 | Os Transparentes, Ondjaki | Caminho (PT) | 2012 |
| 2015 | As Primeiras Coisas, Bruno Vieira Amaral | Quetzal (PT) | 2013 |
| 2017 | A Resistência, Julián Fuks | Companhia das Letras (BR) | 2015 |
| 2019 | Pão de Açúcar, Afonso Reis Cabral | Dom Quixote (PT) | 2018 |
| 2022 | Dor Fantasma, Rafael Gallo | inédito; Porto Editora, 2023 | — |
| 2024 | Morramos ao menos no porto, Francisco Mota Saraiva | inédito; Porto Editora, 2025 | — |

## Fontes

- Para a lista de vencedores: pt.wikipedia "Prémio Literário José Saramago" (`action=raw`), conferida com en.wikipedia e com cada notícia.
- **O Wayback (web.archive.org) não respondeu nesta coleta**: dava timeout de conexão, embora a API `archive.org/wayback/available` funcionasse. O site oficial (premiojosesaramago.pt) dá 403 por curl e WebFetch. O que funcionou no lugar:
  - **Arquivo.pt**: a busca de texto `arquivo.pt/textsearch?q=...&from=...&to=...` não gasta cota, e as páginas saem por `arquivo.pt/noFrame/replay/<ts>id_/<url>`. Páginas antigas (1999–2005) vêm em ISO-8859-1 e não usam `<p>`.
  - **API de etiquetas do Público**: `publico.pt/api/list/premio-jose-saramago?page=N` responde em JSON por curl. Os artigos abertos trazem o texto no HTML.
  - DN, Observador, RTP e Jornal Económico por curl.
- Cada `lista_AAAA.csv` tem `fonte_1` e `fonte_2` independentes. A única exceção é 2007: a `fonte_1` é um blogue que reproduz notícia do DN (o original de 2007 não foi achado), e a `fonte_2` (Público 2013) só confirma título e autor.

## Anomalias e decisões

- **Edição que concorreu, em 2005 e 2017:**
  - *Jerusalém*: segundo o Instituto Camões, a 1.ª edição é do Círculo de Leitores (2004) e a da Caminho é de 2005.
  - *A Resistência*: a 1.ª edição é da Companhia das Letras brasileira (2015). O Público cita a edição portuguesa (Companhia das Letras, 2016).
  - Nos dois casos não se sabe qual edição foi inscrita. Usei a 1.ª edição, porque o regulamento fala em "primeira edição", e anotei a dúvida em `observacao`.
- **Inéditos (2022, 2024):** `editora` e `editora_pais` vazios. A editora que publicou depois está em `observacao`. Gallo concorreu com o pseudónimo "Pestana".
- **Short list interna:** em 2003, um jurado disse ao Público que Adriana Lisboa "já tinha estado na 'short list'" de 2001; o livro seria, provavelmente, *Os Fios da Memória* (1999). Essa lista nunca foi publicada, então não entrou como linha. Fora isso, nenhuma edição divulgou finalistas.
- **Concorrentes divulgados:** 300 obras em 2001 (Lusa), 43 em 2005 (Lusa), 36 ou 37 em 2009 (Portal da Literatura; LER). Nas edições de inéditos, o número exato não foi divulgado ("centenas").
- **Júri:**
  - A composição varia de uma fonte para outra. Em 2003 e 2009, o Círculo de Leitores e o DirectGroup listam 5 nomes, e o Público e as actas acrescentam Manuel Frias Martins, Maria de Santa Cruz e Nazaré Gomes dos Santos. Em 2019, a RTP lista 5 nomes e o Observador acrescenta Frias Martins.
  - Entrou a lista mais completa. O nome que vem de uma fonte só está indicado em `observacao`.
  - Em 2015 o Público separa "júri" e "Comité Executivo" (Frias Martins, Nazaré Gomes dos Santos, Paula Cristina Costa). Os dois grupos entraram, com a distinção em `observacao`.
  - Membro honorário (Nélida Piñon em 2022, Lídia Jorge em 2024) entrou como jurado, com nota.
- **Nome a revisar:** em 2001, o Diário do Alentejo traz "Maria José Gomes Santos". O nome não aparece em nenhum outro júri. Pode ser uma fusão de Guilhermina Gomes com Nazaré Gomes dos Santos, por isso está marcado REVISAR em `observacao`.
- **Grafias:** usei a forma da base ("Nélida Piñon"; as fontes portuguesas grafam "Nelida") e "Pilar del Río" (as fontes alternam "del Rio" e "del Río").

## Pessoas

- **Já na base** (`casamentos.csv`, mesma grafia, confirmadas pelo QID ou pelo papel): os 12 vencedores de 2001 a 2024 e os jurados Nélida Piñon, José Eduardo Agualusa, Ana Paula Tavares (a poeta angolana, Q460121), Manuel Frias Martins (o crítico português, jurado do Oceanos) e Lídia Jorge.
- **Novas:**
  - Paulo José Miranda: vencedor de 1999 e jurado de 2024.
  - Jurados: Guilhermina Gomes, Pilar del Río, Vasco Graça Moura, Maria de Santa Cruz, Nazaré Gomes dos Santos, António Mega Ferreira, Paula Cristina Costa e "Maria José Gomes Santos" (REVISAR).

## Lacunas

- O júri completo de 1999 não foi encontrado; só Nélida Piñon, pela Gazeta Byblos de out/1999.
- O regulamento de cada edição não foi lido no original. O link do regulamento da 6.ª edição, citado pela pt.wikipedia, está no Wayback, que não respondeu. A regra de idade e de prazo vem das notícias da época.
- Quando o Wayback voltar, vale conferir `premiojosesaramago.pt/vencedores` (cópia de 5/out/2025) e as páginas por edição.
