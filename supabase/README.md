# Supabase — estado real e histórico de migrações

**ATENÇÃO:** o banco conectado está à frente do histórico SQL antigo deste repositório.

Em 05/11/2026 UTC, o projeto `SeraQuemFaz` já continha perfis de clientes e prestadores, 5.571 municípios IBGE, estruturas de verificação, portfólio, avaliações moderadas, solicitações, mensagens, favoritos e faturamento. Além da migração privada de contas de 04/11, houve múltiplas migrações operacionais de consolidação no projeto.

**Não execute os SQL de `migrations/` novamente em sequência em produção.** A migração histórica `03` conflita com a assinatura atual da função `sqf_request_verification()` (retorno `void` no banco consolidado versus `text` no script legado). Rodar os scripts antigos pode recriar políticas permissivas e desfazer controles de verificação.

Os arquivos em `applied/` registram mudanças já executadas no banco conectado. A migração `sqf_dashboard_request_summary` da v3.9.9 adiciona contagens de solicitações em aberto, com orçamento, em atendimento e concluídas. A função usa `SECURITY INVOKER`, respeita a RLS existente e concede execução ao papel `authenticated`.

Execute apenas o diagnóstico em `diagnostics/verify_production_read_only.sql` para auditoria. Para novas versões, obtenha primeiro um diff real do banco e gere migrations novas sobre a linha consolidada, preferencialmente usando uma branch de homologação.

A função Mercado Pago **não foi implantada**, não há membros de administração designados e a exigência de assinatura permanece `false`. Configurar credenciais e ativar cobrança somente após testes externos.

Na v3.9.10, `applied/sqf_billing_publication_verified_invoice.sql` registra a atualização do controle de publicação. A vigência é consultada nas faturas verificadas. Os dados financeiros continuam privados e o controle comercial permanece desligado.


## v3.10.0 — Recursos de marketplace

A migração `migrations/20261109_14_marketplace_experience.sql` é **aditiva** em relação ao banco consolidado: agenda bilateral, notificações, preferências opt-in, fila privada de e-mail, suporte, métricas autenticadas, relatórios administrativos e vínculo portfólio-serviço.

Antes de aplicá-la: registrar backup, testar em homologação, revisar os controles de segurança e validar consultas com perfis separados. **Não reaplicar migrações legadas 01–12** no banco remoto. A integração de e-mail usa `sqf-notifications` com segredo privado e exige implantação/ativação separada.

Leia `docs/operacao/HOMOLOGACAO-v3.10.0.md`. Nenhum pagamento ou aprovação de prestador é ativado por esta migração.
