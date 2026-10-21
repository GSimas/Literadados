# Prêmio Literário Biblioteca Nacional: coleta bruta

Quarto prêmio da base (spec CA-26.17, tarefa T27), no modelo do Oceanos e do São Paulo. Nome oficial: **Prêmio Literário
Biblioteca Nacional** (no painel, "Prêmio Biblioteca Nacional"); organizador: Fundação Biblioteca Nacional (FBN), federal.
Coletado por três agentes (1995–2009, 2010–2017, 2018–2025) pelo `PROTOCOLO_COLETA.md` desta pasta.

- **31 edições, 1995–2026** (2003 sem prêmio), **255 obras premiadas** (129 em 1º lugar) nas categorias do recorte,
  e **294 participações de júri**, de 2005 a 2026 (sem 2011). A edição de 2026 foi acrescentada em out/2026 (ver abaixo).
- 96 das obras também estão no Jabuti, no Oceanos ou no São Paulo.
- Só autores brasileiros; a inscrição é feita pelo próprio autor (não pela editora). O ano é o da edição como a FBN a nomeia
  (os livros são, em geral, do ano anterior; várias edições foram entregues no ano seguinte, anotado em `observacao`).

## Categorias (prêmio → `categoria`)

| Prêmio (`nome_original`) | `categoria` | Anos |
|---|---|---|
| Machado de Assis | `Romance`; `Prosa` em 1999–2002 ("para narrativa": romance e conto) | 1995–2002, 2005– |
| Artur Azevedo | `Contos` | 1995–1998 |
| Clarice Lispector | `Contos` | 2005– |
| Alphonsus de Guimaraens | `Poesia` | 1995– |
| Glória Pondé | `Infantil e Juvenil` (2007–2011), `Juvenil` (2012–) | 2007– |
| Sylvia Orthof | `Infantil` | 2012– |
| João do Rio | `Crônica` | 2026– |
| Fundação Biblioteca Nacional (prêmio único) | `Livro do Ano` | 2004 |

Fora: ensaio literário e social, tradução, projeto gráfico, ilustração, quadrinhos e tradição oral (Akuli).

## Formato (`edicoes.csv`, coluna `regime`)

| Edições | Formato | `etapa_lista` |
|---|---|---|
| 1995–1998 | vencedor por categoria (empates em 1996 e 1997) | premiados |
| 1999–2002 | idem, com o Machado de Assis "para narrativa" | premiados |
| 2004 | prêmio único (*Não*, Augusto de Campos) | premiados |
| 2005–2008 | vencedor por categoria | premiados |
| 2009–2011 | pódio de 1º a 3º no resultado oficial | premiados |
| 2012–2016 | só o vencedor | premiados |
| 2017 | 3 finalistas e o vencedor (Decisão Executiva 40/2017) | finalistas |
| 2018–2026 | pódio de 1º a 3º | premiados |

O pódio de 2009–2011 não estava na premissa da coleta: os agentes acharam o 1º, 2º e 3º lugar nas portarias e na imprensa
(Folha 15/12/2009, Estadão 2010, Vitruvius 2011) e os mantiveram, como premiados publicados.

## Fontes

Duas fontes por obra: resultado oficial (portarias e Diário Oficial; Relatórios de Gestão da FBN; páginas da FBN no Wayback;
`in.gov.br/leiturajornal?data=DD-MM-AAAA&secao=do2`, que lista os atos do dia em JSON) e imprensa (Folha, Estadão, O Globo,
G1, Terra, PublishNews, Quatro Cinco Um) ou pt.wikipedia. Em 1995–1999, os Anais da BN (memoria.bn.gov.br) estavam fora do ar:
a 2ª fonte é a pt.wikipedia, que os cita. Ressalva: G1 2023, Quatro Cinco Um 2025, PublishNews 2017 e Vitruvius 2011
reproduzem o texto oficial.

## Anomalias e decisões (detalhe em `observacao` de cada linha)

- **2003:** sem prêmio (o Relatório de Gestão só traz o Camões). **2004:** prêmio único, entregue em 2005.
- **pt.wikipedia corrigida:** troca 2005 e 2006 (Machado e Alphonsus); dá como Glória Pondé 2008 uma tradução (o vencedor é
  *O fazedor de velhos*, Rodrigo Lacerda); atribui o conto de 2013 a Veronica Stigger (é Cíntia Moscovich); não traz 2000
  (recuperado da página da FBN arquivada).
- **2012:** a portaria troca os nomes do Glória Pondé e do Sylvia Orthof; segue o edital (Sylvia Orthof = infantil). Poesia:
  o prêmio dado à edição crítica de Drummond foi anulado; fica Ana Martins Marques.
- **2018, conto:** a FBN divulgou a ordem errada do 2º e 3º lugar e corrigiu no dia seguinte; vale a correção.
- **Nomes:** o resultado de 2022–2023 usa nome civil; as listas usam o nome literário e guardam o civil em `observacao`.
  Jurados com nome completo foram casados com quem já estava na base (`casamentos.csv`: 226 nomes, 25 por nome completo
  conferido, como Moacyr Jaime Scliar → `moacyr-scliar`; e "Alcir Pécora" e "B. Kucinski", como nos outros prêmios).
- **Editoras:** três grafias da lista oficial geravam um segundo id com o nome de uma editora existente (Peirópolis, Martelo,
  Tusquets) e foram unificadas por `canonico` em `../editoras_enriquecidas.csv`.
- **A conferir:** coautoria do Infantil 2022 (3º, *QuiQuinho e PioPio*: só Bruna Lubambo no resultado oficial, Carolina Resende
  no PublishNews); autoria de *A deusa, o herói, o centauro e a justa medida* (2012: Fábio Tubenchlak na FBN e na Folha,
  "Favish" na Wikipédia); júri de 2011 (a portaria só remete a uma Decisão Executiva não aberta); duplicatas antigas na base
  (`j-p-cuenca`/`joao-paulo-cuenca`, `luciana-grether`/`luciana-grether-carvalho`).

## Fora por enquanto

As listas de **obras habilitadas** (todas as inscritas válidas: 2016 e 2022–2026, de ~700 a ~1.500 por ano, a de 2025 sem
editora) não entraram: virariam uma etapa nova (`inscritos`) e pediriam pesquisar milhares de pessoas (spec CA-26.17).

## Pessoas (pesquisa pelo protocolo)

- 219 pessoas novas no primeiro `normalizar` (60 na autoria e ilustração, 159 só no júri), pesquisadas em `../pessoas_bn_1.csv` a `_4.csv` (4 agentes, 160 buscas web; Wikipédia por API, Wikidata, catálogo VTEX da Martins Fontes, páginas de editoras e universidades).
- **Duplicatas:** 9 jurados já estavam na base com o nome literário (Leonardo Fróes, Sérgio Rodrigues, Antonio Cicero, José Castello, Carlito Azevedo, Afonso Henriques Neto, Eduardo Sterzi, Josely Vianna Baptista, Ninfa Parreiras: `casamentos.csv`); 15 grafias de jurados que mudam de um ano para outro (nome civil completo, nome curto, "Manoel"/"Manuel", "Mariza"/"Marisa", três formas de Laura Sandroni) foram unificadas nas próprias listas, com a grafia da fonte em `observacao`. Ficam 195 pessoas novas.
- **Raça:** 1 autodeclaração, conferida na página: Yaguarê Yamã (indígena, Metrópoles). REVISAR (ascendência ou descrição de terceiros, ficaram fora de `raca`): Fábio Yabu, Miguel Jorge, danirampe. Jurados ficaram com busca de raça `parcial` (teto).
- **Gênero:** 81 atribuídos pelo primeiro nome (`../pessoas_zgenero_5.csv`); 26 sem gênero.
- **Identidade não confirmada (dados apagados ou deixados vazios):** Antônio José Jardim e Castro e Luzia de Maria Rodrigues Reis (casadas só pelo nome); Beto Silva, Carla Rodrigues, João Cesar de Castro, Helena Lima, Celina Portocarrero; possíveis duplicatas não unificadas: Luisa Chaves de Melo/Luisa Melo, Graça Monteiro, Érika Nogueira/Erika Nogueira Vieira, Álvaro Costa e Silva Filho.

## Edição de 2026 (acrescentada em 21/10/2026)

- Resultado divulgado pela FBN em 20/10/2026 (`Vencedoresde2026dosPrmiosLiterriosdaFBN.pdf` e notícia no portal da FBN); a
  portaria no Diário Oficial ainda não tinha saído. A 2ª fonte é a notícia da própria FBN: imprensa ainda não achada (trocar
  `fonte_2` quando houver matéria independente).
- Treze categorias; seis no recorte, com o **Prêmio João do Rio (Crônica)** estreando. Júri da Portaria FBN nº 72/2026 (DOU
  26/08/2026), com nome civil; grafias da base para João Almino, Aleilton Fonseca e Gabriela Gibrail (civil em `observacao`).
- Infantil e juvenil: a FBN credita "Eletricista" a Augusto Massi e Daniel Kondo e "Velho sertão" a Fernanda Rios e Marcelo
  Tolentino; o ilustrador foi separado pela editora/resenha. "U-507" ganhou o ilustrador Felipe Cavalcante pelo catálogo da
  Martins Fontes. **A conferir:** "Gavião" (Lulu Lima): o catálogo lista Eric Farpa como coautor, sem separar ilustração.
