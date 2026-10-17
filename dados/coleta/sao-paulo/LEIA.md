# Prêmio São Paulo de Literatura: coleta bruta

Terceiro prêmio da base (spec CA-26.16, tarefa T26), no modelo do Oceanos: `lista_AAAA.csv`, `categorias_edicao.csv`,
`edicoes.csv`, `jurados_AAAA.csv` e `casamentos.csv` nesta pasta; `coleta.py normalizar` leva tudo para `dados/*.csv`.

- **18 edições, 2008–2025, 352 obras finalistas, 42 vencedoras** (uma por categoria e edição; três categorias em 2013–2018), de 40 pessoas.
- O ano é o da **edição** (anúncio); os livros são do ano anterior ("Melhor Romance de 2024" = edição 2025).
- Organizador: Governo do Estado de São Paulo (Secretaria da Cultura, Economia e Indústria Criativas), operação da SP Leituras.
- Só romance, escrito em português, 1ª edição publicada no Brasil; autor de outro país lusófono pode concorrer. `editora_pais` = BR em tudo.

## Categorias e formato

Todas mapeiam para `categoria = Romance`; o `nome_original` distingue (D31, CA-26.16).

| Edições | `nome_original` | Finalistas | Vencedor |
|---|---|---|---|
| 2008 | Melhor Romance do Ano; Melhor Romance de Estreia | 5 + 5 | 1 + 1 |
| 2009–2012 | idem | 10 + 10 | 1 + 1 |
| 2013–2018 | Melhor Romance do Ano; Melhor Romance de Estreia (autor até 40 anos); (autor com mais de 40 anos) | 10 + 3 a 7 + 3 a 7 | 1 + 1 + 1 |
| 2019–2025 | Melhor Romance do Ano; Melhor Romance de Estreia | 10 + 10 (11 na estreia de 2021) | 1 + 1 |

`etapa_lista = finalistas` (a 1ª lista pública; o número de inscritos sai na imprensa, a lista não). Não há 2ª lista nem colocação além do vencedor.

## Fontes

- **Principal:** https://premiosaopaulodeliteratura.org.br/edicoes-anteriores/ (uma página com 2008–2025; o vencedor vem com a classe `u-bg-primary` no `<p>`; responde a curl).
- **Segunda fonte por ano:**
  - 2008–2012, 2015–2021, 2023–2024: pt.wikipedia "Prêmio São Paulo de Literatura" (finalistas com ISBN, vencedor com fita azul; a seção de 2022 cita a própria página oficial e não conta).
  - 2013: PublishNews, 11/10/2013 (lista da época, com as faixas de idade); vencedores pela página oficial arquivada em 2015.
  - 2014: página oficial arquivada em 23/12/2014 (finalistas, com editora); vencedores no PublishNews de 11/11/2014.
  - 2022 e 2025: PublishNews (matérias de finalistas e de vencedores).
- **Júri final** (`jurados_AAAA.csv`): Wikipédia (2008–2013, 2015–2017, 2021) e PublishNews (2025). Júri comum às categorias: repete em cada `nome_original`. 2014, 2018–2020 e 2022–2024 ficaram sem júri (a fonte não traz a lista do júri final ou só a traz com descrições que não separei com segurança); os curadores e o júri inicial ficaram de fora.

## Anomalias e decisões

- **2013, faixas de idade trocadas na página atual.** A página oficial de hoje põe *Antiterapias* (Jacques Fux), *Quiçá* e *Suicidas* em "+40" e os outros seis em "−40". A lista da época (PublishNews 11/10/2013), a Wikipédia e a página oficial arquivada em 2015 (vencedores "Jacques Fux (−40)" e "Paula Fábrio (+40)") dizem o contrário. Vale o registro da época.
- **2013, finalista omitida.** *A condessa de Picaçurova*, de Antônio Salvador (Prólogo), está na lista de até 40 anos da época e tem página no site oficial arquivado (`finalista/104`), mas não aparece na página atual. Entrou, com as duas fontes.
- **Grafias corrigidas** (original em `observacao`): "O evangelho segundo Hittler" → Hitler; "Milton Hatoun" → Hatoum.
- **Coautoria:** só onde a fonte confirma (*O verão do Chibo*, Vanessa Barbara e Emilio Fraia; *O canto dela*, Ana Kiffer e Marie-Aude Alia). "Carlos de Brito e Mello" é um nome só.
- **Editoras:** grafias da página oficial reduzidas à forma já usada na base quando é a mesma casa ("Todavia Editora" → Todavia, "Editora 7 Letras" → 7Letras, "Saraiva/Benvirá" → Benvirá, "Alfaguara/Objetiva" → Alfaguara, "Editora Schwarcz - Grupo Companhia das Letras" → Editora Schwarcz, que o `canonico` leva à Companhia das Letras). A grafia original fica em `observacao`. Três grafias geravam um segundo id com o nome de uma editora existente (Quelônio, Taverna, Maralto) e foram unificadas por `canonico` em `../editoras_enriquecidas.csv`; o build agora recusa nome de editora repetido.

## Pessoas

- `casamentos.csv`: 181 nomes que já estão na base (nome igual, conferido; e três grafias diferentes: "Caetano W. Galindo" → `caetano-galindo`, "Francisco J.C. Dantas" → `francisco-j-c-dantas`, "Fred Di Giacomo" → `fred-di-giacomo-rocha`, autor de *Desamparo* e de *Gambé*).
- 145 pessoas novas (autores e jurados), pesquisadas pelo protocolo `../PROTOCOLO_PESSOAS.md` em `../pessoas_sp_1.csv` a `_3.csv` (3 agentes, 164 buscas web; Wikipédia por API, catálogo VTEX da Martins Fontes, páginas de autor de editoras).
- A pesquisa achou **7 pessoas que já estavam na base com o nome mais curto ou mais longo** (mesmo QID ou mesma pessoa conferida): Estêvão Andozia Azevêdo → `estevao-azevedo`, Ronaldo Cagiano Barbosa → `ronaldo-cagiano`, Alcir Pécora → `antonio-alcir-bernardez-pecora`, Heloisa Beatriz Goulart Jahn → `heloisa-jahn`, Fábio Lucas Gomes → `fabio-lucas`, Raphael Montes de Carvalho → `raphael-montes`, Javier Contreras → `javier-arancibia-contreras`. Foram para `casamentos.csv`, e as linhas órfãs saíram de `dados/pessoa.csv`. Ficam 138 pessoas novas.
- **Resultado (autores do São Paulo, 263 pessoas):** gênero com fonte ou atribuído em quase todas (39 atribuídos pelo nome, em `../pessoas_zgenero_4.csv`); 3 autodeclarações novas, conferidas na página-fonte: Lilia Guerra (preta, entrevista à Quatro Cinco Um), Eliane Marques (negra, Literafro) e Ketty Valencio (jurada de 2021; negra, Vermelho). Jurados ficaram com busca de raça `parcial` (teto de buscas).
- **REVISAR** (ascendência, não autodeclaração; ficaram `sem_declaracao`): Ronaldo Wrobel, Hanaide Kalaigian, Luize Valente.
- **A conferir:** "Rafael Zoheler" (assim na página oficial) pode ser Rafael Zoehler (catálogo da Martins Fontes); Marcelo Cid sem identidade confirmada; Antônio Salvador é pseudônimo de Júlio César Pereira; jurados identificados por nome e área (Elisabeth Brait = Beth Brait, Plínio Martins = Plinio Martins Filho, Roberta Ferraz). Ano de nascimento de Emmanuel Mirdad retirado (deduzido de "quarta década de vida").

## Reprodução

A página oficial foi lida com um parser de `<article class="books-accordion__layout">` (título da seção no `<h1>`, cada obra num `<p>` com `<strong>título</strong> de Autor | Editora`) e conferida, ano a ano, contra a Wikipédia e o PublishNews. Os scripts ficaram fora do repositório.
