# SERÁ QUEM FAZ? — Homologação dos painéis v3.11.0

## Princípios

- Os perfis de cliente e prestador compartilham o mesmo layout visual, mas cada conta enxerga somente as páginas autorizadas.
- As rotas `painel.html?pagina=cliente/<tela>` ou `painel.html?pagina=prestador/<tela>` **não são endpoints de API**; a autorização de dados permanece nas RLS/RPC do Supabase.
- Cada tela apresenta exclusivamente seu módulo ativo. Links antigos em `#` são redirecionados para a rota pertinente.
- Não declarar verificação de identidade, garantia ou qualificação profissional com base apenas na publicação do perfil.

## 1. Pré-requisitos

1. Backup e teste de restauração do banco num ambiente de homologação independente.
2. Aplicar a migração aditiva `supabase/migrations/20261109_18_paineis_servicos_portfolio.sql` no banco consolidado.
3. Conferir a política SELECT de `provider_services`, que deve exibir somente serviços ativos para não titulares.
4. Confirmar SELECT/INSERT/DELETE de `sqf_client_category_favorites` apenas para o cliente titular.
5. Garantir que `sqf_set_portfolio_cover(uuid)` não pode ser executada por anônimos nem em fotos de terceiros.

## 2. Fluxos para testar com usuários de homologação

| Papel | Fluxo | Resultado esperado |
| --- | --- | --- |
| Cliente | Abrir cada item da barra lateral | Apenas a tela escolhida aparece; URL e título mudam |
| Cliente | Recarregar `?pagina=cliente/favoritos` | Volta para favoritos após autenticação |
| Cliente | Abrir rota de prestador | Redireciona para visão geral do próprio papel; sem dados do outro papel |
| Cliente | Salvar categoria | Visível apenas para o próprio cliente em RLS; persistência em outra sessão |
| Cliente | Fazer pesquisa recente | Histórico apenas na sessão da aba atual; permite limpar |
| Cliente | Alterar senha | Nova senha com 12+ caracteres, confirmação e autenticação Supabase |
| Prestador | Navegar serviços/portfólio/agenda | Cada módulo isolado; dados reais são preservados |
| Prestador | Criar serviço ativo com estimativas | Valores em centavos e serviço aparecem no perfil público somente se aprovado |
| Prestador | Pausar serviço | Item permanece editável para titular, mas não aparece no catálogo público |
| Prestador | Indicar capa do portfólio | Uma capa por serviço; o RPC rejeita fotógrafo de outro titular |
| Prestador | Tentar publicar somente serviços pausados | Formulário impede solicitação de publicação |
| Público | Ver página de categoria e filtros | Números baseados em perfis/fotos/avaliações existentes |
| Público | Filtrar sem resultados | Estado vazio, botão de limpar e busca alternativa |
| Público | Abrir landing e catálogo no celular | Pesquisa acessível, sem overflow horizontal e sem componentes cortados |

## 3. Regressão e acessibilidade

- Testar em 390, 768, 1024 e 1440 px, com teclado, leitura de tela e zoom 200%.
- Verificar Botão Voltar/Avançar do navegador e links profundos com query string e âncoras antigas.
- Verificar que a mudança de rota não recria listeners nem mantém duas cópias de um formulário.
- Confirmar que IDs HTML são únicos e que os `details` de configurações não se misturam com edição de perfil.
- Validar classes `hidden` e navegação focada, especialmente com menu responsivo.
- Verificar funcionamento do formulário de cidade e dos serviços após atualizar a página.
- Conferir localmente via `http://localhost` ou HTTPS, não depender de recursos PWA ao abrir `file://`.

## 4. Limites e implantação

- Os testes Node e as políticas RLS automatizadas não substituem teste autenticado ponta a ponta.
- Preços são **estimativas informadas pelo prestador**, não garantias ou cobranças.
- Capa é gerenciada via RPC, mas publicação continua sujeita à aprovação do perfil.
- Não ativar pagamentos Mercado Pago ou envio de e-mails de notificação sem homologação independente.
- Publicar a versão estática em HTTPS com checklist de rollback e atualizar os artefatos ZIP.
