# SERÁ QUEM FAZ? — v3.13.1

- Restrições de exclusão GiST impedem sobreposição de horários confirmados do mesmo prestador ou cliente, inclusive sob concorrência.
- Propostas não reservam horário; confirmação conflitante mantém a proposta e retorna mensagem sem expor dados de terceiros. Horários consecutivos e cancelamento são permitidos.
- CI PostgreSQL 16 isolado testa duas sessões concorrentes, conflito do cliente, adjacência, cancelamento e autorização. Node 22/24 preservados.
- Migração `20261110_20_appointment_no_overlap.sql`; não altera RLS, aprovação de prestadores, Mercado Pago ou hospedagem.

## Pacotes
- `SeraQuemFaz_site_v3.13.1.zip`
- `SeraQuemFaz_codigo_v3.13.1.zip`

## Limites
Propostas sobrepostas permanecem permitidas; somente confirmações conflitantes são recusadas. A nova proteção não depende dos 200 horários carregados na interface. Os testes de banco usam uma fixture isolada, não a totalidade do Supabase produtivo. A homologação completa cliente/prestador/admin em navegador, proteção da main e segurança Auth permanecem pendentes. Sem checkout, SMTP ou hospedagem.
