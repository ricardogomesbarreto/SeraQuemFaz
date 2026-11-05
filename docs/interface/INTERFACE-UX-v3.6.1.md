# Refinamentos de UX — SERÁ QUEM FAZ? v3.6.1

## Princípios de preservação

As telas, identidade azul-marinho e laranja, marca oficial, pesquisa por município, navegação e campos existentes permanecem. Os ajustes são aditivos. Nenhuma migração de banco foi modificada.

## Catálogo

Cidade IBGE é mantida ao remover filtros individuais. O contador apresenta categorias efetivamente retornadas, não suposta disponibilidade de profissionais. O botão de aplicar filtros fecha a sidebar móvel após a aplicação; os controles de filtragem continuam acessíveis por teclado.

## Profissional e avaliações

Os cartões exibem somente dados de prestadores já consultados pelo mecanismo de acesso existente. A análise cadastral não certifica idoneidade. A nota vem unicamente das avaliações publicadas e moderadas. O perfil contém abas com seleção ARIA, setas, Home/End e rótulos; nenhuma aba cria avaliações.

## Foto de perfil

O usuário escolhe uma imagem frontal e ajusta zoom e posição antes de salvar. O navegador recodifica para WebP, preservando a proporção resultante e mantendo tamanho máximo. Uma moldura vertical é usada apenas na apresentação do perfil; os limites de tamanho são técnicos, não um padrão documental. A declaração de frontalidade e a revisão humana continuam obrigatórias. Não se infere identidade automaticamente.

## Painéis

O progresso do cadastro reflete apenas preenchimento de campos, não confirmação de e-mail ou aprovação de identidade. O checklist do prestador separa conclusão de informações e análise administrativa. O filtro de filas do painel atua somente nos registros já autorizados e carregados, com limite de 40; não contorna RLS ou MFA.

## Acessibilidade

Melhorias incluem foco visível, rótulos, mensagens de estado, controles com alvos mínimos de 44px em pontos de interação e respeito à preferência por movimento reduzido. São melhorias orientadas pela WCAG 2.2; antes da liberação é necessário revisar contraste, navegação integral por teclado, leitor de telas e dispositivos reais.

## Testes

`npm run verify` executa verificações Node. `python tests/browser-v361.py` verifica abas, retrato, controles administrativos e progresso de cadastro em 1440px e 390px com mocks. `python tests/browser-smoke-v3_3.py` testa o catálogo em dois tamanhos. Os cenários NÃO usam o Supabase de produção.
