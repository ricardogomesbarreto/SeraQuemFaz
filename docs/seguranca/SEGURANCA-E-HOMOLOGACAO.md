# SERÁ QUEM FAZ? — Segurança, reputação e homologação v3.4.0

> **Documento técnico e operacional.** As migrações desta entrega **não foram aplicadas no Supabase remoto**. Use um projeto de homologação e backup. A aprovação administrativa não certifica antecedentes, não é garantia de segurança e não comprova contratação.

## 1. Estado e riscos

- `auth.users`: Supabase Auth; habilitar confirmação obrigatória de e-mail, proteção contra bots e limite de requisições.
- `profiles`: contas podem se declarar `prestador`, mas o cadastro só aparece ao público com **status `approved` e `is_public=true`**. Status `pending`, `rejected` ou `suspended` impede listagem.
- `provider_services`/`portfolio_photos`: acesso público condicionado ao prestador aprovado. **Os links de buckets públicos continuam acessíveis a quem os conhecer**, mesmo após suspensão; migrar mídia para fluxo privado e revogável futuramente.
- `service_engagements`: cliente solicita confirmação **depois** de receber serviço; prestador confirma se realmente trabalhou. Isso reduz avaliações espontâneas, mas não impede conluio entre contas falsas.
- `reviews`: registro vinculado a atendimento confirmado, 1 avaliação por par cliente–prestador. Moderação `pending` por padrão; somente `published` aparece no catálogo. Avaliações antigas sem atendimento ficam `pending`.
- `safety_reports`: canal privado de denúncia; análise e eventual suspensão são responsabilidades humanas.
- `privacy_requests`: pedidos autenticados LGPD; **não** há exclusão automática de dados.
- `sqf_moderation_audit`: mudanças de aprovação e liberação de avaliações são registradas. A administração deve guardar também identificação do operador, justificativa e evidências em sistema interno apropriado.

## 2. Etapas de implantação (não automatizadas)

1. Salve backup, avalie as políticas RLS atuais e teste restauração.
2. Aplique migrações `01`, `02`, depois `20261103_03_confianca_seguranca.sql` no SQL Editor de **homologação**.
3. Confirme que as roles `anon`/`authenticated` **não** possuem tabelas/colunas além do necessário, e verifique todas as policies: políticas permissivas no PostgreSQL são combinadas por **OR**. Se políticas antigas de outros projetos existirem, remova-as após revisão.
4. Configure Auth: confirmação de e-mail, proteção contra bots (Turnstile/hCaptcha), controle de sessões e limites de requisições; **as configurações não são realizadas pelo ZIP**.
5. Teste usuários distintos (cliente, prestador pendente, prestador aprovado, prestador suspenso); conta anônima não deve ver `provider_verifications`, denúncias, solicitações LGPD nem `reviews` brutas.
6. Teste o fluxo cliente solicita → prestador confirma → cliente avalia → equipe libera → estrela aparece no catálogo. Teste a negação de autoavaliação, avaliação antes da confirmação, alteração do `reviewer_id` e publicação pelo cliente.
7. Confirme que documentos privados não entram no bucket público; teste recodificação WebP e restrições de MIME. Faça revisão antivírus/moderação e remoção de dados pessoais nas imagens.
8. Teste a suspensão: o perfil e serviços deixam de aparecer **na API**. Verifique caches e imagens publicadas; remova objetos sensíveis de forma independente.
9. Configure HTTPS, domínio, CSP/HSTS, backups, logs, alertas de abuso, retenção e plano de resposta a incidentes. HSTS só depois de confirmar HTTPS em todos os subdomínios. Aplique `.htaccess` em Apache ou `_headers` em serviços que os reconheçam.
10. Antes de tornar comercial, nomeie o controlador, publique contato de privacidade, documente bases legais e retenção, estabeleça equipe de moderação, canal de contestação e procedimento de reanálise.

## 3. Análise manual de prestadores

Recomenda-se checar **por etapas, com proporcionalidade e minimização de dados**:

- E-mail confirmado, dados públicos consistentes, cidade, apresentação, fotografia e atividade declarada.
- Identificação pessoal por parceiro especializado de KYC, com política de tratamento de dados, base legal, prazo de retenção e acesso restrito; nunca no bucket público da aplicação. Não coletar CPF/selfie/documentos no formulário atual.
- Para profissões regulamentadas, consultar a habilitação no órgão profissional apropriado quando aplicável e necessário. Não exibir selo de habilitação sem validação específica.
- Contato profissional verificado, reclamações prévias, plágio de portfólio e material que sugira fraude.
- Em casos relevantes, revisão por duas pessoas ou escalonamento. Não usar decisões automatizadas ou tratamento de antecedentes de forma indiscriminada; consultar assessoria jurídica para bases legais e proporcionalidade.

**Aprovação do cadastro** significa apenas análise operacional realizada; não é garantia de segurança, qualidade ou ausência de histórico de fraude.

## 4. Operações do moderador (SQL Editor administrativo, não no navegador)

Exemplos **ilustrativos**; substitua os UUIDs com registros existentes, após verificar o processo. Não copie dados pessoais para logs públicos.

```sql
-- Pedidos pendentes
select provider_id, status, requested_at from public.provider_verifications
where status = 'pending' order by requested_at;

-- APENAS após checagem humana registrada:
update public.provider_verifications
set status='approved', reviewed_at=now(), internal_note='Revisão manual concluída', reviewed_by=null
where provider_id = '00000000-0000-0000-0000-000000000001' and status='pending';

-- Bloquear prestador denunciado (após análise):
update public.provider_verifications
set status='suspended', reviewed_at=now(), internal_note='Análise de segurança', reviewed_by=null
where provider_id = '00000000-0000-0000-0000-000000000001';

-- Avaliações pendentes (sem divulgar identificadores de cliente)
select r.id,r.provider_id,r.rating,r.comment,r.created_at
from public.reviews r where r.moderation_status='pending' and r.engagement_id is not null;

-- Liberar somente após verificação de conteúdo, dados pessoais e consentimento:
update public.reviews set moderation_status='published'
where id='00000000-0000-0000-0000-000000000002' and moderation_status='pending';

-- Verificar denúncias e pedidos de privacidade no SQL Editor com acesso restrito:
select id,provider_id,reason,status,created_at from public.safety_reports where status='pending';
select id,user_id,request_type,status,created_at from public.privacy_requests where status='pending';
```

Não execute SQL administrativo no frontend. O `service_role` **bypassa RLS** e jamais deve aparecer em HTML, JavaScript, commits ou logs públicos. Restringir a membros autorizados no backend e no painel Supabase.

## 5. Testes adversariais indispensáveis

| Tentativa | Resultado esperado |
|---|---|
| Prestador se marca `is_public=true` antes de aprovação | Perfil continua invisível publicamente |
| Cliente tenta mudar `provider_verifications.status` | Negado por grant/RLS |
| Cliente avalia sem atendimento confirmado | Negado por RLS/trigger |
| Cliente muda `moderation_status` para `published` | Negado por grant |
| Prestador edita o comentário alheio | Negado |
| Usuário tenta acessar dados de denúncia de terceiros | Negado |
| Cliente busca UUID do avaliador de outra conta | RPC pública não retorna UUID do avaliador |
| Prestador suspenso aparece no catálogo | Negado por RLS e RPC |
| Arquivo de imagem contém GPS EXIF | Novo upload é recodificado localmente (verificar bytes); proteção não é absoluta |
| Pessoa tenta enviar documento privado ao bucket de portfólio | Processos, UX e moderação devem prevenir; bucket atual ainda é público |

## 6. Riscos não resolvidos pelo frontend

Sem verificação documental externa, não é possível assegurar a identidade real; confirmação bilateral pode ser falsificada por duas contas combinadas; não há prova de compra/pagamento; imagens já públicas não são revogáveis por RLS; o banco depende da aplicação real das migrações; logs, bloqueio de IP, antivírus, antifraude e rate limits de chamadas de negócio exigem operação no servidor.

**Próximos marcos:** KYC terceirizado, verificação de credenciais por profissão, registro de contratação/recibo, detecção antifraude com revisão humana, cadastro de canais oficiais, MFA para moderadores, uploads privados e moderação de mídia, relatório de impacto de dados, backups testados e gestão de incidentes.

## 7. Referências

- Supabase — RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — CAPTCHA: https://supabase.com/docs/guides/auth/auth-captcha
- Supabase — rate limits: https://supabase.com/docs/guides/auth/rate-limits
- ANPD — Guia de segurança: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-guia-de-seguranca-para-agentes-de-tratamento-de-pequeno-porte
- ANPD — Comunicação de incidente: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
