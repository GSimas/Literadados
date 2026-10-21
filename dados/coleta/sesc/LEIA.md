# Prêmio Sesc de Literatura: coleta bruta

Quinto prêmio da base (spec CA-26.18, tarefa T28), coletado pelo `PROTOCOLO_COLETA.md` desta pasta. Organizador: Sesc,
Departamento Nacional. **Premia originais inéditos de autores estreantes no gênero**, inscritos com pseudônimo; o vencedor é
publicado depois (Record de 2004 a 2023, Editora Senac Rio desde 2024). Por isso `premio.obras = ineditas`, e todo texto que
apresenta o prêmio diz que ele não julga livros do mercado.

- **23 edições, 2004–2026, 47 vencedores**: Romance (2004–), Conto (`Contos`, 2006–), Poesia (2024–). A edição de 2026
  (resultado de 19/08/2026, 2.969 inscritos) foi acrescentada em out/2026, com o júri completo (dois por categoria).
- **Lista = só os vencedores** (`etapa_lista = premiados`): os finalistas de 2012–2013 saíram com pseudônimo e ficam fora.
- **Editora vazia na indicação** (concorreu como original); a editora e o ano de publicação do livro estão em `observacao`.
- **Ano:** o do anúncio do resultado, como na Wikipédia e na página atual do Sesc. O site antigo numerava pelo ano da inscrição
  ("Prêmio Sesc 2003" = Cremasco, vencedor de 2004); a numeração do Sesc e o ordinal da edição estão em `observacao`.
  As datas de anúncio de 2005–2009 não foram confirmadas (Márcio Ribeiro Leite "venceu em 2008" segundo Folha e Record;
  ficou em 2009, com a nota).

## Fontes

Página atual do Sesc (API WordPress `sesc.com.br/wp-json/wp/v2/premio_literatura`, com os posts dos vencedores de 2004–2026),
páginas antigas no Wayback, PublishNews, Folha, Record e pt.wikipedia. 36 das 44 linhas têm duas fontes independentes; 8
(2006 C, 2007, 2008, 2011 C, 2012 R, 2013 R) têm o Sesc e a Wikipédia.

## Júri (`jurados_AAAA.csv`)

17 edições com jurados publicados (79 linhas): por categoria em 2004, 2006, 2009–2011, 2014–2016, 2020, 2022–2023; comissão
comum (repetida em cada categoria) em 2018, 2019 e 2024; por categoria em 2026; 2025 só com Eliana Alves Cruz. Sem júri achado em 2005, 2007,
2008, 2012, 2013 e 2021 (o de 2017 foi achado na redação do texto de contexto, na página do Sesc arquivada). Os comentadores do catálogo de 2010 (Cony, Ajzenberg e outros) provavelmente foram jurados,
mas nenhuma fonte diz: ficaram fora.

## Anomalias e decisões

- **2022:** a página atual do Sesc troca as categorias (Mikaia em Conto); o anúncio de 2022 e o PublishNews põem Mikaia em Romance.
- **Títulos que mudaram na publicação** (original em `observacao`): *Outro outono de carne estranha* → *Outono de carne
  estranha* (2023); "Poraquê e outros contos" → *O abridor de letras* (2017); "Magdalena usa as mãos" → *Entre as mãos* (2018).
- **Poesia 2024:** Igor Sarapuí foi anunciado e depois impugnado (já tinha livro de poesia); fica só Antonio Veloso Maia.
- **Erro antigo corrigido na base:** `mario-rodrigues` tinha o QID, o nascimento (Recife, 1885) e a foto do jornalista Mário
  Rodrigues, pai de Nelson Rodrigues; o vencedor de 2016 é o contista de Garanhuns (PE). Os dados do homônimo saíram de
  `pessoas_edicoes_6.csv`, `pessoa.csv`, `pessoa_midia.csv` e `web/fotos/`, e a pessoa voltou para a pesquisa.
- **Duplicatas antigas unificadas:** Alexandre Marques (São Paulo, *Entropia*) = Alexandre Marques Rodrigues; Eneida Maria de
  Sousa (júri do Oceanos 2011) = Eneida Maria de Souza.
- **Grafias** como na base (João Vereza, Maurício de Almeida, Marcos Peres), com a da fonte em `observacao`.

## Pessoas e textos

- 66 nomes casados com a base (inclusive os 4 jurados de 2017), 18 pessoas novas, pesquisadas em `../pessoas_sesc_1.csv`
  com Mário Rodrigues (refeito: Garanhuns, PE, 1977): 19 com gênero com fonte, 14 com UF de nascimento, nenhuma
  autodeclaração racial. REVISAR: Tônio Caetano (está na antologia "Ancestralidades: escritores negros" — inclusão em
  antologia não é autodeclaração).
- Textos de contexto das 23 edições (`../contexto/lote_9.csv`; 2026 em `lote_10.csv`). Retirada do texto de 2024 a frase sobre o processo de
  Henrique Rodrigues contra o Sesc (vinha de um resumo de segunda mão; a reportagem original não foi lida).
- **A conferir:** o catálogo do Sesc diz que *Zé, Mizé, camarada André* (Sérgio Guimarães) foi finalista do Portugal Telecom
  2008, e a lista do Oceanos 2008 da base não o tem; o número de inscritos de 2014 (456) destoa das edições vizinhas.
