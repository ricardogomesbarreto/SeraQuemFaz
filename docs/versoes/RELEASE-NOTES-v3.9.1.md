# SERÁ QUEM FAZ? — v3.9.1

**Categoria:** estabilidade e segurança das solicitações, sem alteração de design ou valores comerciais.

## Melhorias

1. **Inbox do cliente e do prestador:** resumo de status e contagem de mensagens não lidas somente de conversas próprias; leitura confirmada por RPC após a consulta. Não há atualização em tempo real nem notificações push.
2. **Integridade de operações:** locks de transação reduzem a possibilidade de driblar limites enviando mensagens e pedidos simultaneamente. Aceite de proposta bloqueado se o prestador foi suspenso antes do aceite.
3. **Arquivos privados:** tentativa de limpeza de imagem enviada, mas não registrada; política SQL permite excluir apenas objetos órfãos do remetente que continua participante do pedido.
4. **Fluxo de orçamento:** arquivos inválidos barrados antes da criação de pedido, prazo conforme data local, tolerância de fuso no servidor, tratamento de erros e proteção contra resposta tardia ao alternar conversas.
5. **Engenharia:** nove novos testes Node, Chromium em 1440 e 390 px e atualização do script de tag e commit.

## Instalação e riscos

- Aplicar migrações 01 a 09 no Supabase de homologação, verificando cada uma, **antes** da `20261104_10_resiliencia_solicitacoes.sql`. Fazer backup e plano de reversão.
- Testar com contas cliente A, cliente B, prestador aprovado, prestador suspenso, administrador e moderador; validar tentativas cruzadas de acesso, mensagens em paralelo, anexos órfãos e contagens por conta.
- O cliente poderá ver a solicitação existente mesmo que a migração 10 não seja aplicada, mas não verá indicadores de leitura verificados.
- **Não há deploy neste pacote.** Não foram ativados Webhooks, Edge Functions, cobrança recorrente, assinatura obrigatória ou reconciliação no GitHub.
- Sem PostgreSQL remoto ou credenciais sandbox, **não** foram executados testes reais de RLS, de suspensão, de pagamento ou estorno. Os testes SQL locais verificam a estrutura textual, não a execução do banco.

Consulte `docs/operacao/HOMOLOGACAO-SOLICITACOES-v3.9.1.md` e `docs/relatorios/RELATORIO-VALIDACAO-v3.9.6-resumo.md`.
