# Relatório de organização — SERÁ QUEM FAZ? v3.9.7

Data: 04/11/2026 (referência do projeto). Base: v3.9.6.

## Resultados de limpeza e preservação

- **Antes:** 230 arquivos; 14.89 MiB não compactados.
- **Depois:** 189 arquivos incluindo este relatório; aproximadamente 3.80 MiB antes de acrescentá-lo.
- **Redução:** aproximadamente 74.5% nos bytes da distribuição de código antes do relatório.
- Descartados screenshots de testes antigos, prévias de versões anteriores e `assets/favicon.svg` sem referências.
- Notas históricas movidas para `docs/versoes/` e relatórios para `docs/relatorios/`.
- Guias agrupados em `docs/contas/`, `docs/catalogo/`, `docs/financeiro/`, `docs/interface/`, `docs/seguranca/` e `docs/operacao/`.
- Páginas HTML e todos os ativos de interface **identicamente preservados, byte a byte**, em comparação com a v3.9.6.
- URLs históricas de 51 fotografias das categorias mantidas via `assets/category-original-images.js` e banco.
- Nenhuma alteração no Supabase, no GitHub, em autenticação real ou nas cobranças.

## Testes realizados

- `npm run verify`: **168/168** testes Node aprovados, incluindo verificações adicionais de integridade do projeto.
- Arquivos Python: compilação de sintaxe sem erros.
- Chromium (dados simulados): catálogo em 1440 px e 390 px, com busca de município, 13 categorias simuladas, paginação, filtros e alternância grade/lista; sem overflow e sem erros de JavaScript.
- Chromium: catálogo com snapshot de **51/51 URLs originais** em desktop e celular, além do fallback da API pública.
- Os testes de navegador não substituem homologação real de Supabase e Mercado Pago.
- Pacote de implantação será validado sem SQL, testes, Markdown, relatórios ou segredos.

## Pacotes de distribuição

- **Site:** `dist/SeraQuemFaz_site_v3.9.7.zip` — arquivos públicos da interface (HTML, assets, cabeçalhos), para hospedagem.
- **Código:** `dist/SeraQuemFaz_codigo_v3.9.7.zip` — código completo, documentação, SQL, workflows, testes e histórico, para desenvolvimento e repositório.
- `.artifacts/` e `dist/` são ignorados pelo Git e não entram no ZIP de código.

## Itens mantidos por compatibilidade

- HTML na raiz: links e páginas já utilizados no navegador (`categorias.html`, `painel.html` etc.).
- JS em `assets/*.js`: caminhos importados diretamente pelos HTML e testes; uma migração de módulos exigiria planejamento específico.
- SQL legado em `supabase/migrations/`: preservado para auditoria, **não executar indiscriminadamente em produção**.
- Arquivos de marca no `assets/brand/`, inclusive formatos alternativos não utilizados na tela inicial.

## Pontos de atenção

- O usuário deverá substituir a versão antiga pela **pasta completa** da v3.9.7 para aproveitar o README e o índice de documentos.
- No servidor HTTP, publicar somente os arquivos contidos na pasta `SeraQuemFaz-site-v3.9.7/`.
- Testar login e upload com contas reais após implantação das migrações e política de domínios do Supabase.
- A origem das imagens do catálogo é externa e requer revisão de licenças antes de publicação comercial.
