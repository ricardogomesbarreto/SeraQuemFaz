# Auditoria técnica e roadmap — 10/11/2026

**Baseline:** v3.13.1, tag `ec12945ffe4d135729034969708d530aa6537dba`. Main examinada: `85400b8eb2146943a9253a19d355b9b45ab000bb`. [CI](https://github.com/ricardogomesbarreto/SeraQuemFaz/actions/runs/42807018416) aprovada nos três jobs. Auditoria de inventário e consultas de leitura; não equivale a pentest, revisão exaustiva de cada linha nem homologação real em navegador.

## Escopo e evidências

| Área | Evidência | Próxima validação |
|---|---|---|
| Frontend | HTML/CSS/JS estático, módulos por página, PWA | Testes Playwright atualizados, mobile, teclado, acessibilidade e desempenho |
| Cadastro e perfis | Auth, fotos privadas, sidebar, perfis por papel | Sessões distintas, recuperação, confirmação de e-mail e publicação |
| Catálogo | 51 categorias, 5.571 municípios, busca assistida, filtros | Profissionais aprovados, busca regional, dados IBGE atualizados |
| Contratação | Solicitações, mensagens, anexos, propostas, comparação, eventos | Ciclo bilateral completo, autorização, falhas de rede e reenvio |
| Agenda | Filtros e exclusão GiST de intervalos confirmados | Disponibilidade semanal, bloqueios, fuso, reagendamento seguro |
| Confiança | Verificação, avaliações, contestação, moderação e suporte | Administrador com MFA, fila de aprovação e retenção |
| Gestão | Indicadores, CSV, notificações internas | Dados reais, paginação, operação de suporte, trilha de auditoria |
| Integrações | Código Edge Functions de cobrança e e-mail; flags desligadas | Ambiente sandbox e implantação separada |
| Distribuição | 16 tags/releases correspondentes, dois ZIPs por versão | Release única baseada em checks obrigatórios e checksum |

### Estado observado no Supabase
2 clientes, 2 prestadores, 0 publicáveis, 1 serviço, 1 registro de portfólio, 0 solicitações, mensagens, agendas e avaliações; 0 membros administrativos. 40 tabelas públicas com RLS habilitada. A existência de RLS não comprova que cada política seja correta. Dois buckets públicos (avatares profissionais e portfólio); fotos de conta/cliente, anexos e documentos de verificação privados. Há 18 objetos em sqf-portfolios, somente 1 referenciado por portfolio_photos pelo nome do objeto: **17 candidatos a objetos sem referência**, não excluir antes de verificar caminhos, histórico e retenção. Não há Edge Functions implantadas. Cobrança obrigatória false.

## Backlog de risco

| Prioridade | Achado | Ação / aceite |
|---|---|---|
| P0 | Nenhum admin e nenhum prestador público | Designar administrador de homologação com MFA; aprovar cadastro de teste por processo legítimo; cliente distinto encontra o perfil |
| P0 | Migrações históricas não reproduzem banco consolidado; assinatura incompatível da RPC de verificação | Snapshot sem dados pessoais, baseline reproduzível em banco vazio, testes de migração/restore e comparação com esquema remoto |
| P0 | 4 funções SECURITY DEFINER executáveis por anon, 38 por authenticated (categorias podem se sobrepor); proteção de senhas vazadas desativada | Inventariar chamadas, autorização por objeto e MFA, testes negativos, manter apenas grants necessários; configurar proteção de senhas conforme plano |
| P0 | Storage público permite URL direta mesmo quando perfil não está publicado | Definir política de publicação e migração para buckets privados/URLs assinadas quando necessário; inventariar objetos sem referência, não apagar automaticamente |
| P0 | Main sem proteção | Ruleset com PR/checks Node 22, Node 24, PostgreSQL e proibição de force-push; depende de acesso administrativo |
| P0 | Reagendamento de confirmado hoje substitui o horário anterior por proposta e libera a reserva | Preservar confirmado até aceite bilateral do novo horário, modelar revisão e testar concorrência; não confundir proposta com reserva |
| P1 | CI tem testes Node e fixture PostgreSQL de agenda, mas não executa suíte browser nem restaura schema completo | Playwright em CI com contas e dados sintéticos, teste RLS e RPC de múltiplos papéis, fluxo completo e falhas |
| P1 | Service worker usa identificador de cache v3.10.0 e lista pequena de recursos | Versionar cache/manifesto por build, testar atualização e offline público; nunca cachear sessão ou dados privados |
| P1 | 32 índices apontados como não utilizados; baixo volume de uso | Medir planos e estatísticas em homologação representativa; não remover índices somente pelo aviso |
| P1 | Scripts de release históricos e específicos por versão; release.yml permite clobber de assets | Consolidar pipeline, versionamento imutável, checks de todos os jobs, checksum e verificação de pacote |
| P1 | Sem Edge Functions implantadas e workflows comerciais/e-mail pulados | Testar e-mail com opt-in, outbox e retries em sandbox; preparar operação sem habilitar cobrança |
| P1 | Imagens e licença do código ainda exigem definição | Inventário de origem e licença de cada recurso; escolher licença do repositório após decisão do mantenedor |
| P2 | Comparação atual reúne propostas de solicitações distintas e valores não equivalentes | Evoluir para pedido único com múltiplas propostas versionadas, itens e histórico; manter compatibilidade de dados |

Os dois avisos de RLS sem política são informativos: tabelas internas sem acesso direto não precisam ganhar política permissiva. Não é legítimo concluir que os 45 alertas de segurança são 45 vulnerabilidades exploráveis. Nenhum dado cadastral foi aprovado ou alterado nesta auditoria.

## Roadmap proposto — decisão do mantenedor

| Versão | Escopo | Gate verificável |
|---|---|---|
| 3.13.2 | Base de homologação e segurança | Admin de teste designado, baseline PostgreSQL reproduzível, matriz RLS/RPC, proteção da main ou impedimento documentado, smoke browser |
| 3.14.0 | Contratação de ponta a ponta | Cliente A e prestador B: cadastrar, aprovar, pesquisar, solicitar, enviar proposta detalhada, conversar, aceitar, concluir e avaliar; cliente C não acessa |
| 3.14.1 | Agenda profissional e reagendamento | Disponibilidade semanal, bloqueios, fuso, preservação de horário confirmado, concorrência e cancelamento |
| 3.15.0 | Descoberta e experiência | Busca regional/termos, cobertura por município, acessibilidade, responsividade, favoritos, PWA atualizável, portfólio protegido |
| 3.16.0 | Operação e confiabilidade | Suporte, métricas paginadas, e-mail sandbox, observabilidade, backup/restore, runbooks, privacidade e retenção |
| 3.17.0 | Homologação financeira | Mercado Pago sandbox: webhook, idempotência, renovação, falha, cancelamento, estorno e reconciliação; sem cobrança real |
| 4.0.0-rc.1 | Candidata à produção | Homologação em HTTPS/staging, checklist LGPD, revisão de segurança, teste de recuperação, aceite de negócio |
| 4.0.0 | Liberação comercial | Decisão formal, domínio/hospedagem e configuração produtiva, monitoramento e rollback; cobrança apenas se aprovada |

**Regra:** não iniciar uma versão por obrigação numérica. Fechar o gate anterior ou registrar explicitamente riscos e decisão de escopo. A hospedagem definitiva e o Mercado Pago ficam no final. Versões e números acima são propostas, não releases publicadas.

## Critério mínimo de aceite
CI verde; testes de integração e navegador; autorização por papel e objeto; migração reproduzível com rollback/restore; nenhuma exposição de dados privados; documentação sincronizada; dois ZIPs íntegros; evidência de testes com dados sintéticos; aceite do mantenedor antes de produção.
