# SERÁ QUEM FAZ? — Cadastro e Painel Profissional (v3.7.1)

## Objetivo

Aprimorar o perfil do prestador sem substituir os fluxos de conta, categorias, cidade IBGE, serviços, portfólio, avaliações, moderação e verificação já existentes. A v3.7.1 introduz um formulário **complementar e opcional** em `painel.html` e uma seção de informações adicionais na aba **Sobre** do perfil público.

## O que já existia na v3.7.0

- Cadastro e autenticação como cliente ou prestador via Supabase Auth.
- Nome exibido, cidade IBGE, apresentação e fotografia única de rosto frontal, com corte visual ajustável e galeria separada.
- Inclusão, edição e remoção de serviços com categoria, título e descrição; associação do prestador a categorias e município.
- Publicação condicionada a análise e aprovação humana; alterações relevantes podem exigir nova revisão.
- Portfólio com imagens de trabalhos e legendas; avaliações de atendimentos confirmados, contestação e resposta moderada.
- Painel com contagens de serviços, portfólio, confirmações e avaliações, mais atalhos e checklist.

## Informações obrigatórias para solicitar análise

Estes requisitos já eram verificados no código e no servidor antes da v3.7.1:

1. **E-mail confirmado** no Supabase.
2. **Nome completo/exibido** com pelo menos quatro caracteres na validação do servidor.
3. **Cidade de atendimento** selecionada por identificador IBGE.
4. **Uma fotografia individual e frontal**, com rosto visível, cadastrada e sujeita à revisão humana. A imagem **não precisa ter tamanho nem proporção fixa**.
5. **Apresentação profissional** com pelo menos 40 caracteres.
6. **Ao menos um serviço** ligado a categoria ativa, com título válido.
7. **Solicitação de análise e aprovação administrativa** com MFA; o prestador não se autocertifica.

A eventual exigência de registro em conselho ou órgão profissional depende da categoria e das normas aplicáveis. A plataforma **não deve presumir** registro, idoneidade ou antecedentes favoráveis. Documentos comprobatórios, se necessários, exigem fluxo privado de verificação — **não enviar documentos nos campos públicos ou nas fotos**.

## Novos campos opcionais na v3.7.1

| Campo | Finalidade | Restrição |
|---|---|---|
| Título profissional | Definir com precisão a atividade principal | Até 100 caracteres |
| Especialidades | Detalhar tipos de serviço | Até 220 caracteres |
| Tempo de experiência | Informar experiência declarada | 0 a 60 anos ou vazio |
| Modalidade | Presencial, remoto ou ambos | Enumeração controlada |
| Regiões atendidas | Identificar bairros e áreas gerais | Até 240 caracteres, sem endereços residenciais |
| Dias habituais | Exibir dias declarados de trabalho | Segunda a domingo |
| Turno habitual | Manhã, tarde, noite ou flexível | Enumeração controlada |
| Condição do orçamento | Sob consulta, declarado gratuito ou pago | Não constitui preço, reserva ou pagamento |
| Site profissional | Link externo do profissional | URL HTTPS, até 300 caracteres; revisão de segurança |

Esses dados são **autodeclarados**, não indicadores de reputação nem certificados de experiência. O preenchimento dos campos opcionais **não eleva automaticamente a nota do prestador** e não substitui a análise cadastral.

## Fluxo do prestador

1. Entrar em `painel.html` com conta de prestador.
2. Completar os dados obrigatórios no bloco **Preparação para publicação**. Os serviços existentes podem ser editados sem recriação; a alteração exige reanálise quando o cadastro já estava aprovado.
3. Em **Como você trabalha**, preencher opcionalmente a apresentação complementar.
4. Salvar os dados. O sistema realiza validação no navegador, e o PostgreSQL aplica restrições de tipo, tamanho e RLS.
5. Se o perfil estava aprovado, uma mudança nesses dados provoca **revisão pendente**, como ocorre com alterações do portfólio ou do serviço.
6. Após aprovação humana e ativação de perfil público, o cliente vê os dados na aba **Sobre**, junto da apresentação já existente.

Os clientes **não** têm acesso ao formulário de edição profissional. Administradores com MFA podem consultar as informações pela RPC `sqf_staff_provider_professional_details` durante a revisão; moderadores não têm esse acesso.

## Privacidade e autorização

- Tabela `public.provider_professional_details`, chave por `provider_id` e RLS habilitada.
- Uma conta de prestador lê/edita apenas seus dados. Um visitante consulta esses campos somente enquanto `sqf_provider_public(provider_id)` for verdadeiro.
- A migração não solicita CPF, RG, documentos, endereço residencial ou dados de pagamento.
- Site profissional somente `https://`, aberto em nova aba sem `Referer` e sem acesso à janela original.
- Administrador e moderador continuam definidos pelo sistema de permissões existente. A consulta de um cadastro pendente exige administrador e MFA/AAL2.
- A validação no navegador não é controle de segurança suficiente; a política SQL deve ser testada com usuários reais de homologação.

## Migração

Depois das migrações `01` a `06`, aplicar em ambiente de homologação:

```text
supabase/migrations/20261104_07_perfil_profissional_detalhado.sql
```

Efetuar backup, cadastrar conta de teste do tipo cliente, prestador pendente e prestador aprovado, testar tentativas de SELECT/INSERT/UPDATE de outra conta, confirmar resposta negada ao moderador, testar MFA administrativo e reanálise após edição.

A tabela não modifica os cadastros existentes: novos campos não são obrigatórios para que uma conta antiga continue usando os serviços anteriores.

## Melhorias futuras (não implementadas)

- Validação documental por fornecedor especializado e verificação de registros profissionais quando aplicável.
- Agenda e solicitação formal de orçamento pelo sistema, com consentimento e limites de abuso.
- Gestão por regiões geográficas estruturadas ou raio de atendimento, sem publicar endereço de residência.
- Relatório de desempenho baseado em eventos reais e autorizados, sem estatísticas fictícias.
- Fotos adicionais por serviço específico e gestão de portfólio por projeto.

**Status:** arquivos e testes locais da v3.7.1. Migração 07 e RLS remoto aguardam implantação e homologação; não são proteções ativas enquanto não aplicados.
