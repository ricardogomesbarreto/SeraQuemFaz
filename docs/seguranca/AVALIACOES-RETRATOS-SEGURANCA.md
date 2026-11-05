> **Atualização da interface v3.6.1:** a foto do rosto não precisa ter proporção 3×4 nem dimensões 600 × 800. A tela aceita orientações variadas e permite posicionamento/zoom, preservando recodificação WebP. O aspecto vertical existe apenas no cartão. A verificação humana e as regras de segurança de aprovação do banco permanecem. As especificações rígidas abaixo descrevem o comportamento histórico da v3.6.0.

# Segurança das avaliações e retratos — procedimento de homologação

## Política editorial e prevenção de avaliações injustas

**Uma nota baixa não é automaticamente mal-intencionada.** Moderadores devem distinguir fato, opinião e ofensa e não favorecer cliente nem prestador. A plataforma não deve prometer que uma nota é prova incontestável do atendimento.

Fluxo: cliente autenticado e e-mail confirmado solicita confirmação de serviço; o prestador confirma; cliente envia uma avaliação; equipe modera; avaliações aprovadas aparecem publicamente. Um prestador pode contestar por fato verificável ou enviar uma resposta respeitosa. A contestação não oculta a nota; após análise imparcial, a equipe pode manter ou ocultar, com justificativa auditada. O prestador não recebe identificador interno do cliente na API pública de avaliações.

**Recomendações para operação:** registrar indícios e evidências sem armazenar dados sensíveis no campo público, proibir coerção para retirar nota baixa, revisar contas suspeitas e padrões de avaliações múltiplas; não publicar nem expor telefone/CPF/endereço dos avaliadores. Aplicar processo de recurso para clientes e prestadores, com duplo controle quando necessário. Criar procedimento claro de moderação, com prazos e transparência, em política própria.

Limite automatizado: até três avaliações por usuário em 24 horas. Não é proteção completa contra fazendas de contas, conluio, retaliação fora da plataforma nem falhas da confirmação bilateral. A contratação financeira ainda não é verificada independentemente. Considere comprovantes minimizados, reserva de dados e antifraude externo somente se houver base legal e estrutura apropriada.

## Foto obrigatória do prestador — padrão único

- Uma foto frontal, só da pessoa titular, rosto e ombros visíveis, sem filtro ou montagem; fundo neutro e boa iluminação.
- Envio vertical com pelo menos 480 × 640; processamento local para 600 × 800 (3×4), WebP ≤ 1,5 MB. A plataforma mostra uma prévia que o usuário deve conferir e confirmar.
- O recorte por JavaScript não consegue comprovar frontalidade ou identidade. A revisão manual no painel (`admin.html`) verifica o enquadramento e registra decisão com MFA e justificativa. O PostgreSQL bloqueia aprovação até que a foto atual seja aceita.
- Fotos já aceitas ficam protegidas de exclusão/reescrita silenciosa enquanto forem referenciadas pelo perfil. A troca de caminho exige nova análise. Fotos de serviços vão para outro bucket e não substituem retrato do perfil.
- Não solicitar documento com CPF, antecedentes ou certidões neste formulário. O bucket é público; use fornecedor de KYC e bucket privado, com base legal e política de retenção adequadas, apenas se a operação exigir.

## Etapas de implantação seguras

1. Faça backup do banco de homologação, Storage e policies atuais. Não executar migração de produção diretamente sem avaliação.
2. Aplique migrações 01, 02, 03, 04 e depois 05. Observe que a migração 05 marca os prestadores aprovados como `pending` para reanálise.
3. Configure Supabase Auth, e-mails verificados, MFA/TOTP para staff, administradores por SQL Editor e limites de criação de contas/CAPTCHA.
4. Teste dois clientes e dois prestadores independentes. Tente autoavaliação, avaliação sem atendimento, mais de três avaliações diárias, contestação de avaliação alheia, acesso direto à identidade do avaliador e criação de resposta não moderada.
5. Teste upload 3×4, bloqueio de foto horizontal, tamanho de arquivo, arquivo no bucket, visualização do administrador, aprovação com/sem check e tentativa de excluir/reescrever foto já aprovada.
6. Teste RLS como usuário anônimo, cliente, prestador, moderador e administrador. Confirme que moderador sem MFA não consegue atuar.
7. Publicar somente após revisão de privacidade, direitos dos usuários, moderação e incidentes. Monitorar logs de falhas e anomalias e definir canal seguro de contato.

## Cenários esperados

| Caso | Comportamento esperado |
|---|---|
| Cliente envia nota baixa legítima | Moderação decide pelo conteúdo; a nota não pode ser retirada por mera discordância |
| Prestador contesta a nota | Contestação privada; sem ocultação imediata; equipe examina e audita decisão |
| Prestador responde | Uma resposta por avaliação; equipe deve aprovar antes de exibir |
| Cliente tenta postar várias avaliações | Três novas avaliações/24 h no máximo (barreira parcial, não prova antifraude) |
| Conta de cliente consulta avaliadores | Identificadores internos de outros avaliadores não são expostos por RPC pública |
| Prestador troca a foto | Novo WebP 3×4 e reanálise; aprovação antiga não se estende automaticamente à nova foto |
| Administrador tenta aprovar sem conferir a foto atual | O gatilho bloqueia a transição para `approved` |
| Prestador com foto fora do padrão | Cadastro permanece pendente até reenviar e obter aprovação |

**Não homologado:** SQL real, processos de KYC civil, análise facial automática, atuação de moderadores de produção, criação de ordens/pagamentos e mecanismos externos de detecção de fraude.
