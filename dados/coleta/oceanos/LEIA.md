# Oceanos (ex-Prêmio Portugal Telecom): coleta bruta

Piloto do multi-prêmio (RF-26, DA-1, D31; tarefa T23.4). Esta pasta é a coleta bruta; `coleta.py normalizar` a leva para `dados/*.csv`. Integrado à base em out/2026 (T23.2, T23.3); as decisões da integração estão em "Integração", no fim.

- **23 edições, 2003–2025, todas com lista completa.** 1.094 linhas de `lista_*.csv`: 1.085 indicações mais 9 linhas do Grande Prêmio 2012–2014. Cada linha tem `fonte_1`/`fonte_2` e `observacao`.
- **648 autores distintos**, dos quais **259 já estão na base** por nome; 3 deles casados apesar de grafia diferente. **137 jurados**, dos quais **50 já estão na base**. Ver `casamentos.csv`.
- A contagem de cada lista bate com `categorias_edicao.csv`: obras, finalistas e premiadas, em todas as 35 categorias-edição.
- **2026 fica fora.** Até agora só há semifinalistas (54: 26 de prosa e 28 de poesia; https://associacaooceanos.org/edicoes/2026/sobre).

## Edições cobertas

| Ano | Nome do prêmio | Categorias (`categoria`) | 1ª lista | 2ª lista | Premiadas |
|---|---|---|---|---|---|
| 2003 | Portugal Telecom de Literatura Brasileira | Geral | 10 finalistas | — | 4 (dois 1º lugares) |
| 2004–2006 | idem | Geral | 10 finalistas | — | 3 |
| 2007 | Portugal Telecom de Literatura em Língua Portuguesa | Geral | 51 semifinalistas | 10 | 3 |
| 2008 | idem | Geral | 51 | 10 | 4 (dois 2º lugares) |
| 2009 | idem | Geral | 50 | 10 | 3 |
| 2010 | idem | Geral | 54 | 10 | 3 |
| 2011 | idem | Geral | 50 | 10 | 3 |
| 2012 | idem | Romance / Poesia / Contos + Livro do Ano (Grande Prêmio) | 20 / 20 / 20 | 4 / 4 / 4 | 1 por categoria + Grande Prêmio |
| 2013 | idem | idem | 22 / 21 / 20 | 4 / 4 / 4 | idem |
| 2014 | idem | idem | 20 / 22 / 22 | 4 / 4 / 4 | idem |
| 2015 | Oceanos | Geral | 63 | 14 | 4 |
| 2016 | Oceanos | Geral | 50 | 10 | 4 |
| 2017 | Oceanos | Geral | 51 | 10 | 5 (4º lugar dividido) |
| 2018 | Oceanos | Geral | 60 | 10 | 4 |
| 2019–2021 | Oceanos | Geral | 54 | 10 | 3 |
| 2022 | Oceanos | Geral | 65 | 10 | 3 |
| 2023 | Oceanos | Poesia / Prosa | 21 / 20 | 5 / 5 | 1 + 1 |
| 2024 | Oceanos | Poesia / Prosa | 30 / 30 | 5 / 5 | 1 + 1 |
| 2025 | Oceanos | Poesia / Prosa | 25 / 25 | 5 / 5 | 1 + 1 |

## Formato por período (`edicoes.csv`, coluna `regime`)

- **2003–2006: a comissão indica; 10 finalistas e pódio.** Só autores brasileiros, sem inscrição. A comissão monta o júri inicial, que indica as obras; o Júri Nacional escolhe 10 finalistas e o Júri Final faz o pódio. As indicações do júri inicial nunca foram publicadas, então a 1ª lista pública são os 10 finalistas (`etapa_lista = finalistas`, sem 2ª lista, `lista_curta` vazio).
  - Fonte: http://web.archive.org/web/20070504174710/http://www.premioportugaltelecom.com.br:80/linhatempo2003.htm (e `linhatempo2004` a `2006`).
- **2007–2011: categoria única; semifinalistas → finalistas → pódio.** Inscrição aberta a autores e editoras. O júri inicial escolhe cerca de 50 semifinalistas, o intermediário escolhe 10 finalistas e o final faz 1º, 2º e 3º.
  - Fonte: http://web.archive.org/web/20090405123415/http://www.premioportugaltelecom.com.br:80/2009/linha-do-tempo-2007.asp
- **2012–2014: romance, poesia e conto/crônica.** Cerca de 20 semifinalistas e 4 finalistas por categoria, 1 vencedor por categoria. Entre os três vencedores sai o **Grande Prêmio Portugal Telecom**.
  - O Grande Prêmio entrou como categoria `Livro do Ano` (`nome_original` = "Grande Prêmio Portugal Telecom"). A lista são os 3 vencedores de categoria, com `colocacao = 1` só para o ganhador e `etapa_lista = finalistas`.
  - Nos três anos o Grande Prêmio foi para um romance.
  - Fonte: http://web.archive.org/web/20120826012911/http://www.premioportugaltelecom.com.br:80/Default.aspx?tabid=95&itemId=55
- **2015–2018: categoria única; semifinalistas → finalistas → 4 premiados** (1º a 4º).
- **2019–2022: idem, com 3 premiados.**
- **2023 em diante: prosa e poesia.** Cada categoria tem seus júris e um vencedor.

## Marcos do prêmio

| Ano | Marco | Fonte |
|---|---|---|
| 2003 | Criado pela Portugal Telecom como Prêmio Portugal Telecom de Literatura **Brasileira**: só livros de autores brasileiros editados no Brasil, escolhidos por comissão. Curadoria e gestão da Oceanos Cultura desde o início. | https://associacaooceanos.org/edicoes/2014-2003/sobre |
| 2007 | Passa a se chamar Prêmio Portugal Telecom de Literatura **em Língua Portuguesa**. Abre inscrições a autores e editoras e garante 20% de livros portugueses e africanos publicados no Brasil entre semifinalistas e finalistas. | idem; http://web.archive.org/web/20090405123415/http://www.premioportugaltelecom.com.br:80/2009/linha-do-tempo-2007.asp |
| 2012 | Ganha três categorias (romance, poesia, conto/crônica) e o Grande Prêmio entre os vencedores. | http://web.archive.org/web/20120826012911/http://www.premioportugaltelecom.com.br:80/Default.aspx?tabid=95&itemId=55 |
| 2015 | Vira **Oceanos – Prêmio de Literatura em Língua Portuguesa**, com Itaú Cultural e patrocínio do Banco Itaú. Volta à categoria única e passa a ter 4 premiados. | https://associacaooceanos.org/edicoes/2015/sobre ; http://g1.globo.com/pop-arte/noticia/2015/06/premio-portugal-telecom-muda-nome-para-oceanos.html |
| 2017 | Aceita livros de língua portuguesa publicados **em qualquer país** (até 2016, só edições no Brasil). O júri passa a ser luso-brasileiro. | https://associacaooceanos.org/edicoes/2017/sobre |
| 2018 | Primeira cerimônia fora do Brasil (Lisboa). | https://associacaooceanos.org/edicoes/2018/sobre |
| 2019 | Passa de 4 para 3 premiados. | http://web.archive.org/web/20200918133954/https://www.itaucultural.org.br/oceanos/2019/edicao-2019-0021adc4-49cb-4eb3-b3a7-467b76c4770a |
| 2022 | Primeira cerimônia na África (Maputo). | https://associacaooceanos.org/edicoes/2022/sobre |
| 2023 | Divide-se em **Prosa** e **Poesia**, com um vencedor por categoria. | https://associacaooceanos.org/edicoes/2023/sobre |

As fontes divergem sobre o ano de criação. A página "História" do site atual (https://associacaooceanos.org/oceanos-historia) diz "criado no Brasil em 2007", contando só a fase em língua portuguesa. A página das edições 2003–2014 do mesmo site diz "Criado em 2003". `dados/premio.csv` usa 2003, porque o próprio site lista 2003–2006 entre as suas edições.

## Arquivos e colunas

- **`edicoes.csv`**: `ano,regime,fonte`.
- **`categorias_edicao.csv`**: as colunas do Jabuti mais **`etapa_lista`**, que diz o que é a 1ª lista: `finalistas` em 2003–2006 e no Grande Prêmio, `semifinalistas` no resto.
  - `nome_original` é o nome do prêmio nos anos de categoria única ("Oceanos" em 2015–2022) e o nome da categoria nos demais.
- **`lista_AAAA.csv`**: as colunas do Jabuti mais **`editora_pais`**, o país da edição que concorreu (ISO 3166-1).
  - 2003–2006 e 2015–2016 são todos `BR`, porque o regulamento só aceitava edições publicadas no Brasil.
  - 2007–2014: `BR` quase sempre, porque havia cota para "edições originais do exterior"; `PT` para Letra Selvagem.
  - 2017 em diante: pela editora quando ela só existe num país. "Companhia das Letras" sem "Portugal" conta como a brasileira, porque as listas oficiais grafam "Companhia das Letras Portugal" à parte.
  - Fica vazio para coedições entre países, selos com casa nos dois países (Leya, Tinta-da-China, Urutau) e editoras que não reconheci com certeza.
  - Total: 863 BR, 125 PT, 11 MZ, 1 CV e 85 vazias.
  - `lista_curta` é 1 para finalista e 0 para os demais; fica vazio onde não há 2ª lista. `colocacao` vai de 1 a 4 (empate repete o número).
- **`jurados_AAAA.csv`** (2003–2024):
  - 2003–2014: júri final e intermediário/nacional, com a etapa em `observacao`.
  - 2015–2024: júri final citado na página oficial de cada edição.
  - O júri inicial (de 80 a 400 nomes) ficou de fora. 2025 não tem arquivo, porque o site só publica o júri que escolheu os finalistas.
  - Nos anos de categoria, o júri comum se repete em cada `nome_original`.
- **`casamentos.csv`**: `nome,wikidata,pessoa_id`, com 280 nomes do Oceanos (autores e jurados) que são a mesma pessoa de `dados/pessoa.csv`.
  - Nome igual, ignorando acento e caixa: todos conferidos como autores ou críticos conhecidos.
  - Grafia diferente: "Alice Ruiz S" → `alice-ruiz`, "B. Kucinski" → `bernardo-kucinski`, "Verônica Stigger" → `veronica-stigger`, "Luiz Antonio de A. Brasil" (júri 2003) → `luiz-antonio-de-assis-brasil`.
  - Ficaram de fora, para revisão: Mário Medeiros (nome igual, não conferi se é o autor de *Gosto de amora*) e Márcio de Souza (júri 2011, talvez `marcio-souza`).
  - Não consultei QIDs novos: a coluna `wikidata` repete o da base.

## Fontes por período

- **2003–2014**: site antigo `premioportugaltelecom.com.br` no Wayback (listas, PDFs por categoria, linhas do tempo). As colocações vêm de páginas oficiais em 2003–2007 e 2011, e do PublishNews em 2008–2010. Em 2014 o site parou em junho, então finalistas e vencedores vêm de Folha, G1 e do site atual.
- **2015–2025**:
  - Semifinalistas: PDFs e páginas oficiais em `associacaooceanos.org/edicoes/AAAA/`.
  - Finalistas e vencedores: as mesmas páginas.
  - Segunda fonte: páginas do Itaú Cultural no Wayback (2015–2021, 2023) ou imprensa (Tribuna do Sertão e PublishNews em 2022; PublishNews em 2024–2025; Correio Braziliense, Clube of Mozambique, Observador).
  - Em 2016 e 2017 o site atual não tem a lista de semifinalistas. Ela veio do PDF do Itaú Cultural (Wayback), e a contagem por gênero bate com o site oficial.
- Houve 7 buscas web no total (3 do agente de 2003–2014, 4 aqui), todas para confirmar colocação ou achar a URL de uma matéria. O resto foi por curl.

## Anomalias e decisões

- **2015, colocações.** O Correio Braziliense de 09/12/2015 dá 1º Silviano Santiago, 2º Elvira Vigna, 3º Alberto Mussa e 4º Glauco Mattoso, e o Itaú Cultural fala em "1º a 4º vencedor". A Wikipédia (pt e en) põe Mussa e Mattoso empatados em 3º, sem fonte; foi descartada.
- **2015, finalistas.** Foram 14 finalistas (PDF e página do Itaú Cultural). A página de finalistas do site atual mostra 13 cartões, sem *A desumanização*, mas o texto da mesma edição fala em 14.
- **2017, 4º lugar dividido.** O Itaú Cultural registra o 4º lugar dividido entre *Anunciações* (Maria Teresa Horta) e *Simpatia pelo demônio* (Bernardo Carvalho), o que dá 5 premiadas. O site atual lista só 4 vencedores, sem Horta.
- **2019, contagem.** O site atual diz 53 semifinalistas e 25 romances; o PDF oficial e o Itaú Cultural trazem 54 e 26. Vale 54.
- **2003 e 2008, empates.** Em 2003 houve dois 1º lugares (página oficial "1° Lugar (empate)"). Em 2008, dois 2º lugares (PublishNews 30/10/2008).
- **2010.** *Caim* (Saramago) foi anunciado finalista e retirado antes do júri final. Ficou com `lista_curta = 1` e a nota em `observacao`.
- **Grafias.** O nome segue a fonte, com estas exceções:
  - erros evidentes corrigidos pela forma usada em outra página oficial do próprio prêmio (ex.: "Hélia Correa" → Hélia Correia, "Luis Carlos Patraquim" → Luís, "Valter Hugo Mae" → Mãe, "Torren" → Terron);
  - o apóstrofo tipográfico em "André Sant’Anna" trocado pelo reto.
  - A grafia original fica anotada em `observacao` da linha.
- **Editoras.** A editora fica como na fonte, inclusive com vários selos numa célula ("Quetzal e TAG", "Caminho / Companhia das Letras"). São 42 células com coedição ou vários selos.

## Reprodução

Os scripts e as listas intermediárias, fora do repositório, estão em `side-session-notes/local_f83c13ff-…/coleta-oceanos/`:
- `semi/*.tsv`: semifinalistas de 2015–2025 extraídos das PDFs;
- `scripts/montar.py`: semifinalistas + finalistas + vencedores → listas;
- `jurados.py` e `casamentos.py`;
- `tabcols.py`: tabela de PDF por coluna.

Os de 2003–2014 estão em `pt-scripts/`.

## Integração (out/2026)

- **Grande Prêmio 2012–2014**: segue a convenção do Livro do Ano do Jabuti. Entra só a obra vencedora (`etapa_lista = premiados`). As outras vencedoras de categoria ficam só na própria categoria; antes, contavam em dobro.
- **`editora_pais` vazio**: vira uma editora à parte, `<nome> (país não informado)`, sem sede. Não herda a sede da brasileira de mesmo nome (Urutau, Tinta-da-China, LeYa, coedições entre países).
- **Coedição**: vale a 1ª editora. Separa `A / B` e `A | B` sempre. Separa `A e B`, `A - B` e `A, B` só quando todas as partes já são editoras conhecidas.
- **Grafias de editora**: unificadas por `canonico` em `../editoras_enriquecidas.csv`.
- **Livros dos dois prêmios**: casam por título e mesma pessoa. Entre prêmios, com título tolerante (sem subtítulo, artigos ou preposições). Quando a grafia diverge demais, a decisão humana fica em `obras_casamentos.csv`: *Avó dezenove* × *AvóDezanove*, e *Meridiano celeste & bestiário* × *Meridiano Celeste*.
- **Pessoas**: `casamentos.csv` ganhou Márcio de Souza, Paulliny Gualberto Tort, José Almino, Fernando Dusi Rocha e Mário Medeiros.
- **Pendente (decisão humana)**: Luiz Bras é pseudônimo de Nelson de Oliveira (mesmo QID, Q4333755). Eles continuam como duas pessoas, e o build avisa.
- **Fonte de 2017**: `portal-assets.icnetworks.org` dá 403. A `fonte_1` aponta para a cópia do Wayback.
