# SERÁ QUEM FAZ? — v3.7.1

**Marco:** cadastro profissional complementar, sem redesign nem troca da identidade visual.

### Adições

- Formulário "Como você trabalha" no painel existente, com título, especialidades, experiência, modalidade, regiões, dias e turnos, orçamento declarado e site HTTPS.
- Contador independente de informações **opcionais**, sem alterar o checklist de requisitos para publicação.
- Edição inline de serviços existentes: categoria, título e descrição.
- Exibição de dados complementares aprovados na aba Sobre do perfil público.
- Consulta administrativa segura dos detalhes por RPC, com papel de administrador e MFA.
- Migração SQL `20261104_07_perfil_profissional_detalhado.sql`, RLS por proprietário, restrições de comprimento/opções e nova análise após alterações.
- Documentação de campos obrigatórios e opcionais e testes específicos.

### Mantido

- Cadastro de cliente e prestador; autenticação Supabase; cidade antes de serviço; foto de perfil frontal sem dimensão fixa; portfólio; avaliações e contestação; MFA, moderação e aprovação.
- Logomarca, navegação, tipografia, cores e design das páginas.
- Nenhum novo preço ou prazo fictício; horários e experiência são informações autodeclaradas.

### Limitações

- A migração SQL deve ser executada **após 01–06** em homologação; o formulário explica indisponibilidade caso ainda não exista a tabela.
- Não há verificação automática de registros profissionais, agendamento, pagamento ou certificação de idoneidade.
- Testes de frontend e SQL estáticos não substituem testes RLS com contas reais.
- Nenhuma publicação no GitHub nem implantação remota foi realizada nesta entrega.
