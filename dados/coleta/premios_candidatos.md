# Prêmios candidatos ao Literadados (levantamento de out/2026)

Verificação de viabilidade antes da coleta (spec RF-26, DA-1). Cada dado foi lido na fonte (curl em sites oficiais,
Wayback/CDX, PublishNews, pt.wikipedia, PDFs oficiais); "não encontrado" quer dizer que a fonte não foi achada, não que
não exista. 16 buscas web no total (3 agentes, teto de 40 cada).

**Critério do Literadados:** livro publicado (não inédito, não conjunto da obra), categorias do recorte (romance, conto,
crônica, poesia, infantil, juvenil, livro do ano), e de preferência uma lista pública mais ampla que os vencedores
(finalistas, semifinalistas, inscritos), com autoria e editora, para medir quem *chega* ao prêmio.

## Tabela comparativa

| Prêmio | País | Edições | Tipo | Categorias no recorte | Lista pública mais ampla | Fonte das listas (curl) | Restrição que distorce | Prioridade |
|---|---|---|---|---|---|---|---|---|
| **Prêmio São Paulo de Literatura** | BR | 2008–ativo, anual, sem lacuna | Livro publicado | Romance do Ano, Romance de Estreia (2013–2018 dividida por idade) | 10 finalistas por categoria, com editora, desde 2008 (5 em 2008) | Site oficial, uma página (`/edicoes-anteriores/`) | Só romance; estreia por declaração | **Alta** |
| **Prêmio Literário da Biblioteca Nacional** | BR | 1995–ativo (2003 sem edição, 2004 prêmio único) | Livro publicado | Romance, Conto, Poesia, Infantil, Juvenil, Crônica (2026) | Todas as obras habilitadas (2016, 2022–2026; ~700 a ~1.500/ano); pódio 1º–3º desde 2018; finalistas 2017; antes só vencedor | gov.br (PDFs, 2022+), Wayback (2011–2021) | Só autor brasileiro, inscrição pelo próprio autor (autosseleção); janela de publicação ≠ ano civil | **Alta** |
| **Prêmio FNLIJ** | BR | 1975–2025 (51 edições); 2026 ameaçado (votantes saíram em mar/2026) | Livro publicado (inclui traduções) | Criança (infantil), Jovem (juvenil), Poesia infantojuvenil; Reconto e Revelação no limite | "Altamente Recomendáveis" (~130–170/ano, desde ≥2000) + premiados (17–25/ano, com Hors-Concours) | Site **fora do ar**; Wayback (`--http1.1`) e PublishNews | Traduções e estrangeiros a filtrar; editora envia exemplares; Hors-Concours | **Alta** para infantil/juvenil — coletar logo, enquanto o Wayback guarda |
| **Prémio PEN Clube Português** | PT | 1981–ativo; desde ~2023 alterna Poesia+Narrativa / Ensaio+Tradução | Livro publicado | Narrativa (romance e conto juntos), Poesia | 5 finalistas por categoria desde 2019 (com editora em 2020–2021); antes só vencedor (ex aequo comuns) | Domínio **perdido** (redireciona); tudo no Wayback; vencedores na pt.wikipedia | Estrangeiro só se sócio do PEN; obras de 2 anos concorrem juntas | **Média-alta** (19 de 21 nomes 2019–2025 já na base) |
| **Prêmio Candango de Literatura** | BR (DF) | 2022 e 2025; nova edição anunciada para 2026 | Livro publicado (lusófono) | Romance, Contos, Poesia | ~10–12 finalistas por categoria; PDF de 2025 traz **local de nascimento** do autor | Site oficial + PublishNews | Aberto a PT/África (filtrar); editoras pequenas; série curta | **Média** |
| **Grandes Prémios APE/DGLAB** | PT | Romance e Novela 1982–ativo; Conto 1991–; Poesia (várias séries) 1988–; Crónica 2015– | Livro publicado | Romance/novela, conto, poesia, crónica | Só vencedores (~120 no total) | `apescritores.pt` (só **http**) + Wayback | Romance só para autor português; ano do rótulo = ano de publicação; página do romance com erros depois de 2018 | **Média** |
| **Prêmio APCA de Literatura** | BR | 1972–ativo (sem seção 1987, 2010; 2021 sem livro) | Livro publicado, escolha da crítica | Romance, contos/crônicas, poesia, infantil/juvenil (categorias mudam a cada ano) | Só vencedores (finalistas só em 2015) | Site **suspenso**; Wayback (1972–2016 numa página) + PublishNews | Sem inscrição (crítica escolhe); categorias instáveis | **Média-baixa** |
| **Prêmio Rio de Literatura** | BR | 2016–2020 (4 edições), encerrado | Livro publicado | Prosa de ficção, Poesia (a partir da 3ª) | ~10 finalistas por categoria (edições 2–4) | Site 404; Wayback + PublishNews | Série curta e encerrada; "Ficção" misturava poesia até 2017 | **Baixa-média** |
| **Prêmio Kindle de Literatura** | BR | 2016/17–ativo | Romance **autopublicado** (KDP) | Romance | 5 finalistas por edição | PublishNews (Amazon dá 503) | População de autopublicados, filtrada pela Amazon por "potencial comercial" | **Baixa-média** (contraste, não comparação) |
| **Prémio LeYa** | PT (lusófono) | 2008–ativo (sem vencedor em 2010, 2016, 2019; 2020 suspenso) | Romance **inédito**, com pseudônimo | Romance | Vencedores; finalistas só como título + pseudônimo | leya.com + Wayback; PDF com finalistas publicados depois | Manuscritos, pré-seleção editorial interna | **Média-baixa** (só vencedores) |
| **Prêmios da ABL por gênero** | BR | 1999–2015; nenhum em 2016–2025; novos em 2026 (Guimarães Rosa, Manuel Bandeira) | Livro publicado, escolha interna | Ficção (com teatro), Poesia, Infantojuvenil (até 2015) | Só vencedores | academia.org.br (banco de prêmios) + PublishNews | Escolha de comissão de acadêmicos; série quebrada | **Baixa** |
| **Prêmio Sesc de Literatura** | BR | 2004–ativo | **Inédito** de estreante, com pseudônimo | Romance, Conto (2006–), Poesia (2024–) | Vencedores; finalistas só em 2012–2013 e só com pseudônimo | sesc.com.br + Wayback + pt.wikipedia | Estreantes e inéditos | **Baixa** |
| **Prêmio Carolina Maria de Jesus** (MinC) | BR | Só 2023 | **Inédito**, só mulheres, com cotas | Romance, conto, crônica, poesia | 61 selecionadas (73 com ampliação) com nota, cota e UF | gov.br (PDF) + PublishNews | Gênero fixo; raça é regra de cota; UF provavelmente de residência | **Baixa** (estudo de caso à parte) |
| **Prêmio AGES Livro do Ano** | BR (RS) | ≥2003–ativo | Livro publicado | Narrativa longa e curta, crônica, poesia, infantil, juvenil, livro do ano | Homologados e finalistas em 2020, 2021, 2026 | ages.org.br (links quebrados, finalistas recentes só para sócios) | Só autores do RS (anula a análise por UF); vencedor por voto de sócios | **Baixa** |
| **Prémio José Saramago** | PT (lusófono) | 1999–ativo, bienal | Publicado até 2019; **inédito** desde 2022 | Romance | Só vencedores (13) | pt.wikipedia; site atrás de Cloudflare (Wayback ok) | Autor até 40 anos | **Baixa** (12 de 13 já na base) |
| **Prémio BCI de Literatura** | MZ | 2010–2019 (provavelmente extinto) | Livro publicado | Categoria única (mistura ensaio) | Só vencedores (~11) | bci.co.mz + WP-JSON de opais.co.mz | Só autor moçambicano | **Baixa** |
| **Prémio José Craveirinha** | MZ | 2003–ativo, irregular | Livro do ano até 2007; **conjunto da obra** desde 2009 | Categoria única (2003–2007) | Só vencedores | pt.wikipedia + imprensa | Só moçambicanos; fora do recorte desde 2009 (DA-2) | **Baixa** |
| Prêmio Paraná de Literatura | BR (PR) | 2012–2023, intermitente | Inédito | — | Só vencedor | bpp.pr.gov.br | Inéditos, sem finalistas | Descartado |
| Prémio Sagrada Esperança | AO | 1980–, esparso | Inclui ensaio | — | Só vencedores esparsos | pt.wikipedia (site não responde) | Inativo por longos períodos | Descartado |

## Ordem sugerida

1. **São Paulo de Literatura** — uma página oficial, 18 anos de finalistas com editora; compara direto com o Romance do Jabuti.
2. **Biblioteca Nacional** — cobre todas as categorias do recorte e é o único com a lista inteira de inscritos (habilitados), o que abre uma etapa nova antes da "lista".
3. **FNLIJ** — infantil e juvenil, 50 anos, com uma lista ampla (Altamente Recomendáveis); o site oficial já saiu do ar, então convém salvar as fontes antes que se percam.
4. **PEN Clube Português** — lista curta desde 2019, quase todos os autores já na base.
5. Depois, como séries só de vencedores: APE (por gênero, PT) e APCA (crítica, BR); Candango quando a 3ª edição sair.

## Decisões que a coleta vai pedir

- **Inscritos como etapa:** a Biblioteca Nacional publica todas as obras habilitadas. O vocabulário de `etapa_lista` hoje vai de `indicados` a `premiados`; seria preciso uma etapa anterior (`inscritos`), ou guardar só a partir do pódio.
- **Só vencedores:** APE, APCA, ABL e os moçambicanos entram com `etapa_lista = premiados`, como o Jabuti de 1959–1999. O painel já avisa quando não há lista pública.
- **Inéditos com pseudônimo** (LeYa, Saramago 2022+, Sesc): finalistas sem autor não servem para perfil; se entrarem, só vencedores, e marcados como inéditos (não misturar com livro publicado).
- **FNLIJ:** como mapear Criança/Jovem/Poesia para Infantil/Juvenil/Poesia; filtrar traduções; tratar Hors-Concours (vários premiados sem colocação).
- **Cota como autodeclaração** (Carolina Maria de Jesus): a categoria de cota publicada pelo Estado vale como `autodeclaracao`? Hoje a regra exige trecho literal e URL; a lista oficial tem URL, mas não trecho.
- **Nacionalidade:** a FBN só aceita brasileiros; o PEN só aceita estrangeiros sócios; a APE (romance) só portugueses. Os textos do painel precisam dizer isso ao comparar prêmios.
