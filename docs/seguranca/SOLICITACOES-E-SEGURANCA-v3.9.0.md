# SERÁ QUEM FAZ? — Solicitações, orçamentos e mensagens privadas (v3.9.0)

## Finalidade

A plataforma conecta clientes a prestadores com perfil aprovado. O pedido de orçamento **não é uma compra, reserva, pagamento nem contrato executado na plataforma**. Antes de efetuar um serviço, ambas as partes devem validar o escopo e as condições; atendimento concluído é uma declaração bilateral, não prova independente.

## Fluxo de uso

1. Cliente autenticado e com e-mail confirmado acessa um prestador publicado, seleciona serviço, descreve a necessidade (25 a 2.000 caracteres), data opcional e até três fotografias.
2. O banco valida se o serviço pertence ao prestador e se ele está publicado e aprovado. Guarda a cidade oficial do prestador (`city_ibge`).
3. O cliente acompanha o estado em **Minha Conta**. As partes conversam por mensagens privadas. Os anexos são recodificados para WebP e armazenados em bucket **não público**.
4. O prestador encaminha orçamento (valor inteiro em centavos e condições). O cliente aceita ou cancela; o prestador pode recusar enquanto o pedido estiver aberto.
5. Se houver aceite, o prestador marca início e depois conclusão. O cliente confirma o atendimento, e o registro pode alimentar a avaliação moderada já existente.
6. Alterações de preço e estados são registradas em `sqf_request_events`. Apenas o casal cliente/prestador lê os eventos; não há exclusão ou edição por API pública.

## Proteção dos dados

- `sqf_service_requests`: leitura limitada a participantes por RLS; criação/atualização exclusivamente por RPC.
- `sqf_request_messages`: leitura/inserção somente pelos participantes; `sender_id = auth.uid()`, limite por hora e ausência de UPDATE/DELETE autenticado.
- `sqf_request_attachments`: bucket privado `sqf-request-attachments`, arquivos até **2 MB** WebP, caminho `REQUEST_ID/USER_ID/UUID.webp`, URL assinada de curta duração. Não enviar CPF, comprovantes, rostos de terceiros nem endereços residenciais.
- Limites iniciais: no máximo oito solicitações por dia por conta, 40 mensagens por hora; bloqueio de repetição recente para o mesmo serviço.
- Administradores têm contadores agregados de volume suspeito **somente com MFA**. Não é uma detecção automática de fraude nem atribuição de culpa.

### Limitações e riscos

- O navegador recodifica imagens, mas não substitui análise antimalware ou moderação de conteúdo no servidor. **Antes de produção**, adicionar varredura de arquivos, política de retenção e processo de denúncias relacionadas à conversa.
- Um par cliente/prestador ainda tem um único `service_engagements` histórico no esquema anterior. Vários pedidos concluídos do mesmo par não autorizam automaticamente múltiplas avaliações independentes. A migração mantém essa compatibilidade sem criar pontuações artificiais.
- Não existe criptografia ponta a ponta no chat. Segurança depende de HTTPS, Supabase Auth, RLS e operações do banco. Operadores de infraestrutura autorizados podem ter acesso administrativo conforme suas funções.
- Não há push, e-mail automático, agendamento, boleto ou pagamento por serviço. Consultas são atualizadas por botão/abertura de painel.
- Um profissional suspenso não poderá iniciar novos atendimentos pelo fluxo; casos de abuso em conversas devem ser tratados pela moderação.

## Implantação

1. Fazer backup e restaurar em ambiente de homologação. Aplicar migrações **01 a 08** em ordem, e então `20261104_09_solicitacoes_mensagens.sql`. Não executar em produção sem testar políticas.
2. Validar que `storage.buckets.sqf-request-attachments.public = false` e que arquivos não podem ser lidos anonimamente.
3. Criar usuários **cliente A**, **prestador B aprovado**, **cliente C** e **moderador sem MFA**. A não pode acessar as solicitações, fotos ou mensagens de C. B só pode abrir solicitações de B. O moderador sem MFA não pode acessar métricas financeiras.
4. Testar tentativa de trocar `sender_id`, `provider_id`, `quote_cents`, status e `storage_path` por REST/PostgREST. Devem ser negadas fora das RPCs autorizadas.
5. Testar múltiplos pedidos, duplicatas, falta de e-mail confirmado, prestador suspenso, anexo maior que o limite, upload em bucket público, mensagens após conclusão, contestação de avaliação e acesso anônimo.
6. Simular falha de rede entre upload e registro do anexo; monitorar e limpar resíduos somente por rotina administrativa auditada.
7. Revisar acessibilidade e LGPD com operadores reais antes da liberação.

## SQL de consulta (somente leitura; administrativo)

```sql
select status,count(*) from public.sqf_service_requests group by status order by status;
select public.sqf_staff_request_risk_overview(); -- exige sessão de admin com MFA
select name,public,file_size_limit from storage.buckets where id='sqf-request-attachments';
```

A execução no SQL Editor com papel de serviço pode não simular as permissões da API. Para testar RLS, utilize sessões autenticadas de teste reais com `auth.uid()` e contexto JWT válidos.
