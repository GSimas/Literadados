-- Literadados — modelo de dados (DuckDB; também roda no SQLite)
-- Carga: uma aba da planilha → um CSV → INSERT INTO <tabela> BY NAME SELECT * FROM read_csv('<tabela>.csv');
-- (DuckDB lê célula vazia como NULL; o .import do SQLite grava '' e burlaria os CHECKs.)
-- Recorte: prêmios de `premio` (hoje só o Jabuti, 1959–2025) · Romance, Contos, Poesia, Crônica, Infantil, Juvenil, Livro do Ano
--
-- IDs são slugs legíveis ('conceicao-evaristo', 'olhos-dagua') para que cada aba da
-- planilha de coleta vire uma tabela direto, sem script de conversão.

CREATE TABLE uf (
  uf              TEXT PRIMARY KEY,           -- sigla; 'EX' = nascido fora do Brasil
  nome            TEXT NOT NULL,
  regiao          TEXT NOT NULL CHECK (regiao IN ('Norte','Nordeste','Centro-Oeste','Sudeste','Sul','Exterior')),
  populacao_2022  INTEGER                     -- Censo IBGE 2022 (preencher na coleta), para taxas per capita
);

-- Prêmios da base (RF-26, design D31). ordem só ordena listas, facetas e a coleta; o painel abre com todos (DA-4).
-- Prêmio pelo conjunto da obra (Camões, Machado de Assis) entra à parte, na tabela distincao (DA-2 revista, RF-30, D36).
CREATE TABLE premio (
  id           TEXT PRIMARY KEY,               -- slug ('jabuti', 'oceanos')
  nome         TEXT NOT NULL,
  organizador  TEXT NOT NULL,
  ano_inicio   INTEGER NOT NULL,               -- 1ª edição; o build recusa edição anterior a ela
  abrangencia  TEXT NOT NULL CHECK (abrangencia IN ('nacional','lusofono')),
  -- O que o prêmio julga (CA-26.18): livros publicados ou originais inéditos (Sesc). Inéditos não se comparam com livros do mercado.
  obras        TEXT NOT NULL DEFAULT 'publicadas' CHECK (obras IN ('publicadas','ineditas')),
  ordem        INTEGER NOT NULL UNIQUE CHECK (ordem >= 1),  -- explícita: um prêmio mais antigo não vira o padrão sem querer
  fonte        TEXT NOT NULL
);

-- Território comum dos módulos (RF-32, D38): códigos do IBGE; os níveis não colidem (BR · região 1 dígito · UF 2 · município 7).
-- Gerado por coleta.py territorio. A tabela uf (sigla, EX) continua servindo ao módulo Prêmios; o build confere as duas.
CREATE TABLE territorio (
  codigo          TEXT PRIMARY KEY,
  tipo            TEXT NOT NULL CHECK (tipo IN ('pais','regiao','uf','municipio')),
  nome            TEXT NOT NULL,
  sigla           TEXT,                       -- UF ('SC') e país ('BR')
  pai             TEXT,                       -- nível acima: município → UF → região → BR
  populacao_2022  INTEGER,                    -- Censo 2022; vazio só para município instalado depois do Censo
  CHECK ((tipo = 'pais') = (pai IS NULL)),
  CHECK (tipo <> 'uf' OR sigla IS NOT NULL),
  CHECK (tipo <> 'municipio' OR regexp_full_match(codigo, '[0-9]{7}'))
);

-- Nome de município da base que não casa com o IBGE pelo nome (grafia antiga, bairro, distrito): decisão humana (CA-32.3).
-- codigo vazio = não é município (a fonte só dá o estado) ou não achado; observacao diz qual.
CREATE TABLE municipio_casamento (
  municipio   TEXT NOT NULL,
  uf          TEXT NOT NULL,
  codigo      TEXT REFERENCES territorio(codigo),
  observacao  TEXT NOT NULL,
  PRIMARY KEY (municipio, uf)
);

CREATE TABLE pessoa (
  id                    TEXT PRIMARY KEY,
  nome                  TEXT NOT NULL,        -- como aparece nos créditos
  wikidata              TEXT,                 -- QID do Wikidata, confirmado por humano
  genero                TEXT NOT NULL DEFAULT 'nao_identificado'
                        CHECK (genero IN ('mulher','homem','nao_binario','nao_identificado')),
  genero_fonte          TEXT,
  -- 'atribuicao' = gênero atribuído pelo primeiro nome, sem fonte que o afirme (design D16); NULL = com fonte.
  genero_evidencia      TEXT CHECK (genero_evidencia IN ('atribuicao')),
  -- Raça só entra com autodeclaração pública; nunca inferida por foto, sobrenome ou IA.
  -- 'negra' = declarou-se negra sem especificar preta ou parda.
  raca                  TEXT NOT NULL DEFAULT 'sem_declaracao'
                        CHECK (raca IN ('branca','preta','parda','negra','amarela','indigena','sem_declaracao')),
  raca_evidencia        TEXT CHECK (raca_evidencia IN ('autodeclaracao','fonte_curada')),
  raca_fonte            TEXT,                 -- URL
  raca_trecho           TEXT,                 -- citação literal da autodeclaração
  raca_busca            TEXT CHECK (raca_busca IN ('completa','parcial')),  -- protocolo de busca cumprido ou interrompido
  ano_nascimento        INTEGER,
  municipio_nascimento  TEXT,
  uf_nascimento         TEXT REFERENCES uf(uf),
  -- País de nascimento (DA-3), ISO 3166-1 alfa-2, só para quem nasceu fora do Brasil (uf_nascimento = 'EX').
  -- Quem tem UF brasileira é 'BR' por definição: a view deriva, sem repetir em 1.000 linhas.
  pais_nascimento       TEXT CHECK (pais_nascimento IS NULL OR (regexp_full_match(pais_nascimento, '[A-Z]{2}') AND pais_nascimento <> 'BR')),
  nascimento_fonte      TEXT,
  revisado_em           TEXT,                 -- data ISO da última checagem humana
  CHECK (raca = 'sem_declaracao' OR (raca_evidencia IS NOT NULL AND raca_fonte IS NOT NULL)),
  CHECK (raca = 'sem_declaracao' OR raca_busca IS DISTINCT FROM 'parcial'),
  CHECK (pais_nascimento IS NULL OR uf_nascimento = 'EX'),
  CHECK (genero_evidencia IS NULL OR (genero <> 'nao_identificado' AND genero_fonte IS NULL))
);

-- Foto e verbete (interface, design D15). Só foto do Commons com licença livre e crédito; gerado por coleta.py midia.
CREATE TABLE pessoa_midia (
  pessoa_id           TEXT PRIMARY KEY REFERENCES pessoa(id),
  imagem              TEXT,                   -- nome do arquivo no Wikimedia Commons
  imagem_autor        TEXT,
  imagem_licenca      TEXT,
  imagem_licenca_url  TEXT,
  wikipedia_pt        TEXT,                   -- título do verbete na pt.wikipedia
  CHECK (imagem IS NULL OR (imagem_autor IS NOT NULL AND imagem_licenca IS NOT NULL)),
  CHECK (imagem_licenca IS NULL OR lower(imagem_licenca) LIKE 'cc by%' OR lower(imagem_licenca) LIKE 'cc-by%'
         OR lower(imagem_licenca) LIKE 'cc0%' OR lower(imagem_licenca) LIKE 'public domain%'
         OR lower(imagem_licenca) LIKE 'pd%' OR lower(imagem_licenca) = 'attribution')
);

CREATE TABLE editora (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  grupo           TEXT,                       -- conglomerado (ex. 'Penguin Random House'); NULL = independente
  municipio_sede  TEXT,
  uf_sede         TEXT REFERENCES uf(uf)
);

CREATE TABLE obra (
  id              TEXT PRIMARY KEY,
  titulo          TEXT NOT NULL,
  editora_id      TEXT REFERENCES editora(id), -- ponytail: só a editora principal; tabela obra_editora se coedições pesarem
  ano_publicacao  INTEGER
);

-- Marca oficial exibida da fonte; nenhuma cópia de logotipo de terceiros no site (CA-29.4).
CREATE TABLE editora_logo (
  editora_id TEXT PRIMARY KEY REFERENCES editora(id),
  imagem_url TEXT NOT NULL CHECK (imagem_url LIKE 'https://%'),
  pagina TEXT NOT NULL CHECK (pagina LIKE 'https://%'),
  fonte TEXT NOT NULL,
  fundo TEXT NOT NULL DEFAULT 'claro' CHECK (fundo IN ('claro', 'escuro'))
);

-- Capa de cada obra (RF-24): imagem exibida a partir da fonte (não guardamos cópia), com link para a página dela.
CREATE TABLE obra_capa (
  obra_id   TEXT PRIMARY KEY REFERENCES obra(id),
  capa_url  TEXT NOT NULL CHECK (capa_url LIKE 'https://%'),
  fonte     TEXT NOT NULL,                  -- 'google_books', 'open_library' ou o nome legível do site (D34)
  pagina    TEXT CHECK (pagina IS NULL OR pagina LIKE 'http%'),
  CHECK (fonte IN ('google_books', 'open_library') OR pagina IS NOT NULL)  -- crédito com link sempre
);
-- Foto com direitos reservados (CA-11.3, D34): exibida da própria fonte, com crédito; só para quem não tem foto livre.
CREATE TABLE pessoa_foto (
  pessoa_id  TEXT PRIMARY KEY REFERENCES pessoa(id),
  foto_url   TEXT NOT NULL CHECK (foto_url LIKE 'https://%'),
  pagina     TEXT NOT NULL CHECK (pagina LIKE 'http%'),
  fonte      TEXT NOT NULL
);

-- Crédito por prêmio (RF-26): o mesmo livro pode ser creditado de forma diferente em cada prêmio (a CBL credita
-- ilustradores como autores em 2023; outro prêmio pode listar um coautor). Uma indicação só vê o crédito do próprio prêmio.
CREATE TABLE autoria (
  premio_id  TEXT NOT NULL REFERENCES premio(id),
  obra_id    TEXT NOT NULL REFERENCES obra(id),
  pessoa_id  TEXT NOT NULL REFERENCES pessoa(id),
  papel      TEXT NOT NULL DEFAULT 'autor' CHECK (papel IN ('autor','ilustrador','organizador')),
  PRIMARY KEY (premio_id, obra_id, pessoa_id, papel)
);

-- Uma linha por edição de cada prêmio. O regime (formato da premiação) é dado da edição, não regra da view.
CREATE TABLE edicao (
  premio_id  TEXT NOT NULL REFERENCES premio(id),
  ano        INTEGER NOT NULL,
  regime     TEXT NOT NULL,                   -- ex. '2010–2017 pódio', '2019–2026 vencedor único'
  -- O que a edição julgou, quando difere do prêmio (CA-26.20): o Saramago premiava livro publicado até 2019 e inédito desde 2022.
  obras      TEXT CHECK (obras IN ('publicadas','ineditas')),  -- NULL = premio.obras
  fonte      TEXT NOT NULL,
  PRIMARY KEY (premio_id, ano)
);

-- Texto de contexto de cada edição (RF-28, CA-28.3), escrito pelo protocolo dados/coleta/contexto/PROTOCOLO.md.
CREATE TABLE edicao_contexto (
  premio_id  TEXT NOT NULL,
  ano        INTEGER NOT NULL,
  texto      TEXT NOT NULL CHECK (length(texto) >= 200),
  fontes     TEXT NOT NULL CHECK (fontes LIKE 'http%'),  -- URLs separadas por ' ; '; pelo menos uma
  revisar    TEXT,                                       -- o que pede conferência humana (vazio = sustentado)
  PRIMARY KEY (premio_id, ano),
  FOREIGN KEY (premio_id, ano) REFERENCES edicao(premio_id, ano)
);

-- Uma linha por categoria por edição: traduz o nome oficial para a categoria padronizada
-- e guarda o número de vagas, para que as séries temporais usem taxas e não contagens.
CREATE TABLE categoria_edicao (
  premio_id      TEXT NOT NULL,
  ano            INTEGER NOT NULL,
  nome_original  TEXT NOT NULL,               -- ex. 'Contos e Crônicas', 'Romance Literário'
  -- Taxonomia comum a todos os prêmios (CA-26.3); 'Geral' = categoria única, com prosa e poesia concorrendo juntas;
  -- 'Prosa' = romance, conto, crônica e dramaturgia juntos, sem poesia (Oceanos 2023 em diante).
  -- 'Conjunto da obra' = prêmio por pessoa, sem livro (RF-30): os premiados ficam em distincao, nunca em indicacao.
  categoria      TEXT NOT NULL CHECK (categoria IN ('Romance','Contos','Poesia','Crônica','Infantil','Juvenil','Infantil e Juvenil','Livro do Ano','Geral','Prosa','Conjunto da obra')),
  vagas_lista    INTEGER,                     -- tamanho da 1ª lista pública (≈10 nos dois regimes)
  vagas_curta    INTEGER,                     -- 2ª lista (≈5); NULL se a edição não teve
  vagas_premio   INTEGER NOT NULL,            -- 3 até 2017, 1 a partir de 2018
  -- O que é a 1ª lista ali (CA-26.4): sem lista pública, 'premiados' (a etapa lista = só as premiadas).
  etapa_lista    TEXT NOT NULL CHECK (etapa_lista IN ('indicados','semifinalistas','finalistas','premiados')),
  fonte          TEXT NOT NULL,
  PRIMARY KEY (premio_id, ano, nome_original),
  FOREIGN KEY (premio_id, ano) REFERENCES edicao(premio_id, ano)
);

-- Cada linha = uma obra que entrou na 1ª lista pública de uma categoria.
-- O Livro do Ano entra só com a obra vencedora (colocacao = 1).
CREATE TABLE indicacao (
  premio_id      TEXT NOT NULL,
  ano            INTEGER NOT NULL,
  nome_original  TEXT NOT NULL,
  obra_id        TEXT NOT NULL REFERENCES obra(id),
  lista_curta    INTEGER CHECK (lista_curta IN (0,1)),  -- NULL quando a edição não teve 2ª lista
  colocacao      INTEGER CHECK (colocacao BETWEEN 1 AND 5),  -- NULL = não premiada; 4 e 5 só em 1993 (premiados sem pódio, ordem da Wikipédia)
  editora_id     TEXT REFERENCES editora(id), -- a edição que concorreu (CA-26.6); vazio = sem fonte da época. obra.editora_id
                                              -- é só a 1ª editora conhecida, para o perfil do livro
  fonte          TEXT NOT NULL,
  PRIMARY KEY (premio_id, ano, nome_original, obra_id),
  FOREIGN KEY (premio_id, ano, nome_original) REFERENCES categoria_edicao(premio_id, ano, nome_original)
);

CREATE TABLE jurado (
  premio_id      TEXT NOT NULL,
  ano            INTEGER NOT NULL,
  nome_original  TEXT NOT NULL,
  pessoa_id      TEXT NOT NULL REFERENCES pessoa(id),
  fonte          TEXT NOT NULL,
  PRIMARY KEY (premio_id, ano, nome_original, pessoa_id),
  FOREIGN KEY (premio_id, ano, nome_original) REFERENCES categoria_edicao(premio_id, ano, nome_original)
);

-- Prêmio pelo conjunto da obra (RF-30, D36): uma linha por pessoa distinguida. Fica fora de v_participacao e das métricas
-- por livro; a categoria da edição é 'Conjunto da obra' (o júri continua em jurado).
CREATE TABLE distincao (
  premio_id      TEXT NOT NULL,
  ano            INTEGER NOT NULL,
  nome_original  TEXT NOT NULL,               -- ex. 'Prêmio Camões', 'Prêmio Machado de Assis'
  pessoa_id      TEXT NOT NULL REFERENCES pessoa(id),
  fonte          TEXT NOT NULL,
  PRIMARY KEY (premio_id, ano, nome_original, pessoa_id),
  FOREIGN KEY (premio_id, ano, nome_original) REFERENCES categoria_edicao(premio_id, ano, nome_original)
);

-- Tabela larga para análise, dashboard e IA (texto→SQL): uma linha por pessoa por indicação.
CREATE VIEW v_participacao AS
SELECT
  i.premio_id                                           AS premio,
  pr.nome                                               AS premio_nome,
  i.ano,
  ed.regime,
  c.categoria, c.nome_original,
  o.id AS obra_id, o.titulo, o.ano_publicacao,
  e.nome AS editora, e.grupo AS grupo_editorial, e.uf_sede AS uf_editora,
  p.id AS pessoa_id, p.nome, a.papel,
  p.genero, COALESCE(p.genero_evidencia = 'atribuicao', FALSE) AS genero_atribuido,
  p.raca, p.raca_busca,
  p.raca IN ('preta','parda','negra')                   AS negra,
  p.uf_nascimento,
  CASE WHEN p.uf_nascimento <> 'EX' THEN 'BR' ELSE p.pais_nascimento END AS pais_nascimento,  -- ISO 3166-1 (DA-3)
  u.regiao                                              AS regiao_nascimento,
  i.ano - p.ano_nascimento                              AS idade_no_premio,
  i.lista_curta,
  i.colocacao,
  i.colocacao IS NOT NULL                               AS premiada,
  COALESCE(i.colocacao = 1, FALSE)                      AS vencedora
FROM indicacao i
JOIN premio pr        ON pr.id = i.premio_id
JOIN edicao ed        ON ed.premio_id = i.premio_id AND ed.ano = i.ano
JOIN categoria_edicao c ON c.premio_id = i.premio_id AND c.ano = i.ano AND c.nome_original = i.nome_original
JOIN obra o          ON o.id = i.obra_id
LEFT JOIN editora e   ON e.id = i.editora_id  -- a edição que concorreu (CA-26.6), nunca herdada de outro ano ou prêmio
JOIN autoria a        ON a.obra_id = o.id AND a.premio_id = i.premio_id  -- crédito do próprio prêmio
JOIN pessoa p         ON p.id = a.pessoa_id
LEFT JOIN uf u        ON u.uf = p.uf_nascimento;

-- Conjunto da obra (RF-30, CA-30.5): uma linha por distinção, com os atributos de pessoa de v_participacao.
-- Não é indicação de livro: nunca some com v_participacao.
CREATE VIEW v_distincao AS
SELECT
  d.premio_id AS premio, pr.nome AS premio_nome, d.ano, d.nome_original,
  p.id AS pessoa_id, p.nome,
  p.genero, COALESCE(p.genero_evidencia = 'atribuicao', FALSE) AS genero_atribuido,
  p.raca, p.raca_busca, p.raca IN ('preta','parda','negra') AS negra,
  p.uf_nascimento,
  CASE WHEN p.uf_nascimento <> 'EX' THEN 'BR' ELSE p.pais_nascimento END AS pais_nascimento,
  u.regiao AS regiao_nascimento,
  d.ano - p.ano_nascimento AS idade_no_premio
FROM distincao d
JOIN premio pr ON pr.id = d.premio_id
JOIN pessoa p  ON p.id = d.pessoa_id
LEFT JOIN uf u ON u.uf = p.uf_nascimento;

-- Cobertura por edição: o dashboard mostra isto ao lado de qualquer número demográfico.
CREATE VIEW v_cobertura AS
SELECT
  premio,
  ano,
  COUNT(DISTINCT pessoa_id)                                                        AS pessoas,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN genero <> 'nao_identificado' THEN pessoa_id END) / COUNT(DISTINCT pessoa_id), 1) AS pct_genero,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN uf_nascimento IS NOT NULL THEN pessoa_id END)    / COUNT(DISTINCT pessoa_id), 1) AS pct_uf,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN raca <> 'sem_declaracao' THEN pessoa_id END)     / COUNT(DISTINCT pessoa_id), 1) AS pct_raca,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN raca_busca = 'completa' THEN pessoa_id END)     / COUNT(DISTINCT pessoa_id), 1) AS pct_busca_raca,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN idade_no_premio IS NOT NULL THEN pessoa_id END)  / COUNT(DISTINCT pessoa_id), 1) AS pct_idade
FROM v_participacao
WHERE papel = 'autor'
GROUP BY premio, ano;

-- ========== Módulo Leitura (RF-33, D39) ==========
-- Catálogo de indicadores (dados/indicador.csv, editado à mão). limitacoes vai para o Método.
CREATE TABLE indicador (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  definicao   TEXT NOT NULL,
  unidade     TEXT NOT NULL CHECK (unidade IN ('percentual','contagem','media')),
  tipo_fonte  TEXT NOT NULL CHECK (tipo_fonte IN ('censo','registro_administrativo','pesquisa_amostral')),
  nivel       TEXT NOT NULL CHECK (nivel IN ('brasil','regiao','uf','municipio')),  -- nível territorial mais fino
  fonte_nome  TEXT NOT NULL,
  fonte_url   TEXT NOT NULL CHECK (fonte_url LIKE 'http%'),
  limitacoes  TEXT NOT NULL,
  ordem       INTEGER NOT NULL UNIQUE
);

-- Vocabulário fixo de recortes (CA-33.2). Cor ou raça: as categorias do IBGE, autodeclaração de quem respondeu;
-- 'negra' só quando a fonte publica preta e parda juntas.
CREATE TABLE recorte (
  dimensao   TEXT NOT NULL CHECK (dimensao IN ('total','sexo','cor_raca','faixa_etaria','situacao','escolaridade','rede')),
  categoria  TEXT NOT NULL,
  rotulo     TEXT NOT NULL,
  ordem      INTEGER NOT NULL,
  PRIMARY KEY (dimensao, categoria)
);

-- Um valor por indicador, território, ano e recorte (dados/indicador_valor/<indicador>.csv). suprimido = a fonte não publica
-- ou marca o valor como não confiável: valor vazio, mostrado como "não publicado pela fonte", nunca como zero (CA-33.3).
CREATE TABLE indicador_valor (
  indicador_id  TEXT NOT NULL REFERENCES indicador(id),
  territorio    TEXT NOT NULL REFERENCES territorio(codigo),
  ano           INTEGER NOT NULL,
  dimensao      TEXT NOT NULL,
  categoria     TEXT NOT NULL,
  valor         DOUBLE,
  numerador     DOUBLE,
  denominador   DOUBLE,
  amostra       INTEGER,
  margem        DOUBLE,
  suprimido     BOOLEAN NOT NULL DEFAULT false,
  fonte_url     TEXT NOT NULL CHECK (fonte_url LIKE 'http%'),
  PRIMARY KEY (indicador_id, territorio, ano, dimensao, categoria),
  FOREIGN KEY (dimensao, categoria) REFERENCES recorte (dimensao, categoria),
  CHECK (suprimido OR valor IS NOT NULL),
  CHECK (NOT suprimido OR valor IS NULL),
  CHECK (numerador IS NULL OR denominador IS NULL OR numerador <= denominador),
  CHECK (margem IS NULL OR margem >= 0)
);

-- Código IBGE do município de nascimento e da sede (CA-32.3, D38): calculado, não gravado em pessoa.csv/editora.csv
-- (que aplicar_pessoas e normalizar reescrevem). Casa por nome sem acento, caixa e pontuação, dentro da UF; exceções em municipio_casamento.
CREATE VIEW v_pessoa_municipio AS
SELECT p.id AS pessoa_id, COALESCE(mc.codigo, t.codigo) AS codigo
FROM pessoa p
LEFT JOIN municipio_casamento mc ON mc.municipio = p.municipio_nascimento AND mc.uf = p.uf_nascimento
LEFT JOIN (SELECT m.codigo, m.nome, u.sigla FROM territorio m JOIN territorio u ON u.codigo = m.pai WHERE m.tipo = 'municipio') t
  ON mc.municipio IS NULL AND t.sigla = p.uf_nascimento
 AND regexp_replace(strip_accents(lower(t.nome)), '[^a-z0-9]', '', 'g') = regexp_replace(strip_accents(lower(p.municipio_nascimento)), '[^a-z0-9]', '', 'g')
WHERE COALESCE(mc.codigo, t.codigo) IS NOT NULL;

CREATE VIEW v_editora_municipio AS
SELECT e.id AS editora_id, COALESCE(mc.codigo, t.codigo) AS codigo
FROM editora e
LEFT JOIN municipio_casamento mc ON mc.municipio = e.municipio_sede AND mc.uf = e.uf_sede
LEFT JOIN (SELECT m.codigo, m.nome, u.sigla FROM territorio m JOIN territorio u ON u.codigo = m.pai WHERE m.tipo = 'municipio') t
  ON mc.municipio IS NULL AND t.sigla = e.uf_sede
 AND regexp_replace(strip_accents(lower(t.nome)), '[^a-z0-9]', '', 'g') = regexp_replace(strip_accents(lower(e.municipio_sede)), '[^a-z0-9]', '', 'g')
WHERE COALESCE(mc.codigo, t.codigo) IS NOT NULL;

-- Indicador com nome, unidade, território e, para contagem, por 100 mil habitantes (população do Censo 2022; regra no SQL, D13).
CREATE VIEW v_indicador AS
SELECT v.indicador_id AS indicador, i.nome AS indicador_nome, i.unidade, i.tipo_fonte,
       v.territorio, t.nome AS territorio_nome, t.tipo AS territorio_tipo,
       CASE t.tipo WHEN 'municipio' THEN u.sigla WHEN 'uf' THEN t.sigla END AS uf,
       v.ano, v.dimensao, v.categoria, r.rotulo AS categoria_rotulo,
       v.valor, v.numerador, v.denominador, v.amostra, v.margem, v.suprimido,
       CASE WHEN i.unidade = 'contagem' AND t.populacao_2022 > 0 THEN round(v.valor / t.populacao_2022 * 100000, 2) END AS por_100mil,
       v.fonte_url
FROM indicador_valor v
JOIN indicador i ON i.id = v.indicador_id
JOIN territorio t ON t.codigo = v.territorio
LEFT JOIN territorio u ON u.codigo = t.pai
JOIN recorte r ON r.dimensao = v.dimensao AND r.categoria = v.categoria;

INSERT INTO uf (uf, nome, regiao) VALUES
  ('AC','Acre','Norte'), ('AP','Amapá','Norte'), ('AM','Amazonas','Norte'), ('PA','Pará','Norte'),
  ('RO','Rondônia','Norte'), ('RR','Roraima','Norte'), ('TO','Tocantins','Norte'),
  ('AL','Alagoas','Nordeste'), ('BA','Bahia','Nordeste'), ('CE','Ceará','Nordeste'), ('MA','Maranhão','Nordeste'),
  ('PB','Paraíba','Nordeste'), ('PE','Pernambuco','Nordeste'), ('PI','Piauí','Nordeste'),
  ('RN','Rio Grande do Norte','Nordeste'), ('SE','Sergipe','Nordeste'),
  ('DF','Distrito Federal','Centro-Oeste'), ('GO','Goiás','Centro-Oeste'),
  ('MT','Mato Grosso','Centro-Oeste'), ('MS','Mato Grosso do Sul','Centro-Oeste'),
  ('ES','Espírito Santo','Sudeste'), ('MG','Minas Gerais','Sudeste'), ('RJ','Rio de Janeiro','Sudeste'), ('SP','São Paulo','Sudeste'),
  ('PR','Paraná','Sul'), ('RS','Rio Grande do Sul','Sul'), ('SC','Santa Catarina','Sul'),
  ('EX','Exterior','Exterior');
