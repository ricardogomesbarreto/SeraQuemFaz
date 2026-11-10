# SERÁ QUEM FAZ? — v3.11.2

## Segurança e estabilidade
- **RLS de serviços:** removida uma política redundante de leitura em `provider_services`. A migração confere previamente a equivalência dos predicados e papéis; a política principal preserva acesso do proprietário e acesso público apenas a serviços ativos de perfis autorizados.
- **Catálogo resiliente:** falhas temporárias no endpoint de avaliações não impedem exibir profissionais publicados. O filtro de avaliações fica desativado enquanto não houver dados confiáveis, e a interface sinaliza a indisponibilidade em vez de inventar notas.
- **Ordenação por data:** timestamps ausentes não produzem comparações inválidas.
- **Painéis:** URLs contendo fragmentos malformados abrem a visão geral em vez de interromper a interface.
- **Mensagens:** abas de mensagens não lidas seguem o estado real da consulta; desabilitam o filtro quando indisponível e preservam uma pesquisa estável mesmo com descrições ausentes.
- **Qualidade:** suíte ampliada de testes automatizados, Node.js 22/24, documentação de homologação e orientações de segurança.

## Migração de banco
`supabase/migrations/20261110_19_single_provider_services_read_policy.sql` já aplicada ao Supabase conectado e confirmada pelo Advisor (aviso de políticas duplicadas eliminado). Nenhum dado de prestador foi aprovado nem exposto automaticamente.

## Pacotes
- `SeraQuemFaz_site_v3.11.2.zip` — distribuição estática do site.
- `SeraQuemFaz_codigo_v3.11.2.zip` — código-fonte, migrações, documentação e testes.

## Pendências fora desta release
A CI não substitui a homologação autenticada e visual entre cliente, prestador e administrador. A proteção da branch `main` requer permissão administrativa no GitHub. O Supabase ainda recomenda auditar funções `SECURITY DEFINER` e a proteção contra senhas comprometidas, que depende da configuração/assinatura de Auth. SMTP, Mercado Pago e hospedagem comercial não foram ativados.
