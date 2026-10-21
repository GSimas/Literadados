# Protocolo de coleta de imagens (fotos de pessoas-autoras e capas)

Decisão do responsável pelo projeto (out/2026): vale imagem com direitos autorais, desde que **toda imagem tenha a fonte
visível** (site e link da página onde ela está). O Literadados não guarda cópia dessas imagens: o site as exibe a partir da
própria fonte (como já faz com as capas da Open Library). Fotos com licença livre do Commons continuam como estão.

## Filas

- `fila_fotos.csv`: pessoas-autoras sem foto (`pessoa_id,nome,wikidata,wikipedia_pt,obras`). `obras` traz até três livros
  com prêmio e ano, para confirmar a identidade.
- `fila_capas.csv`: obras indicadas sem capa (`obra_id,titulo,autores,editora,ano`). `ano` é o da 1ª indicação.

## Saída

Um CSV por agente, gravado com o módulo `csv` do Python (UTF-8), nesta pasta:

- Fotos: `fotos_<fonte>.csv` com o cabeçalho `pessoa_id,nome,imagem_url,pagina,fonte,observacao`
- Capas: `capas_<fonte>.csv` com o cabeçalho `obra_id,titulo,capa_url,pagina,fonte,observacao`

Só linhas com imagem achada (quem ficou sem imagem não entra). `pessoa_id`/`obra_id` e `nome`/`titulo` exatamente como na fila.

- `imagem_url` / `capa_url`: URL **direta** da imagem (https), que responde 200 com `Content-Type: image/*` **sem**
  cabeçalho Referer e também com `Referer: https://literadados.gustavosimas.com/` (há sites que bloqueiam imagem em
  outro domínio). Prefira a maior versão estável (sem token que expira, sem `?v=` que muda sozinho, quando der). Mínimo de
  ~150 px de largura.
- `pagina`: a página onde a imagem aparece (é o link do crédito). Nunca a URL de uma busca.
- `fonte`: nome legível do site, curto: `Companhia das Letras`, `Wikipédia (en)`, `Prêmio Sesc`, `Martins Fontes`,
  `Estante Virtual`, `Enciclopédia Itaú Cultural`…
- `observacao`: como a identidade foi confirmada (ex.: "página do autor na editora, com 'Torto arado'"), ou dúvida.

## Identidade (o mais importante)

Foto de homônimo é pior que nenhuma foto.

- **Foto:** a página tem de nomear a pessoa **e** ligá-la a um livro da fila, a um prêmio da base ou à profissão no meio
  literário com dado que bata (cidade, editora). Perfil de editora com um livro da base vale. Página genérica com o nome não
  vale. Recuse: foto de grupo (quando não dá para saber quem é), silhueta/avatar padrão, logotipo, capa no lugar da foto,
  ilustração/caricatura (a não ser que a página diga que é a pessoa e não haja outra), foto de outra pessoa na matéria.
- **Capa:** título normalizado (sem acento, caixa e pontuação) igual ou com subtítulo a mais, **e** sobrenome de um autor
  igual. Edição em português. Prefira a edição da editora/ano da fila; outra edição em português vale, anote em `observacao`.
  Recuse imagem genérica ("sem capa", "imagem indisponível").

## Regras gerais

- `curl` não gasta a cota de busca web; prefira APIs e páginas por curl. User-Agent:
  `Literadados (https://literadados.gustavosimas.com)` (nunca e-mail). Algumas lojas exigem User-Agent de navegador: use
  `Mozilla/5.0` sem dados pessoais. Pausa de ~0,3–1 s entre pedidos ao mesmo site; respeite 429.
- Teto de buscas web: o número dado no pedido.
- Não edite nenhum outro arquivo do projeto. Scripts e caches ficam no scratchpad indicado no pedido.
- Ao terminar, informe: fontes usadas, quantas imagens por fonte, buscas gastas, falsos positivos recusados e o que ficou.
