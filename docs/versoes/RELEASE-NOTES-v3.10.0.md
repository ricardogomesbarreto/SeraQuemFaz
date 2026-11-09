# SERÁ QUEM FAZ? — v3.10.0

## Atualização de experiência e operação
- **Perfis modernos:** organização de clientes e prestadores com menu lateral responsivo e identidade visual azul-marinho e laranja.
- **Orçamentos:** propostas reais, condições, pesquisa das solicitações e comparação informativa de preços recebidos.
- **Mensagens:** conversa privada entre os participantes, atualização de histórico e leitura protegida por RLS.
- **Agenda:** proposta de data e horário após aceite de orçamento; confirmação ou recusa obrigatoriamente pela outra parte.
- **Notificações:** central privada no painel, marcação de leitura e preferência de e-mail.
- **Portfólio:** fotos organizadas e filtradas por serviços do prestador.
- **Catálogo:** filtros e ordenação por avaliações publicadas, quantidade de serviços e portfólio.
- **Desempenho:** métricas reais de atividades e visualizações autenticadas, sem dados demonstrativos.
- **Administração:** indicadores agregados, exportação CSV, triagem de suporte com MFA e trilha de auditoria; índices de relacionamento adicionados ao banco.
- **PWA:** instalação em origem HTTPS ou localhost, cache limitado a páginas públicas.
- **Central de ajuda:** perguntas frequentes, registro de pedidos e acompanhamento.

## Qualidade e segurança
- CI Node.js 22 e 24 aprovada para o código consolidado da `main` (commit de consolidação `70e8a4a799000ea7673f216896475641205a7347`).
- Migrações de marketplace, permissões de gatilhos e auditoria de suporte aplicadas ao Supabase conectado; sem exposição anônima dos dados privados.
- Correções da v3.9.19 (51 categorias ativas para usuários autenticados) preservadas.

## Arquivos para download
- `SeraQuemFaz_site_v3.10.0.zip`: páginas e recursos necessários para servir o site.
- `SeraQuemFaz_codigo_v3.10.0.zip`: projeto completo, migrações, documentação e testes.

## Pendências de homologação
**Esta release não autoriza operação comercial imediata.** Permanecem pendentes testes ponta a ponta com cliente e prestador reais, verificação visual em múltiplos dispositivos, homologação da PWA no domínio HTTPS e configuração/validação de um provedor SMTP ou e-mail transacional. O envio por e-mail continua desativado até configuração externa. O checkout permanece desativado. Não se deve interpretar os indicadores como volume real de operações ainda inexistentes.
