# Prémio LeYa: coleta bruta

Organizador: grupo editorial LeYa (Portugal). **Premia um romance inédito em português**, inscrito com pseudónimo; a
identidade do vencedor só é aberta depois da decisão do júri, e o livro é publicado depois pela LeYa. Como no Sesc,
`premio.obras = ineditas`. Valor: 100 mil euros até 2018, 50 mil euros desde 2021.

- **14 edições com vencedor, 2008–2025**: 2008, 2009, 2011–2015, 2017, 2018, 2021–2025. Ficam fora:
  **2010, 2016 e 2019** (júri não atribuiu o prémio), **2020** (suspenso pela pandemia; os originais passaram para 2021) e
  **2026** (inscrições até 30/04/2026; em 19/11/2026 o site ainda mostrava o resultado de 2025, e a busca não achou
  anúncio do resultado).
- **Lista = vencedor (`colocacao = 1`) + finalistas com autoria identificada (`colocacao` vazio)**, por decisão do
  responsável. `etapa_lista = finalistas` em todos os anos; `vagas_lista` = finalistas anunciados, inclusive os não
  identificados. **Atenção:** a checagem do `build.py` (n de obras = `vagas_lista`) vai falhar em todas as edições,
  porque só uma parte dos finalistas tem autoria. É preciso decidir como tratar lista parcial (por exemplo, nova coluna ou
  `vagas_lista` vazio com o número em `observacao`) antes do `normalizar`.
- **Editora vazia** (concorreu como original); a editora que publicou o livro está em `observacao`.
- **Título** = o do original na lista de finalistas da LeYa, quando ela trouxe títulos (2013–2015, 2017, 2018,
  2023–2025). Em 2008, 2009, 2011, 2012, 2021 e 2022 a LeYa não publicou os títulos, e o título é o do livro.

## Finalistas identificados × anunciados

| Ano | Anunciados | Identificados (inclui o vencedor) | Lista publicada pela LeYa |
|---|---|---|---|
| 2008 | 8 | 5 | não (só o número) |
| 2009 | 11 | 3 | não (só o número, no Público) |
| 2011 | 5 | 2 | pseudónimos, sem título |
| 2012 | 7 | 6 | número de participante + pseudónimo |
| 2013 | 7 | 4 | título + pseudónimo |
| 2014 | 5 | 4 | título + pseudónimo |
| 2015 | 5 | 4 | título + pseudónimo |
| 2017 | 5 | 3 | título + pseudónimo |
| 2018 | 7 | 1 | só título |
| 2021 | 14 | 4 | lista não achada |
| 2022 | ? | 2 | lista não achada |
| 2023 | 6 | 3 | título + pseudónimo |
| 2024 | 8 | 1 | título + pseudónimo |
| 2025 | 6 | 1 | título + pseudónimo |

Os títulos dos finalistas não identificados estão em `categorias_edicao.csv` (`observacao`).

## Fontes

- **Historial "Alguns dos finalistas publicados 2008/2023"** da LeYa (PDF, `leya.com/fotos/editor2/premio_leya_v7.pdf`;
  versão anterior em `leya.com/ficheiro/premio-leya-v6`, com os mesmos rótulos). É a fonte da autoria da maior parte dos
  finalistas: livro, autor, editora, ano e o ano de edição do prémio no rótulo. A extração de texto do PDF perde o
  rótulo de cada coluna; o ano de cada livro foi lido na página renderizada.
- **Site antigo da LeYa no Arquivo.pt** (`arquivo.pt/wayback/...` de `leya.pt/pt/gca/areas-de-actividade/premio-leya/`):
  vencedor-AAAA (2008–2018), finalistas-AAAA (2011–2018), júri (snapshots de 2013 a 2019), comunicados de 2010 e 2016.
  O Wayback (web.archive.org) estava inacessível nesta sessão (curl sem conexão; WebFetch bloqueado); o Arquivo.pt
  responde a curl, inclusive a API CDX (`arquivo.pt/wayback/cdx?url=...`) e a busca de texto (`arquivo.pt/textsearch`).
- **Site atual** (`leya.com/premio-leya`, e snapshots do Arquivo.pt de 2023-11 e 2025-03): finalistas e júri de 2023–2025.
- Imprensa: Público (2009, 2011–2014, 2018), Observador (2015, 2021, 2022), DN (2017), Expresso (2021), TSF (2022), Time
  Out (2024), RTP (2025), Lusa/Notícias ao Minuto (2025). pt.wikipedia "Prémio LeYa" para conferir a lista de vencedores.

## Júri (`jurados_AAAA.csv`)

Achado para as 14 edições. 2008–2010: Manuel Alegre (presidente), Carlos Heitor Cony, José Carlos Seabra Pereira,
Lourenço do Rosário, Nuno Júdice, Pepetela, Rita Chaves. 2011–2017: José Castello no lugar de Cony. 2018–2022: saem
Pepetela, Castello e Rita Chaves; entram Ana Paula Tavares, Isabel Lucas e Paulo Werneck. 2023: Josélia Aguiar no lugar
de Werneck. 2024–2025: seis jurados (sem Nuno Júdice, morto em março de 2024). Em 2018, Manuel Alegre não votou (Público).
O secretário do prémio (João Amaral, da LeYa) aparece em algumas listas da imprensa como membro do júri; ficou fora.

## Anomalias e decisões

- **A Boneca Despida (Paulo M. Morais)** está sob o rótulo 2023 no historial da LeYa, mas não consta da lista de
  finalistas de 2023 publicada pela LeYa, e a sinopse da editora diz "finalista do Prémio LeYa 2022". Ficou em 2022.
- **As Palavras que me deverão guiar um dia (António Tavares)**: o texto do historial sugere finalista em 2014 ("no ano
  seguinte"), mas a lista de 2013 traz o título e o Observador diz "finalista em 2013". Ficou em 2013.
- **Títulos que mudaram na publicação** (original no `titulo`, livro em `observacao`): "Périplo ou o dia em que o sol
  Morreu" → *O Dia Em Que o Sol Se Apagou*; "O Dicionário do Silêncio de Santiago Boccanegra" → *Os Dez Livros de
  Santiago Boccanegra* (correspondência inferida pela semelhança, com o livro no rótulo 2014 do historial); "Seja feita
  à vossa vontade" → *Seja Feita a Tua Vontade*; "As Histórias que não se contam" → *Histórias Que Não Se Contam*.
  O `normalizar` vai precisar de `leya/obras_casamentos.csv` para casar esses títulos com as obras do Oceanos
  (*O Rio do Esquecimento*, *Três Mulheres no Beiral* etc.).
- **Carlos Maduro (2008)**: fonte única e secundária (resenha do Livros e Leituras, 2010: "um dos dois finalistas
  portugueses"); bate com a imprensa (2 finalistas portugueses em 2008, o outro seria Artur Portela). REVISAR.
- **Bruno Margo** pode ser nome literário; ficou como no livro.
- **Nomes**: Murilo Carvalho (nome completo Murilo António de Carvalho; **não** é José Murilo de Carvalho, que está na
  base); Nuno Miguel Silva Duarte (nome do comunicado; o livro sai como Nuno Duarte, nome comum demais para casar);
  Victor Vidal (o PDF grafa Vitor); Celso José da Costa (o PDF dá Celso Costa); Alaor Barbosa (o PDF dá Alaor Barbosa
  dos Santos); Carla Pais (Carla Marisa Pereira Vieira Pais).
- **Finalistas fora do recorte** (anos sem vencedor): 2016 teve 1 finalista (*O Paraíso*, Paula de Sousa Lima, Casa
  das Letras 2017); 2019 teve 3 finalistas, só com pseudónimo (Carlos Cavalieri, Marco Gregorio, Diana Pena); 2010 teve 4
  finalistas (3 portugueses, 1 brasileiro), não publicados.

## Pessoas

`casamentos.csv` confirma 8 nomes já na base (mesmo livro no Oceanos ou mesmo papel de jurado). Os demais nomes iguais
aos da base (João Paulo Borges Coelho, Itamar Vieira Junior, Pepetela etc.) casam pelo nome. 26 pessoas novas:
Murilo Carvalho, Gabriela Ruivo Trindade, António Tavares, José Carlos Barros, Celso José da Costa, Nuno Miguel Silva
Duarte, Carla Pais (vencedores); Alejandro Reyes, Alaor Barbosa, Artur Portela, Carlos Maduro, André Gago, Vasco Luís
Curado, Bruno Margo, Cristina Drios, Pedro Guilherme-Moreira, Carlos Campaniço, Pedro Marta Santos, Nuno Gomes Garcia,
Paulo M. Morais, Nuno Amado, Graça Videira Lopes, Raquel Ochoa, Leonor Sampaio da Silva (finalistas); Isabel Lucas,
Paulo Werneck (júri). Gênero, raça e nascimento não foram pesquisados.
