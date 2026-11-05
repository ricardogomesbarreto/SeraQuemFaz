# SERÁ QUEM FAZ? — v3.6.1

**Marco:** refinamento da interface existente, sem redefinição de identidade, arquitetura ou regras de segurança.

## Implementado

- Catálogo com destaque do município, filtros removíveis e número real de categorias exibidas.
- Cartões de prestadores mais claros, sem pontuações inventadas.
- Perfil com abas acessíveis Sobre, Serviços, Portfólio e Avaliações.
- Distribuição e ordenação de avaliações **já moderadas**, com respostas públicas sujeitas à moderação.
- Foto de perfil com prévia e posicionamento manual; original aceita qualquer orientação, limitada por resolução, tipo, tamanho e recodificada em WebP para remover metadados comuns. O aspecto vertical da interface não é exigência do arquivo.
- Checklist do prestador, progresso de cadastro, filtros administrativos e mensagens de estado.
- Ajustes de acessibilidade inspirados nas recomendações da WCAG 2.2. Não há laudo de conformidade.

## Segurança e compatibilidade

As migrações existentes (v3.4.0–v3.6.0), a exigência de análise humana, a moderação de comentários, o MFA e as consultas Supabase foram mantidos. O filtro administrativo é apenas uma conveniência visual; todas as decisões continuam autorizadas no PostgreSQL.

## Verificação e pendências

Execute `npm run verify`, `python tests/browser-v361.py` e `python tests/browser-smoke-v3_3.py`. Estes testes utilizam dados simulados, não substituem uma homologação de autenticação, uploads, RLS e moderação no Supabase real. O projeto **não foi publicado no GitHub nem implantado no banco remoto**.
