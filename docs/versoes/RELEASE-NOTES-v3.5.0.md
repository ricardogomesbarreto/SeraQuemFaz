# SERÁ QUEM FAZ? v3.5.0 — Administração de segurança

## Principais alterações

- Novo painel `admin.html` para moderação e operação de confiança.
- Controle de papéis `admin` e `moderator`, mantidos em tabela sem permissões de acesso direto via navegador.
- Autenticação de dois fatores (TOTP/AAL2) exigida pelo PostgreSQL em cada RPC administrativa.
- Filas de prestadores, avaliações, denúncias, direitos LGPD e trilha de auditoria.
- Decisões transacionais, com estado validado e justificativa obrigatória.
- Proteções RLS restritivas para conter policies permissivas adicionais em tabelas críticas.
- Link para o painel exibido na conta somente quando a própria RPC confirma vínculo administrativo.
- Atualização de testes e documentação de implantação e homologação.

## Limitações

**Não foi executada nenhuma migração no Supabase remoto.** O painel não funcionará de forma real antes da implantação das migrações, bootstrap administrativo e ativação do MFA no provedor. Não foi realizada verificação documental ou verificação de antecedentes. A proteção de contas, a qualidade da moderação e a efetividade dos processos LGPD dependem de operação humana e outras medidas de infraestrutura.
