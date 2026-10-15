-- JabutiDados — modelo de dados (DuckDB; também roda no SQLite)
-- Carga: uma aba da planilha → um CSV → INSERT INTO <tabela> BY NAME SELECT * FROM read_csv('<tabela>.csv');
-- (DuckDB lê célula vazia como NULL; o .import do SQLite grava '' e burlaria os CHECKs.)
-- Recorte: Prêmio Jabuti 2010–2025 · Romance, Contos, Poesia, Crônica, Infantil, Juvenil, Livro do Ano
--
-- IDs são slugs legíveis ('conceicao-evaristo', 'olhos-dagua') para que cada aba da
-- planilha de coleta vire uma tabela direto, sem script de conversão.

CREATE TABLE uf (
  uf              TEXT PRIMARY KEY,           -- sigla; 'EX' = nascido fora do Brasil
  nome            TEXT NOT NULL,
  regiao          TEXT NOT NULL CHECK (regiao IN ('Norte','Nordeste','Centro-Oeste','Sudeste','Sul','Exterior')),
  populacao_2022  INTEGER                     -- Censo IBGE 2022 (preencher na coleta), para taxas per capita
);

CREATE TABLE pessoa (
  id                    TEXT PRIMARY KEY,
  nome                  TEXT NOT NULL,        -- como aparece nos créditos
  wikidata              TEXT,                 -- QID do Wikidata, confirmado por humano
  genero                TEXT NOT NULL DEFAULT 'nao_identificado'
                        CHECK (genero IN ('mulher','homem','nao_binario','nao_identificado')),
  genero_fonte          TEXT,
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
  nascimento_fonte      TEXT,
  revisado_em           TEXT,                 -- data ISO da última checagem humana
  CHECK (raca = 'sem_declaracao' OR (raca_evidencia IS NOT NULL AND raca_fonte IS NOT NULL)),
  CHECK (raca = 'sem_declaracao' OR raca_busca IS DISTINCT FROM 'parcial')
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

CREATE TABLE autoria (
  obra_id    TEXT NOT NULL REFERENCES obra(id),
  pessoa_id  TEXT NOT NULL REFERENCES pessoa(id),
  papel      TEXT NOT NULL DEFAULT 'autor' CHECK (papel IN ('autor','ilustrador','organizador')),
  PRIMARY KEY (obra_id, pessoa_id, papel)
);

-- Uma linha por categoria por edição: traduz o nome oficial para a categoria padronizada
-- e guarda o número de vagas, para que as séries temporais usem taxas e não contagens.
CREATE TABLE categoria_edicao (
  ano            INTEGER NOT NULL CHECK (ano BETWEEN 2010 AND 2025),
  nome_original  TEXT NOT NULL,               -- ex. 'Contos e Crônicas', 'Romance Literário'
  categoria      TEXT NOT NULL CHECK (categoria IN ('Romance','Contos','Poesia','Crônica','Infantil','Juvenil','Infantil e Juvenil','Livro do Ano')),
  vagas_lista    INTEGER,                     -- tamanho da 1ª lista pública (≈10 nos dois regimes)
  vagas_curta    INTEGER,                     -- 2ª lista (≈5); NULL se a edição não teve
  vagas_premio   INTEGER NOT NULL,            -- 3 até 2017, 1 a partir de 2018
  fonte          TEXT NOT NULL,
  PRIMARY KEY (ano, nome_original)
);

-- Cada linha = uma obra que entrou na 1ª lista pública de uma categoria.
-- O Livro do Ano entra só com a obra vencedora (colocacao = 1).
CREATE TABLE indicacao (
  ano            INTEGER NOT NULL,
  nome_original  TEXT NOT NULL,
  obra_id        TEXT NOT NULL REFERENCES obra(id),
  lista_curta    INTEGER CHECK (lista_curta IN (0,1)),  -- NULL quando a edição não teve 2ª lista
  colocacao      INTEGER CHECK (colocacao IN (1,2,3)),  -- NULL = não premiada
  fonte          TEXT NOT NULL,
  PRIMARY KEY (ano, nome_original, obra_id),
  FOREIGN KEY (ano, nome_original) REFERENCES categoria_edicao(ano, nome_original)
);

CREATE TABLE jurado (
  ano            INTEGER NOT NULL,
  nome_original  TEXT NOT NULL,
  pessoa_id      TEXT NOT NULL REFERENCES pessoa(id),
  fonte          TEXT NOT NULL,
  PRIMARY KEY (ano, nome_original, pessoa_id),
  FOREIGN KEY (ano, nome_original) REFERENCES categoria_edicao(ano, nome_original)
);

-- Tabela larga para análise, dashboard e IA (texto→SQL): uma linha por pessoa por indicação.
CREATE VIEW v_participacao AS
SELECT
  i.ano,
  CASE WHEN i.ano <= 2017 THEN '2010–2017 pódio'
       WHEN i.ano = 2018  THEN '2018 transição'
       ELSE '2019–2025 vencedor único' END              AS regime,
  c.categoria, c.nome_original,
  o.id AS obra_id, o.titulo, o.ano_publicacao,
  e.nome AS editora, e.grupo AS grupo_editorial, e.uf_sede AS uf_editora,
  p.id AS pessoa_id, p.nome, a.papel,
  p.genero, p.raca, p.raca_busca,
  p.raca IN ('preta','parda','negra')                   AS negra,
  p.uf_nascimento, u.regiao                            AS regiao_nascimento,
  i.ano - p.ano_nascimento                              AS idade_no_premio,
  i.lista_curta,
  i.colocacao,
  i.colocacao IS NOT NULL                               AS premiada,
  COALESCE(i.colocacao = 1, FALSE)                      AS vencedora
FROM indicacao i
JOIN categoria_edicao c USING (ano, nome_original)
JOIN obra o           ON o.id = i.obra_id
LEFT JOIN editora e   ON e.id = o.editora_id
JOIN autoria a        ON a.obra_id = o.id
JOIN pessoa p         ON p.id = a.pessoa_id
LEFT JOIN uf u        ON u.uf = p.uf_nascimento;

-- Cobertura por edição: o dashboard mostra isto ao lado de qualquer número demográfico.
CREATE VIEW v_cobertura AS
SELECT
  ano,
  COUNT(DISTINCT pessoa_id)                                                        AS pessoas,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN genero <> 'nao_identificado' THEN pessoa_id END) / COUNT(DISTINCT pessoa_id), 1) AS pct_genero,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN uf_nascimento IS NOT NULL THEN pessoa_id END)    / COUNT(DISTINCT pessoa_id), 1) AS pct_uf,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN raca <> 'sem_declaracao' THEN pessoa_id END)     / COUNT(DISTINCT pessoa_id), 1) AS pct_raca,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN raca_busca = 'completa' THEN pessoa_id END)     / COUNT(DISTINCT pessoa_id), 1) AS pct_busca_raca,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN idade_no_premio IS NOT NULL THEN pessoa_id END)  / COUNT(DISTINCT pessoa_id), 1) AS pct_idade
FROM v_participacao
WHERE papel = 'autor'
GROUP BY ano;

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
