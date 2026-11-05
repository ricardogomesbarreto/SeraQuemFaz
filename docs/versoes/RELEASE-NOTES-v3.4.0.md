# SERÁ QUEM FAZ? — v3.4.0 · Confiança e segurança

**Estado:** implementação de frontend e migração SQL preparada e testada estaticamente. **Não é uma liberação comercial nem homologação de banco real**.

Principais mudanças: publicação condicionada à análise cadastral, fluxo de confirmação bilateral de atendimento, avaliações moderadas, denúncias privadas, solicitações LGPD, anonimização de dados de avaliador na API pública, recodificação WebP e cabeçalhos de segurança para hospedagem.

**Migração:** `20261103_03_confianca_seguranca.sql`, aplicada após 01 e 02. A migração restringe visibilidade de perfis e avaliações preexistentes — fazer backup e testes antes de produção.

**Pendências:** KYC/identidade, credenciais profissionais, atendimento real comprovado, moderação operada por humanos, proteção revogável de mídias, CAPTCHA e MFA configurados no Supabase, testes de RLS num PostgreSQL conectado e pentest externo.
