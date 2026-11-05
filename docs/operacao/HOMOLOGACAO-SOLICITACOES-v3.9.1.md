# Homologação — Solicitações e mensagens v3.9.1

**Não aplicar diretamente em produção.** O código continua sem implantação remota. Esta é uma lista de verificação para um projeto Supabase de testes e três ou mais contas distintas.

## Preparação

1. Realizar backup, restaurar cópia anonimizada em homologação, configurar Auth e buckets separados.
2. Aplicar `supabase/migrations/20261103_01_*` até `20261104_09_*` na ordem (sem pular), verificando erros e políticas de cada etapa.
3. Aplicar **somente depois** `supabase/migrations/20261104_10_resiliencia_solicitacoes.sql`.
4. Criar cliente A e cliente B, prestador P aprovado, prestador Q suspenso; configurar administrador/moderador com MFA.
5. Usar imagens fictícias e mensagens sem dados pessoais reais. Não colocar credenciais em arquivos do frontend.

## Matriz de autorização (cada teste deve registrar evidência)

| Ação | Cliente A | Cliente B | Prestador P | Admin / serviço |
|---|---|---|---|---|
| Ver solicitação de A com P | Permitido | Negado | Permitido | Somente por fluxos autorizados |
| Enviar mensagem na solicitação A–P | Permitido enquanto aberta | Negado | Permitido enquanto aberta | Não pela API pública como participante |
| Consultar contagem de não lidas de A–P | Somente A | Não pode consultar A–P | Somente P | Sem vazamento entre contas |
| Marcar mensagem de A como lida | Somente conta que a leu | Negado | Somente se própria | Não assumir identidade de A |
| Apagar objeto privado já registrado | Negado | Negado | Negado | Somente por operação administrativa específica |
| Limpar upload órfão de A | Permitido apenas ao uploader A com pedido aberto | Negado | Negado | Auditoria operacional |

## Casos de segurança e estabilidade

- Enviar oito pedidos e lançar mais dois simultâneos. O limite deve continuar respeitado.
- Enviar 40 mensagens e tentar exceder a cota com duas requisições concorrentes. Registrar o bloqueio e o horário.
- Abrir rapidamente duas conversas; a resposta atrasada da primeira não pode sobrescrever a segunda.
- Suspender o prestador P depois da proposta; cliente A não pode aceitá-la. Cancelamentos e respostas já aprovadas seguem suas políticas.
- Anexar arquivo inválido; o pedido não deve ser criado.
- Verificar data desejada perto da meia-noite em diferentes fusos do Brasil; o formulário exige data local, enquanto o servidor tolera um dia para a diferença de calendário.
- Forçar falha entre upload e gravação do registro; tentar limpeza do objeto órfão, sem autorizar exclusão do anexo registrado.
- Confirmar que mensagens, imagens e contagens de A não são visíveis para B ou para um terceiro não participante.
- Validar os estados de aprovação, contestação, moderação e vínculo de avaliações sem gerar avaliações fictícias públicas.

## Comandos locais

```bash
npm run verify
python tests/browser-resilience-v391.py
python tests/browser-marketplace-v390.py
```

As rotinas Chromium requerem Python Playwright e navegador Chromium instalados. Não substituem execução de SQL contra PostgreSQL nem testes do Mercado Pago Sandbox.

## Financeiro — bloqueio de lançamento

Continuar com `assets/billing-config.js` em `enabled: false` e variável `SQF_BILLING_ENABLED=false`. O workflow de reconciliação também fica inativo. Homologar separadamente compras mensais e anuais, falhas, cancelamentos, reembolsos, Webhooks autênticos e duplicados, vigência preservada e cenários de segurança. Só liberar mediante autorização formal.

## Critério de saída

A v3.9.1 só pode ser considerada **homologada** se: todas as migrações executarem sem erros; os testes negativos de RLS negarem acesso; logs não contiverem dados sensíveis; a operação de fraude e moderação estiver definida; e os cenários financeiros forem aprovados quando a cobrança for habilitada.
