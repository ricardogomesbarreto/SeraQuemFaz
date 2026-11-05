# SERÁ QUEM FAZ? — v3.6.0

**Tipo:** atualização de segurança, prevenção de abuso e identidade visual dos perfis. **Status:** preparada; não homologada contra o Supabase real.

## Entregas

1. Uma fotografia de rosto frontal por perfil, enquadrada e convertida para 3×4 (600 × 800 WebP); portfólio de trabalhos continua separado.
2. Gate administrativo com MFA para inspeção do retrato, confirmação da versão atual e suspensão da aprovação ao alterar dados relevantes.
3. Sistema de contestação fundamentada de avaliações e resposta do prestador após moderação, sem bloqueio automático das críticas negativas.
4. Limitador de novas avaliações por conta, validação de e-mail e restrições de conteúdo com URLs/e-mails.
5. Redução da exposição de identificadores internos de clientes nos registros de atendimento, preservando a consulta de estado por RPC.
6. Testes de unidade e interface em Chromium (dimensões de retrato).

## Riscos e implantação

- Execute a migração `20261103_05_antiabuso_retratos.sql` **somente após** 01–04, com backup e em homologação.
- A migração move todos os prestadores atualmente aprovados para análise pendente. Planeje revalidação e comunicação aos usuários antes da produção.
- A proporção 3×4 é preparada no cliente, mas frontalidade e autenticidade do rosto precisam de inspeção humana. O banco valida a aprovação humana da versão da foto; não detecta rostos automaticamente.
- O bucket `sqf-avatars` permanece público. Não armazene documentos de identidade, CPF, selfie documental ou informações privadas.
- Ativação real de CAPTCHA, proteção contra contas múltiplas, prevenção a conluio, inspeção de mídia no servidor e validação de identidade civil seguem pendentes.
- Testes locais não substituem revisão de políticas RLS e testes de integração SQL com contas reais.
