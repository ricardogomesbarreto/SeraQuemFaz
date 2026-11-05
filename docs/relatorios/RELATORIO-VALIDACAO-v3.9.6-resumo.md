# SERÁ QUEM FAZ? — Validação da versão v3.9.2

## Verificações realizadas nesta distribuição

- `npm run verify`: 142 testes Node aprovados (137 regressões anteriores + 5 testes de navegação, fallback e privacidade da imagem).
- Chromium com respostas simuladas: 1440 e 390 px; sessão de cliente autenticada sem `public.profiles`; nome, e-mail, edição do nome de acesso e logout disponíveis.
- Chromium: cabeçalho de prestador com imagem pública, cliente com foto privada via URL assinada, menu de conta em desktop e celular.
- Scripts de `auth-navigation.js`, `account.js`, `admin.js` verificados sem erros de sintaxe.
- Sem rolagem horizontal nos cenários de teste.
- Conferência de integridade do pacote via SHA-256 e testes após extração.

## O que NÃO foi homologado

- A migração 11 não foi executada num Supabase real.
- O problema `public.profiles` do servidor remoto não foi corrigido; a UI apresenta uma recuperação e exige instalar/validar migrações 01–10 para o painel completo.
- A assinatura Mercado Pago permanece desativada; não houve cobrança, implantação nem publicação no GitHub.
- Testes automatizados de interface são com mocks, não provam isolamento RLS nem confirmação real de identidade.
