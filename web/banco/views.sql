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

CREATE VIEW v_vinculo AS
SELECT 'pessoa' AS entidade, v.pessoa_id AS entidade_id, v.codigo AS municipio, 'nascimento' AS tipo, p.nascimento_fonte AS fonte
FROM v_pessoa_municipio v JOIN pessoa p ON p.id = v.pessoa_id
UNION ALL
SELECT 'pessoa', pessoa_id, municipio, 'atuacao', fonte FROM pessoa_atuacao
UNION ALL
SELECT DISTINCT 'obra', c.obra_id, pv.municipio, 'autoria', NULL
FROM (SELECT obra_id, pessoa_id FROM autoria WHERE papel IN ('autor','ilustrador')
      UNION SELECT obra_id, pessoa_id FROM mapeamento_autoria WHERE papel IN ('autor','ilustrador')) c
JOIN (SELECT pessoa_id, codigo AS municipio FROM v_pessoa_municipio UNION SELECT pessoa_id, municipio FROM pessoa_atuacao) pv ON pv.pessoa_id = c.pessoa_id
UNION ALL
SELECT DISTINCT 'obra', o.obra_id, em.codigo, 'editora', NULL
FROM (SELECT id AS obra_id, editora_id FROM obra UNION SELECT obra_id, editora_id FROM indicacao WHERE editora_id IS NOT NULL) o
JOIN v_editora_municipio em ON em.editora_id = o.editora_id
UNION ALL
SELECT 'obra', obra_id, municipio, 'ambientacao', fonte FROM obra_mapeada WHERE ambientada;

CREATE VIEW v_pessoa_mapeada AS
SELECT v.municipio, p.id AS pessoa_id, p.nome, p.genero, p.genero_evidencia, p.raca, p.raca_evidencia, p.raca_fonte, p.raca_trecho,
       p.ano_nascimento, p.municipio_nascimento, p.uf_nascimento,
       bool_or(v.tipo = 'nascimento') AS nasceu, bool_or(v.tipo = 'atuacao') AS atua,
       p.raca IN ('preta','parda','negra') AS negra
FROM v_vinculo v JOIN pessoa p ON p.id = v.entidade_id
WHERE v.entidade = 'pessoa' AND v.municipio IN (SELECT municipio FROM obra_mapeada UNION SELECT municipio FROM editora_mapeada
                                                UNION SELECT municipio FROM livraria UNION SELECT municipio FROM pessoa_atuacao)
  AND p.id IN (SELECT pessoa_id FROM autoria WHERE papel IN ('autor','ilustrador','organizador')
               UNION SELECT pessoa_id FROM mapeamento_autoria)
GROUP BY ALL;
