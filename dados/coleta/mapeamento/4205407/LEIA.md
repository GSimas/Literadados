# Mapeamento literário de Florianópolis (código IBGE 4205407)

Protocolo de coleta do módulo Mapeamento (spec RF-34, design D40). É um **cadastro curado**, não um censo: entra só o que
tem fonte pública e foi conferido. Na dúvida, fica de fora (ou vai para `candidatas.csv` com o motivo).

Todo CSV desta pasta é escrito com o módulo `csv` do Python (nunca à mão), UTF-8, com cabeçalho exatamente como abaixo.
Datas em ISO (`2026-11-20`). Fonte é sempre uma URL (`http…`) da página onde a informação está.

## Definições (CA-34.4 a CA-34.8)

- **Livraria:** estabelecimento cuja atividade principal é vender livros ao público. Entra loja física (com bairro) e
  livraria só on-line com sede na cidade (tipo `online`, sem endereço). Papelaria, banca e loja que vende livro de forma
  secundária ficam fora. Precisa de sinal público de funcionamento (site, rede social com publicação recente, matéria,
  página de evento). Tipos: `geral`, `sebo`, `especializada` (com `foco`: infantil, religiosa, universitária, quadrinhos…),
  `cafe_livraria`, `online`. `rede = true` só para filial de rede nacional ou regional.
- **Editora:** sede em Florianópolis e ao menos um livro publicado verificável (ISBN, catálogo de biblioteca ou página da
  editora). Tipos: `comercial`, `universitaria`, `independente`, `artesanal` (cartonera, fanzine). Edição do autor não é editora.
- **Autora ou autor:** pessoa com ao menos um livro publicado verificável e vínculo com a cidade:
  - `nascimento`: nasceu em Florianópolis (não precisa coletar aqui: sai do local de nascimento da pessoa na base);
  - `atuacao`: vive ou trabalha na cidade, dito numa fonte pública (minibiografia de editora, entrevista, site da pessoa,
    página de instituição). "Catarinense" sozinho não basta.
- **Obra:** livro de pessoa ou editora mapeada, ou passado na cidade (`ambientada = 1`, com fonte que diga isso).
- **Clube do livro:** grupo com encontros recorrentes para discutir livros e com canal público (site, rede social, página
  de livraria ou biblioteca).

## Privacidade (DB-6) — obrigatório

- Só dados públicos e profissionais de pessoas. Nunca endereço, telefone ou e-mail pessoal.
- Endereço só de estabelecimento aberto ao público. CNPJ de MEI/pessoa física: não registre o nome do titular nem o endereço
  se não for uma loja aberta ao público.
- Clube que se reúne em casa: `local_tipo = casa`, sem bairro, sem local e sem coordenadas. Organizador de clube
  independente: `organizacao = independente` (nunca o nome da pessoa).
- Raça: só autodeclaração pública com trecho literal (mesmo protocolo do resto da base); nunca inferir. Gênero: com fonte;
  sem fonte, deixe vazio (a atribuição pelo nome é feita depois, à parte).

## Arquivos

### `editoras.csv`
`nome,tipo,municipio_sede,site,situacao,ano_encerramento,fonte,verificado_em,observacao`
(`municipio_sede` = `Florianópolis`; `situacao` ∈ `ativa`, `encerrada`, `incerta`).

### `livrarias.csv` (vira `dados/livraria.csv`)
`nome,tipo,foco,rede,endereco,bairro,lat,lon,site,redes,situacao,ano_abertura,ano_encerramento,fonte,verificado_em,observacao`
(`rede` = `true`/`false`; coordenadas em graus decimais com 5 casas, do ponto do OpenStreetMap ou do Nominatim pelo endereço;
`redes` = perfis públicos separados por ` ; `).

### `clubes.csv` (vira `dados/clube.csv`)
`nome,formato,periodicidade,foco,aberto,organizacao,local_tipo,livraria,local_nome,bairro,lat,lon,link,situacao,fonte,verificado_em,observacao`
(`formato` ∈ `presencial`, `online`, `hibrido`; `local_tipo` ∈ `livraria`, `biblioteca`, `cafe`, `espaco_publico`, `casa`, `online`;
`livraria` = nome exato da livraria em `livrarias.csv` quando o encontro é numa delas; `aberto` = `true`/`false`/vazio).

### `obras.csv`
`titulo,autores,ilustradores,organizadores,editora,ano,isbn,ambientada,fonte,verificado_em,observacao`
(nomes separados por `|`, como nas listas dos prêmios; `ambientada` = `1` só com fonte).

### `pessoas.csv` (vínculo de atuação)
`nome,vinculo,fonte,verificado_em,observacao` (`vinculo` = `atuacao`).

### `pessoas_floripa_N.csv` (em `dados/coleta/`, raiz: pesquisa de pessoas, aplicada por `aplicar_pessoas`)
Cabeçalho dos outros `pessoas_*.csv`: `id,nome,wikidata,genero,genero_fonte,raca,raca_evidencia,raca_fonte,raca_trecho,raca_busca,ano_nascimento,municipio_nascimento,uf_nascimento,pais_nascimento,nascimento_fonte,observacao`.
O `id` é o slug do nome (minúsculas, sem acento, hífens), igual ao que o `normalizar` gera.

### `casamentos.csv`
`nome,wikidata,pessoa_id` — toda pessoa que **já está na base** (mesmo com grafia igual), com o `pessoa_id` de lá.

### `candidatas.csv` (fora do site; conferência humana)
Livrarias e editoras do CNPJ ou do OpenStreetMap que não entraram, com o motivo.

### `remocoes.csv`
`pessoa_id,data` — pedidos de remoção atendidos (o `normalizar` respeita).

## Fontes sem cota de busca que funcionam por curl

- OpenStreetMap: Overpass API (`https://overpass-api.de/api/interpreter`, consulta `shop=books` na área do município) e
  Nominatim (`https://nominatim.openstreetmap.org/search?format=json&q=…`, 1 pedido por segundo, User-Agent só com o nome e a
  URL do projeto: `Literadados (https://literadados.gustavosimas.com)`).
- API da pt.wikipedia (`prop=extracts|pageprops`; categorias como "Naturais de Florianópolis") e Wikidata (`wbsearchentities`).
- Sites de editoras e livrarias (catálogos, páginas "quem somos").
- Base do próprio projeto: `dados/pessoa.csv` (quem nasceu em Florianópolis), `dados/editora.csv` (sede).

Depois de coletar: `python coleta.py normalizar`, `python coleta.py aplicar_pessoas`, `python build.py`.
