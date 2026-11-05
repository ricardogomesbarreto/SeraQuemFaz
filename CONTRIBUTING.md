# Contribuindo para SERÁ QUEM FAZ?

## Fluxo recomendado

1. Parta da branch `main` atualizada.
2. Crie uma branch curta: `fix/descricao` ou `feat/descricao`.
3. Execute `npm run verify` com Node.js 22 ou 24.
4. Abra um pull request descrevendo escopo, capturas (quando visual), impacto e testes.
5. Não altere migrações já aplicadas em produção: crie uma nova migração incremental.

## Convenção de commits

Adote Conventional Commits, por exemplo `fix(catalog): preserve selected city` ou `feat(profile): add portfolio pagination`. Prefira commits pequenos e revisáveis.

## Privacidade e segredos

Não envie senhas, tokens pessoais, chaves `service_role`, arquivos `.env`, imagens de clientes sem autorização ou dados pessoais reais em issues e pull requests. A chave `publishable` do Supabase pode estar no frontend; a segurança depende das políticas RLS e das permissões do Storage.

## Identidade e direitos de uso

A marca exibida é SERÁ QUEM FAZ?. Antes de republicar código e imagens em outro repositório, confirme com os colaboradores e titulares dos materiais os direitos e créditos aplicáveis.
