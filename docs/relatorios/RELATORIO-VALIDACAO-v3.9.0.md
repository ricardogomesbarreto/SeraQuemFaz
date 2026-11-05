# SERÁ QUEM FAZ? — Validação da versão 3.9.0

**Data:** 04/11/2026. **Status:** desenvolvimento e testes locais; **não homologado no Supabase e Mercado Pago reais**.

## Escopo alterado

- Solicitação de orçamento pelo cliente no perfil do prestador, com serviço, descrição, prazo e até três anexos privados;
- Chat por solicitação, fluxo de estados, histórico de mudanças/valores e acompanhamento separado de cliente e prestador;
- Catálogo com filtros de especialidade e modalidade; indicador público de serviços concluídos (somente confirmação bilateral);
- Histórico de pagamentos verificados, indicadores financeiros e de volume administrativo, agendamento de reconciliação com flag inativa por padrão;
- CSS responsivo e preservação da identidade visual.

## Validação local

- `npm run verify`: 127 testes Node, incluindo regressão das versões anteriores e novos cenários estruturais de RLS, fluxos, anexos, preço e segurança.
- `python tests/browser-marketplace-v390.py`: Chromium em 1440 × 970 e 390 × 844, painel de solicitações, visualização de orçamento, mensagem e formulário de pedido com serviços. **Dados simulados**, sem conexão externa. Sem erro de JavaScript ou rolagem horizontal nas páginas inspecionadas.
- Testes não executados: testes reais PostgreSQL de migração e permissões, integração Mercado Pago Sandbox, entrega real de Webhooks, armazenamento com RLS remoto, reconciliação em GitHub Actions de repositório real e verificação antimalware dos anexos.

## Pendências impeditivas da produção

1. Backup + migrações 01 a 09 aplicadas e auditadas em projeto Supabase de homologação.
2. Testes reais cliente A / prestador B / cliente C, RLS cruzada, aprovações, status, anexos e requisições abusivas.
3. Configuração segura de credenciais de teste, Edge Function e Webhooks Mercado Pago; pagamentos aprovados, rejeitados, reembolsados e cancelados.
4. Varredura de arquivos no servidor, política de retenção, suporte de incidentes, supervisão dos chats e revisão LGPD.
5. Ativar reconciliação por agendador apenas após configurar segredos e alertas. Não habilitar cobranças ou flag de assinatura obrigatória antes de aprovação formal.

**Não houve deploy remoto, alteração no Supabase de produção, publicação de tag no GitHub ou ativação de pagamentos.**
