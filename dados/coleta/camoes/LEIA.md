# Prêmio Camões: coleta bruta

O Camões premia o **conjunto da obra** de uma pessoa, sem livro. Entra na base como a categoria `Conjunto da obra`, com o premiado em `homenageados.csv` e sem `lista_*.csv`. Coletado em nov/2026. **Nada foi integrado ainda**: falta `normalizar` e a pesquisa de pessoas.

- **38 edições, 1989–2026, com um premiado por ano.** O protocolo de 1988 diz que o prêmio "não pode ser outorgado a mais do que uma personalidade em cada ano nem pode deixar de ser atribuído" (artigos 3.º e 11.º, citados na pt.wikipedia). Por isso nenhum ano ficou sem prêmio nem teve prêmio dividido, e `vagas_premio = 1` em todos.
- **Júri de todos os 38 anos.** São 6 nomes por ano (228 lugares) e 112 jurados distintos.
- **139 pessoas distintas** entre premiados e jurados. **68 já estão na base**, todas em `casamentos.csv`, e **71 são novas**. Dos premiados, 23 já estão na base e 15 são novos.
- 11 pessoas foram jurado e premiado: Agustina Bessa-Luís, Alberto da Costa e Silva, Ana Paula Tavares, Eduardo Lourenço, Germano Almeida, José Craveirinha, João Ubaldo Ribeiro, Mia Couto, Pepetela, Silviano Santiago e Vítor Aguiar e Silva. O ano de cada papel está em `observacao` de `homenageados.csv`.

## Fontes

1. **Base de prêmios literários da DGLAB** (fonte 1 de 1989 a 2025): https://livro.dglab.gov.pt/sites/DGLB/Portugues/premios/Paginas/PremioDetalhe.aspx?PremioId=61. Traz ano, local da reunião do júri, os 6 jurados e o premiado. A página tem 10 páginas de 4 anos, e cada página só abre por *postback* ASP.NET: a URL é sempre a mesma. Para repetir a coleta, faça um GET, pegue os campos ocultos (`__VIEWSTATE`, `__EVENTVALIDATION`, `__REQUESTDIGEST`…), mande um POST com o botão `ctl00$ctl41$g_db80e781_5e00_4808_bd64_0558e3b2dd49$ctl00$ctlNN` = número da página e mantenha os cookies. Responde a curl, sem cota de busca.
2. **pt.wikipedia "Prémio Camões"** (fonte 2 dos premiados de 1989 a 2025; `action=raw`). Cada linha da tabela de laureados cita uma matéria de imprensa, e o ano e o premiado batem com a DGLAB em todos os anos.
3. **2026** ainda não está na base da DGLAB. O premiado e o júri vêm do comunicado do governo português (https://portugal.gov.pt/pt/gc25/comunicacao/comunicados/lidia-jorge-e-a-vencedora-do-premio-camoes-2026) e da PublishNews (https://www.publishnews.com.br/materias/2026/07/03/lidia-jorge-e-a-vencedora-do-premio-camoes-de-literatura-2026). A PublishNews dá o nome completo e o país de cada jurado. A matéria do Público confirma o ano, mas fica atrás de *paywall*.
4. A página do Camões no gov.br da FBN (`.../premios-literarios-1/premio-camoes-de-literatura`) dá 404. O Wayback não conectou durante a coleta, e não foi preciso.

## Arquivos

- `edicoes.csv`: uma linha por ano, com regime "1989– conjunto da obra, um premiado por ano".
- `categorias_edicao.csv`: `nome_original = Prêmio Camões`, `categoria = Conjunto da obra`, `etapa_lista = premiados`, `vagas_lista`/`vagas_curta` vazios e `vagas_premio = 1`. O local da reunião do júri vai em `observacao`. Ele alterna entre Lisboa e Rio de Janeiro (1998 foi em Lisboa de novo), e 2026 foi online.
- `homenageados.csv`: `nome_original = Prêmio Camões`. `observacao` traz o país (como na pt.wikipedia), a grafia da DGLAB quando difere, os anos em que a pessoa também foi jurada e as anomalias.
- `jurados_AAAA.csv` (1989–2026): `nome` é a grafia usual ou a da base, e a grafia da DGLAB fica em `observacao` quando difere.
- `casamentos.csv`: todas as 68 pessoas que já estão em `pessoa.csv`, com `pessoa_id` e o QID da base. Também entram as de nome igual, para não caírem em `casamentos_revisar.csv`, que é o que acontece quando o casamento com outro prêmio sai só pelo nome.

## Anomalias

- **2006, José Luandino Vieira recusou o prêmio.** A DGLAB marca "recusado pelo autor", e o Diário de Notícias (25/5/2006) diz "razões pessoais". Ele continua como premiado do ano. A pt.wikipedia dá os dois países, Angola e Portugal.
- **2016, Raduan Nassar**: o prêmio foi entregue em fevereiro de 2017 (G1, 17/2/2017).
- **2019, Chico Buarque**: Bolsonaro não assinou o diploma, e o prêmio só foi entregue em 2023.
- **2020–2023**: o anúncio saiu em outubro, e não em maio ou junho como nos outros anos.
- **2010**: o júri tornou público que Hélia Correia também foi considerada. Ela foi premiada em 2015.
- **Composição do júri**: de 1989 a 2001, a DGLAB lista 3 brasileiros e 3 portugueses, sem africanos. A regra 2+2+2 (Portugal, Brasil, outros países lusófonos) veio com o protocolo modificativo de 1999, mas os primeiros africanos só aparecem em 2002: Craveirinha (Moçambique) e Pepetela (Angola). Daí em diante há sempre dois.
- **Erros de grafia da DGLAB**, corrigidos em `nome` (o original fica em `observacao`):

| DGLAB | `nome` |
|---|---|
| António Houaisse | Antônio Houaiss |
| João Escatimburgo | João de Scantimburgo |
| Moacyr Seliar | Moacyr Scliar |
| Lella Perrone Moises | Leyla Perrone-Moisés |
| Herberto Salles | Herberto Sales |
| Lygia Fagundes Teles | Lygia Fagundes Telles |
| Nelida Piñon | Nélida Piñon |

  Nomes civis completos viraram o nome usual: "Maria Agustina Ferreira Teixeira Bessa Luís" → Agustina Bessa-Luís, "Luís Augusto de Sampaio Forjaz de Ricaldes Trigueiros" → Luís Forjaz Trigueiros, "Óscar Luso de Freitas Lopes" → Óscar Lopes, "Maria Lucia Santaella Braga" → Lucia Santaella, e assim por diante.
- **Casamentos com conferência pendente**:
  - `Cleber Ranieri Ribas` (Bibliotecas Nacionais 2022) é provavelmente o "Cléber Ranieri Ribas de Almeida" do júri de 2023 e 2024: os dois foram indicados pela FBN, e no Camões o nome vem mais completo.
  - `Antônio Torres` (1995) é provavelmente o romancista brasileiro. A DGLAB grafa "António", mas no regime 3+3 ele fica no lado brasileiro.
- **Mesma pessoa com grafias diferentes na própria DGLAB**, unificadas:
  - Fernando Martinho (2007) e Fernando J. B. Martinho (1997–1998), provavelmente a mesma pessoa.
  - Clara Rocha (2013) e Clara Crabbé Rocha (2024).
  - Ana Martinho (2021) e Ana Maria Martinho (2022).
  - Raul César Fernandes (2021) e Raúl Cesar Gouveia Fernandes (2022).
  - Afonso/Affonso Romano de Sant'Anna.
  - António/Antonio Hohlfeldt.
- **Lopito Feijóo**: a DGLAB (2025) grafa "José André da Silva Feijó". O nome civil é João André da Silva Feijóo (pt.wikipedia), e o júri de 2026 o cita como Lopito Feijóo. O mandato de 2 anos explica a repetição de 2025 para 2026.
- **Homônimos descartados**: `artur-oscar-lopes` (Q19969087) é um matemático brasileiro, não o crítico Óscar Lopes. `raul-fernandes` é um ilustrador do Jabuti 2014. `jose-mauro-de-vasconcelos` não é José Carlos de Vasconcelos.

## O que faltou

- Pesquisa de gênero, raça e nascimento das 71 pessoas novas, que é outra etapa. QIDs das pessoas novas também não foram procurados.
- O país de cada jurado de 1989 a 2025: a DGLAB não diz qual vaga cada um ocupa. Só 2026 tem o país, que vem da PublishNews.
- Fonte 2 independente para os jurados de 1989 a 2025: só há a DGLAB.
