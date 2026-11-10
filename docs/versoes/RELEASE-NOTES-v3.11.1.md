# SERÁ QUEM FAZ? — v3.11.1

## Correções de perfil e catálogo

- **Foto única:** o painel do cliente e do prestador agora mostram o retrato em apenas um círculo; foi removido o aninhamento de um segundo avatar com moldura e borda.
- **Situação cadastral correta:** “Análise não solicitada” é diferente de “Aguardando análise”. O prestador pode abrir diretamente a área de verificação.
- **Prévia privada:** quando o próprio titular abre sua página antes da aprovação, aparece um aviso claro de que clientes ainda não conseguem acessar seu perfil.
- **Catálogo:** quando não existem profissionais publicados na cidade e categoria, a interface explica os critérios de publicação e oferece retorno à busca.
- **Proteção mantida:** cadastros incompletos ou não aprovados não são publicados; nenhuma política RLS foi afrouxada, não houve aprovação automática nem alterações financeiras.
- **Testes:** Node 22 e 24 verificados, com testes novos para fotografia, status e autorização.

## Verificação de publicação

Para que um prestador apareça publicamente, é necessário ter o cadastro e o serviço preenchidos, ativar a publicação do perfil, solicitar análise na tela **Verificação cadastral** e obter aprovação de um administrador com a sessão MFA validada. Até a aprovação, somente o próprio titular vê a prévia privada.

A aprovação não equivale a certificação de identidade ou idoneidade. Esta release não altera os requisitos de segurança e não declara homologação comercial.

## Download

- `SeraQuemFaz_site_v3.11.1.zip` — site estático corrigido.
- `SeraQuemFaz_codigo_v3.11.1.zip` — código completo, testes e documentação.

Para testes no Windows ou Linux, extraia o ZIP em uma nova pasta e sirva os arquivos via `http://localhost`, em vez de abrir por `file://`. O banco conectado é compartilhado entre versões e continua aplicando regras de acesso por conta autenticada.
