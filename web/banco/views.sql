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
JOIN autoria a        ON a.obra_id = o.id
JOIN pessoa p         ON p.id = a.pessoa_id
LEFT JOIN uf u        ON u.uf = p.uf_nascimento;

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
