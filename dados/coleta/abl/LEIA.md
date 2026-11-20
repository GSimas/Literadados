# Prêmios da Academia Brasileira de Letras: coleta bruta

Um prêmio só na base (`premio_id = abl`), com duas famílias. A escolha é sempre interna (comissões de acadêmicos, aprovadas
em plenário), sem inscrição nem lista pública: tudo entra com `etapa_lista = premiados`.

- **Prêmio Machado de Assis** (conjunto da obra): 82 edições, 1941–2026, 82 homenageados (`homenageados.csv`), categoria
  nova `Conjunto da obra`. Não houve prêmio em 1949 nem em 2018–2020. Em 1941 e 1942 o banco da ABL registra um livro
  (Tetrá de Teffé, *Bati à porta da vida*; Afonso Schmidt, *A marcha*): entram como conjunto da obra, com nota.
- **Prêmios por livro**: 61 livros premiados em `lista_AAAA.csv`.
  - 1999–2015: Prêmio ABL de Ficção (romance, teatro e conto → `Prosa`), Prêmio ABL de Poesia (`Poesia`) e Prêmio ABL de
    Literatura Infantojuvenil (`Infantil e Juvenil`); 59 livros, com empates (ver abaixo).
  - 2026: Prêmio Guimarães Rosa (ficção → `Prosa`, *Meridiana*, Eliana Alves Cruz) e Prêmio Manuel Bandeira (`Poesia`,
    *Noite obscena*, Fabrício Oliveira), para livros publicados em 2025. Não houve infantojuvenil em 2026. O terceiro prêmio
    novo, Euclides da Cunha (humanidades, Caetano Galindo), fica fora do recorte.
- **Ano** = ano do prêmio (anúncio e entrega no mesmo ano, em geral junho/julho, na sessão de aniversário da ABL), como no
  banco da ABL. O livro é do ano anterior ("relativos a obras publicadas em 2013", relatório 2014).
- **Fases** (`edicoes.csv`): 1941–1998 só o Machado de Assis; 1999–2015 prêmios por gênero e Machado; 2016–2025 só o
  Machado (a Folha de 07/07/2016 registra a reformulação: o Machado "se torna a única premiação da ABL"); 2026 Machado e os
  prêmios novos por livro.
- **Antes de 1999** a ABL teve prêmios por gênero (Olavo Bilac, Coelho Neto, Afonso Arinos, José de Alencar, Monteiro
  Lobato etc., até 1994), mas o banco de prêmios do site não os lista e não achamos lista confiável por ano: ficaram fora.

## Fontes

1. Banco de prêmios do site da ABL (`academia.org.br/academia/premios?field_ano_value=AAAA&field_tipo_de_premio_tid=N`;
   93 = Machado de Assis, 86 = Ficção, 85 = Poesia, 88 = Infantojuvenil). É a `fonte_1` de 1941–2024. Tem muitos erros de
   digitação (corrigidos, com a grafia do banco em `observacao`).
2. Relatórios de atividades da ABL (PDF; 2010, 2012–2015, 2025) e notícias antigas do site (`/noticias/...`, 2006–2011;
   o arquivo de notícias vai até a página ~400, fev/2006). As notícias trazem as comissões julgadoras.
3. Folha (busca do site, sem cota), PublishNews (2009, 2010, 2026) e a pt.wikipedia ("Prêmio Machado de Assis",
   "Prêmio ABL de Poesia", infobox dos autores).
4. Editoras: só com fonte; quando a imprensa não dá, vêm da lista de outro prêmio já na base (Jabuti, BN, Oceanos), com a
   URL em `observacao` ("editora: ...").

Wayback (`web.archive.org`) estava fora do ar durante toda a coleta (timeout), então o site antigo da ABL não foi consultado.

**Segunda fonte**: Machado de Assis, todos com pt.wikipedia ou imprensa, menos 1944 e 1960 (ver anomalias). Prêmios por
livro com segunda fonte independente (imprensa) em 2001, 2003, 2005, 2006 (ficção), 2008–2015 e 2026. Em 2006 (poesia) e
2007 a segunda fonte é notícia da própria ABL. Em 1999, 2000, 2001 (poesia, infantojuvenil), 2002 e 2004 a segunda fonte é a
pt.wikipedia, que copia o banco da ABL (não é independente). Sem segunda fonte nenhuma: Mauricio de Sousa (1999), Clair de
Mattos (2000), Rui Mourão e Fernando Ferreira de Loanda (2002), Ruy Câmara e Bartolomeu Campos de Queirós (2004), Rui de
Oliveira (2006).

## Júri (`jurados_AAAA.csv`)

Só onde a comissão foi publicada: 2006 (ficção, poesia), 2009 (Machado), 2010 (Machado, ficção, infantojuvenil, poesia) e
2012 (Machado, ficção). 33 linhas, todos acadêmicos. Em 2026 os premiados foram "escolhidos diretamente pelos acadêmicos",
sem nomes.

## Anomalias e decisões

- **Machado de Assis 1944 e 1960**: o banco da ABL dá Fernando de Azevedo (1944) e Eduardo Frieiro (1960); a pt.wikipedia diz
  "não houve premiação" nos dois anos. O livro da própria ABL *Subsídios para sua história 1940–2008* dá o prêmio de Fernando
  de Azevedo em 1943 (ano de Sousa da Silveira no banco). Ficaram com o banco da ABL e "REVISAR".
- **Machado de Assis 2012**: a Folha (06/06/2012) chama o prêmio de Dalton Trevisan de "Machado de Assis 2011"; banco e
  relatório da ABL dão 2012 (Carlos Guilherme Mota é 2011). Ficou 2012.
- **Poesia 2015 não foi concedida** "por decisão da Comissão Julgadora" (relatório 2015): sem linha em `categorias_edicao`.
- **Empates** (`vagas_premio` > 1): Poesia 2000, 2002, 2003, 2004, 2005 e 2007; Ficção 2003 e 2004; Infantojuvenil 2014.
- **Créditos**: em 2002 o banco credita "Roseana Murray e Roger Melo" (*Jardins*) e em 2009 "Ciro Fernandes (ilustrações)"
  (*Cordelinho*): os dois ilustradores foram para `ilustradores`. 1999 premia *A Turma da Mônica*, que é a série, não um livro.
- **Títulos corrigidos** (banco → base): *Danças tango em Buenos Aires* → *Dançar tango em Porto Alegre* (Faraco, 1999);
  *Exercício de ser criança* → *Exercícios de ser criança*; *Lamparádio* → *Lampadário*; *A chuva dos ruídos* → *A chuva nos
  ruídos* (pela Folha); *A gaiola Faraday* → *A gaiola de Faraday*. Quando o livro já está em outra lista da base, o título
  segue a base (*Mínimos, Múltiplos, Comuns*, *Cantos de Outono*, *Trilogia do azul, do mar, da madrugada e da ventania...*).
  *Elegia de agosto e outros poemas* (Ruy Espinheira Filho, 2006) está como *Elegia de Agosto* na lista do Jabuti 2006: pode
  precisar de `obras_casamentos.csv`.
- **Nomes corrigidos** (banco → base): Mancos Santarita → Marcos Santarrita; Dona Ferreira → Dora Ferreira da Silva; Ruy
  Pinheiro Filho → Ruy Espinheira Filho; Rio de Oliveira → Rui de Oliveira (*Cartas lunares*, o mesmo livro da lista do Jabuti
  2006); Dalto Trevisan, Hermes Lira, Raul Boop, Carlolina Nabuco, Frankling de Oliveira e outros no Machado.
- **Homônimos a não confundir**: Francisco de Assis Brasil (PI, 1932–2021, Machado 2004) ≠ Luiz Antonio de Assis Brasil;
  Vera Lúcia de Oliveira (poeta, Perugia) ≠ Vera Lúcia de Oliveira Lins; Clair de Mattos ≠ Cyro de Mattos.
- **A conferir (REVISAR)**: Moacyr Scliar, *Singular plural*, Poesia 2000 (Scliar é prosador; nenhuma fonte além do banco da
  ABL e cópias dele); Clair de Mattos (identidade e grafia); Afonso Félix de Sousa (a pt.wikipedia fala em prêmio de 2001).

## Pessoas

156 pessoas: 80 já na base (grafia da base usada; `casamentos.csv` só confirma Rui de Oliveira) e 76 novas, quase todas do
Machado de Assis anterior a 1990 e jurados acadêmicos. Gênero, raça e nascimento não foram pesquisados (outra etapa).
