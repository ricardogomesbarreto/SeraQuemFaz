# v3.9.19 — Categorias disponíveis para prestadores

- **Supabase:** corrigida a política RLS de leitura de `public.categories` para contas autenticadas, limitada a registros `active`; o catálogo já permitia leitura anônima.
- **Cadastro de serviços:** carregamento de categorias com estados de carregamento, falha de consulta e lista vazia distintos.
- **Recuperação:** novo botão **Recarregar categorias**, sem reiniciar a edição do perfil.
- **Segurança:** nenhuma concessão de edição, exclusão ou inclusão de categorias.
- **Validação:** papel `authenticated` e papel `anon` retornam as mesmas 51 categorias ativas no projeto Supabase, após ajuste da política.
- **Testes:** regressão para leitura RLS e formulário de cadastro do prestador.

# v3.9.18 — Enquadramento e salvamento de fotografias

- **Enquadramento funcional:** zoom e deslocamento alteram o recorte 3:4 salvo, com valores visíveis nos controles.
- **Prévia única:** o avatar anterior (quadrado com a inicial) fica oculto durante a edição de uma nova fotografia e reaparece apenas ao cancelar o envio.
- **Salvamento:** contas de clientes não precisam assinar declaração de retrato profissional; para prestadores, a confirmação não se perde ao mover controles.
- **Atualização rápida:** clicar em Salvar logo após um ajuste aguarda o processamento mais recente, evitando perda da prévia.
- **Interface:** botão para descartar a seleção, correção do estado oculto de elementos e mensagem clara quando a cidade não está selecionada.
- **Testes:** recorte efetivo, movimentos horizontal/vertical, zoom, segurança de cancelamento e regras de salvamento.

# v3.9.17 — Perfil do cliente e fotografias de até 5 MB

- **Perfil:** reorganizados dados, edição e atividades em uma área compacta, com menu lateral responsivo nas cores da plataforma.
- **Configurações:** solicitações de acesso, correção, exclusão e portabilidade de dados ficam na seção Configurações, separadas da edição do perfil.
- **Fotografias:** JPG, PNG e WebP com limite de entrada de 5 MB; removida a exigência de tamanho mínimo em pixels em retratos e anexos; conversão para WebP mantém a retirada de metadados.
- **Supabase:** buckets privados de fotos de conta, cliente e anexos configurados para 5 MB sem modificar acesso privado ou RLS.
- **Cadastro:** mantida a confirmação de e-mail e a mensagem de erro HTTP 429; o envio público depende de SMTP próprio no Supabase.
- **Qualidade:** adicionados testes de regressão para uploads, armazenamento e separação das seções de perfil e configurações.

# v3.9.16 — Busca e municípios resilientes

- **Busca integrada:** cidade e serviço na página inicial, preservados ao abrir o catálogo.
- **Municípios:** cópia versionada com 5.571 registros e metadados de origem, data e integridade; seleção sem depender de uma consulta externa ao IBGE.
- **Validação:** rejeição de códigos duplicados, códigos fora do formato IBGE e UFs incompatíveis, inclusive no cache do navegador.
- **Recuperação:** limite de tempo nas consultas, botão para tentar carregar cidades novamente e ação para limpar uma busca sem resultados.
- **Celular e acessibilidade:** controles maiores, barra de filtros fixa e navegação por teclado contida nos filtros abertos.

## v3.9.15 — Anexos, orçamentos e apresentação do projeto

- Corrigida a validação dos caminhos de anexos e rejeitado o envio de orçamentos sem valor.
- Removidos três índices redundantes de serviços e portfólio.
- Incluídos testes SQL para solicitações, mensagens, anexos e assinatura.
- Reorganizado o README com logomarca centralizada, selos e resumo da versão.

## v3.9.14 — Recuperação de links de solicitações

- O painel mantém a lista de solicitações disponível se a consulta de um link direto falhar. Atualizar tenta abrir o link novamente.

## v3.9.13 — Links de solicitação após login

- Ao entrar por um link de solicitação, o painel reabre a solicitação após autenticação. Somente o identificador válido é repassado entre as páginas.

## v3.9.12 — Links para solicitações antigas

- Links diretos abrem solicitações autorizadas mesmo fora das 40 mais recentes. O painel avisa quando o registro está indisponível para a conta.

## v3.9.11 — Continuidade de atendimentos aceitos

- Prestadores aprovados podem cumprir serviços já aceitos após o vencimento da assinatura. O banco bloqueia novos aceites quando a cobrança obrigatória está ativa.
- A suspensão continua impedindo o início e a finalização do atendimento. O teste de integração cobre as transições e o acesso de terceiros.

## v3.9.10 — Vigência da assinatura e README

- Vitrine e novas solicitações passam a depender de faturas aprovadas e vigentes quando o controle comercial está ativo.
- Painel e README explicam o efeito do vencimento no catálogo, nos pedidos e na conta.
- A logomarca oficial passa a abrir o README.

## v3.9.9 — Centrais de cliente e prestador

- Nova apresentação do painel autenticado e atalhos específicos para cada tipo de conta.
- Busca por descrição e filtro de mensagens não lidas nas solicitações recentes.
- Indicadores de toda a atividade acessível à conta, calculados no Supabase com RLS.
- README com fluxo de uso, configuração, testes, distribuição e estado da implantação.

## v3.9.7 — Reorganização do projeto (sem mudanças funcionais)

- Concentrados os documentos históricos em `docs/versoes/` e relatórios em `docs/relatorios/`.
- Agrupados os guias em pastas por domínio (`contas`, `catalogo`, `financeiro`, `interface`, `seguranca`, `operacao`).
- Removidas do pacote as capturas de tela antigas e o `assets/favicon.svg` sem referências.
- Documentação principal condensada, com índice e links funcionais; screenshots de novos testes vão para `.artifacts/previews/`.
- Atualizados scripts de distribuição para não empacotar arquivos temporários.
- Mantidos caminhos HTML, assets, migrations, endpoints, identidade visual, dados e integrações.

## v3.9.6 — Restauração das 51 imagens de referência (04/11/2026)

- Prioriza imagens cadastradas no Supabase e recupera URLs históricas das 51 categorias quando houver falha.
- Usa acesso REST público de somente leitura quando a biblioteca JavaScript do Supabase estiver indisponível.
- Recupera imagem original também na página de categoria em modo de referência.
- Mantém ilustrações específicas de contingência quando a URL remota falha; não troca rostos entre profissões.
- Nenhuma alteração no Supabase remoto ou em cadastros de clientes/prestadores.

## v3.9.5 — Autenticação e links de confirmação (04/11/2026)
- Evita usar `file://` e `localhost` como links de retorno passados pelo frontend ao Supabase Auth.
- Preparado campo opcional `publicSiteUrl` para o endereço HTTPS publicado, configurado também no painel Supabase.
- Adicionada confirmação por código de seis dígitos (requer `{{ .Token }}` no template oficial de e-mail).
- Mensagens de contexto para testes locais e celular; preservadas telas, design, Auth, RLS, catálogo, assinaturas desativadas e editor de conta.
- Backend não teve alterações nesta versão. O estado real de confirmação das duas contas foi consultado em modo leitura.

## v3.9.4 — Compatibilidade do perfil com o Supabase legado

- Unificado o menu autenticado em “Minha conta e perfil”.
- Editor de dados do próprio usuário em cenário sem `public.profiles`: nome, cidade, UF e foto privada.
- Nova migração isolada com RLS para `sqf_account_settings` e bucket privado de retratos.
- Camada de leitura não destrutiva de `user_profiles` e recuperação orientada de contas antigas.
- Solicitações mostram dependências ausentes sem ocultar a seção ou fabricar mensagens.
- Identificadores de foto gerados com criptografia, mesmo sem `crypto.randomUUID`.
- Diagnóstico SQL somente leitura e guia de implantação gradual.
- Nenhuma migração, pagamento ou publicação remota executada.

## v3.9.3 — Correção do catálogo vazio e do limite de cadastro (04/11/2026)

- Diferencia resposta vazia do catálogo, erro de leitura, ausência de cidade e filtros sem resultado.
- Exibe catálogo editorial de referência com 51 áreas (sem profissionais fictícios), quando o Supabase não devolve categorias ativas.
- Preserva a prioridade das categorias reais, seus IDs e suas fotos originais.
- Adiciona bootstrap opcional `supabase/bootstrap/00_categorias_publicas.sql` e diagnóstico da tabela/RLS/status.
- Cadastro com mensagem específica para HTTP 429 de e-mail, endereço não autorizado e falhas de autenticação; impede envios simultâneos.
- Não desativa limites do Supabase nem ativa cobranças. Banco e GitHub remoto não alterados.

## v3.9.2 — Navegação autenticada e recuperação de perfis (04/11/2026)

- Menu de conta compartilhado entre páginas: nome, foto/iniciais, acesso aos dados pessoais, solicitações e logout; visitantes continuam com Entrar/Criar conta.
- Cabeçalho autenticado independente da existência de `public.profiles` e links de autenticação atualizados também no rodapé.
- Recuperação segura no painel com dados básicos do Supabase Auth e orientação específica quando a tabela `profiles` está ausente.
- Foto opcional de cliente em bucket privado com URL assinada e políticas RLS; foto de prestador preservada.
- Migração 11 e testes novos; os pagamentos continuam desabilitados.
- Nenhum banco, conta ou repositório remoto foi modificado.

## v3.9.1 — Segurança e resiliência das solicitações

- Painel com indicadores de pedidos e mensagens não lidas vinculadas à conta.
- Recibos de leitura privados com RLS e RPC de marcação/autorização.
- Contenção transacional para cotas de solicitações e mensagens.
- Correção do aceite de orçamentos quando o prestador perde a aprovação.
- Validação antecipada das imagens, data local e limpeza de anexos privados órfãos.
- Interface protegida contra respostas atrasadas ao alternar de conversa.
- Script de publicação preparado para tag atual, sem publicação remota.
- Migração 10 adicionada; **não executada no Supabase real**; pagamentos permanecem desativados.

## v3.9.0 — Orçamentos e comunicação privada, segurança e operação financeira

Inclui fluxo de solicitações, mensagens privadas com RLS, anexos de acesso restrito, contadores reais, filtros profissionais, histórico financeiro e reconciliação agendada desabilitada até homologação. Consulte `docs/versoes/RELEASE-NOTES-v3.9.0.md`.

## v3.8.0 — Integração de assinaturas Mercado Pago (pré-homologação)

- Criada Edge Function para checkout de assinatura mensal/anual, validação de Webhooks, reconciliação e cancelamento de renovação.
- Adicionadas tabelas privadas de assinatura e faturas, vigência por pagamento aprovado e chave de implantação comercial desativada por padrão.
- Adicionado painel de assinatura ao Painel Profissional preservando o visual do site.
- Atualizada a seção de planos e documentação de implantação. **Nenhuma cobrança está ativa.**

## v3.7.2 — Planos de lançamento na landing page (04/11/2026)

- Cartões de planos Cliente (gratuito) e Prestador (valor mensal/anual proposto).
- Alternância acessível mensal/anual: R$ 14,90/mês ou R$ 149,00/ano (economia aproximada de 17%).
- Nova seção ancorada no menu principal, FAQ e notas transparentes sobre ausência de cobrança ativa.
- CSS responsivo preservando azul-marinho, laranja, tipografia e estrutura anteriores.
- Documento de referência comercial com fontes públicas e salvaguardas de lançamento.
- Não houve integração de pagamento nem alteração do Supabase remoto.

## v3.7.1 — Perfil profissional complementar (04/11/2026)

- Novo bloco "Como você trabalha" no painel profissional, sem alterar o design.
- Título, especialidades, experiência, modalidades, regiões, dias, turnos, orçamento declarado e site HTTPS, todos opcionais.
- Edição de serviços já cadastrados (categoria, título e descrição), preservando a reanálise administrativa.
- Exibição pública dos dados apenas em perfis aprovados, mantendo RLS e revisão humana.
- Consulta administrativa com MFA para análise das informações complementares.
- Migração 07, RLS, validações, testes e documentação de campos obrigatórios e opcionais.
- Ainda sem implantação no Supabase remoto nem publicação no GitHub.

## v3.7.0 — Painéis personalizados de cliente e prestador (04/11/2026)

- Dois painéis diferentes na mesma rota autenticada, selecionados por `profiles.account_type`.
- Minha Conta para clientes: histórico de confirmações de atendimento, avaliações, favoritos, atualizações e pedidos de privacidade.
- Painel Profissional com indicadores e navegação por serviços, portfólio, verificação, atendimentos e avaliações.
- Favoritos privados com tabela `sqf_client_favorites`, RLS, grants mínimos e critérios de perfil aprovado.
- Preservados CSS, logomarca, catálogo, mecanismos de identidade, foto de perfil e moderação existentes.
- Testes Node e testes com Chromium em desktop/celular com dados sintéticos.
- **Não houve implantação no Supabase ou publicação no GitHub nesta entrega.**

## v3.6.1 — Melhoria incremental da experiência (03/11/2026)

- Catálogo: cidade destacada, contador de resultados, filtros removíveis e aplicação de filtros no celular.
- Cartões de profissionais: localização, resumo de serviços, avaliação real e texto de análise cadastral, sem certificação fictícia.
- Perfil: quatro abas acessíveis, resumo e distribuição de notas, filtros de avaliações e respostas moderadas.
- Fotos: aceitação de retratos com proporções variadas, zoom e posicionamento manual, mantendo recodificação WebP e revisão humana.
- Cadastro: acompanhamento dos campos essenciais preenchidos; painel do prestador: checklist de publicação.
- Administração: busca na fila carregada, filtro de situação e sinalização de denúncias abertas para triagem, mantendo MFA/RLS.
- Estilos: melhorias para celular, foco visível, áreas de toque e redução de movimento.
- Nenhuma migração SQL foi alterada ou aplicada remotamente; implantação depende de homologação.

## v3.6.0 — Integridade de avaliações e retrato 3×4 (03/11/2026)

- Formato único 3×4 para foto do perfil, prévia no navegador e recodificação WebP 600 × 800 sem EXIF original.
- Confirmação expressa de foto frontal e revisão administrativa obrigatória antes de nova aprovação de prestador.
- Proteção do objeto de foto atualmente aprovado contra remoção/substituição pelo proprietário do arquivo.
- Fluxos de contestação de avaliações e resposta moderada, sem remoção automática de comentários negativos.
- Limite de avaliações por conta/24 horas e bloqueio de links/e-mails em comentários e respostas.
- Restringida a leitura direta de identificadores internos de clientes em registros de atendimento.
- Migração PostgreSQL 05, telas do prestador e administração, novos testes.
- **Atenção: nova migração retorna perfis aprovados a `pending` para reanálise.**
- Sem alteração no Supabase remoto e sem publicação no GitHub nesta etapa.

## v3.5.0 · 03/11/2026 — painel administrativo e MFA

- Implementado painel de moderação com papéis de administrador e moderador sem autoconcessão de permissão.
- MFA (TOTP/AAL2) exigido no servidor para consultas e decisões administrativas.
- Adicionadas filas protegidas, justificativas e auditoria transacional.
- Reforçadas restrições RLS de leitura em tabelas com dados pessoais ou estados de verificação.
- Criado guia de implantação, bootstrap seguro e testes de autorização por diferentes papéis.
- Nenhuma migração aplicada no Supabase remoto; recursos aguardam homologação.

## v3.4.0 — Segurança, reputação e validação (03/11/2026)

- Bloqueio público de prestadores não aprovados via RLS no banco.
- Solicitação de análise cadastral e etapa de revisão humana.
- Confirmação bilateral de atendimento e moderação antes de publicar notas e comentários.
- Função pública de avaliações sem identificadores pessoais de clientes.
- Denúncia privada de perfis e solicitações autenticadas LGPD.
- Recodificação de imagens novas em WebP para reduzir metadados EXIF.
- Headers de segurança para hospedagens compatíveis.
- Documentos de operação e checklist de homologação.
- Não executa migração no Supabase de produção nem certifica identidade de prestadores.

## v3.3.5 · 03/11/2026 — retorno às fotos originais do catálogo

- Comparação da implementação atual com o ZIP de referência `SERA_QUEM_FAZ_v3_0.zip`.
- Restauração de `categories.image_url` como fonte das imagens do catálogo e da página de categoria.
- Remoção das imagens sintéticas mapeadas por palavras-chave, que causavam repetição e profissões incorretas.
- Substituto neutro e próprio para categorias sem URL válida ou cuja imagem falhe.
- Capas com proporção 16:9, melhor recorte, carregamento progressivo e layout responsivo.
- Testes específicos de URLs seguras, categorias distintas e tratamento de falhas.
- Nota de limitação: as fotografias originais dependem do Supabase remoto e não estavam dentro do ZIP de referência.

## v3.3.4 — Curadoria visual do catálogo

- restaurada a base ilustrada original para evitar repetição de rostos e fotos incoerentes;
- mantidas fotografias apenas em 12 áreas principais com melhor aderência visual;
- criado o diretório `assets/category-illustrations/` para preservar a identidade original do catálogo;
- atualizado o resolvedor de mídia das categorias para usar foto ou ilustração conforme a curadoria;
- ajustados os testes automatizados para o novo modelo híbrido do catálogo.

# Histórico de versões — SERÁ QUEM FAZ?

## v3.3.3 · 03/11/2026 — fotografias de serviços (pacote local)

- Fotografias sintéticas fotorrealistas de profissionais para 32 áreas/tipos de serviço, geradas para o catálogo e entregues em WebP local 960×540.
- Substituição das ilustrações esquemáticas nos cartões; mesma foto no detalhe de categoria.
- Mapeamento por nome e sinônimos, com fallback genérico para categorias que não tenham associação específica no frontend.
- Imagens são ilustrativas e não perfis reais; cadastro remoto de categorias não foi consultado.
- Documentação e testes atualizados; nenhum commit, tag, release ou migração executado remotamente.


## v3.3.2 · 03/11/2026 — pacote preparado para GitHub (não publicado)

- Uniformização do dimensionamento da logomarca no cabeçalho e no rodapé.
- Variante clara real do PNG para rodapés escuros; nova variante clara do símbolo na área de profissionais.
- Correção de margens internas e `object-fit` para evitar cortes da lupa.
- Limpeza de backups/capturas de teste do pacote de distribuição.
- Atualização da versão no README e package.json.
- Adição de guia de publicação, script de push protegido e CI em Node 22/24.
- Workflow de release preparado para execução por tag no GitHub.
- Ajuste da logomarca clara do rodapé: ícone preservado em sua paleta original e palavras "SERÁ" e "?" em branco, sem cartão indevido.
- Inclusão de ilustrações originais locais para áreas do catálogo, com fallback por categoria para evitar imagens externas sem rastreabilidade.
- **Não implica publicação no GitHub nem homologação de Supabase.**

# Histórico de versões — SERÁ QUEM FAZ?

## v3.3 · 03/11/2026

- Aplicação da logomarca oficial em PNG transparente, com personagem azul, a todas as páginas; variante clara para o rodapé e ícones atualizados.
- Landing page com imagem ampla de dois profissionais (manutenção e construção), substituindo a imagem anterior.
- Cadastro com fotografia original de mulher eletricista; login mantém fotografia de oficina com profissional masculino.
- Correção do reconhecimento do município selecionado antes do carregamento do script do catálogo (condição de corrida).
- Restauração de cidade pré-preenchida pelo navegador quando corresponder exatamente a um município IBGE com UF.
- Ordenação por relevância, nome crescente/decrescente, data de cadastro e extensão da descrição.
- Filtros por imagem, descrição e inicial do nome; modos de exibição grade e lista; paginação progressiva; sugestões adicionais e sugestões dinâmicas baseadas em categorias reais.
- Preservação dos filtros de cidade no fluxo categoria → prestador.
- Remoção das referências ao repositório colaborativo anterior. Entrega preparada para novo repositório próprio do mantenedor, sem publicação remota.
- 42 testes Node aprovados, testes funcionais com Chromium em desktop/mobile e revisão visual estática.

### Pendências de implantação

- Aplicar e homologar as migrações SQL e RLS do Supabase.
- Executar os fluxos reais de conta, perfil, portfólio, avaliações e consulta com prestadores reais.
- Opcionalmente gerar `assets/municipios-br.json` com `npm run cities:update` para independência da API IBGE durante a navegação.
- Criar/configurar o repositório próprio e publicar as alterações, sem usar um repositório de terceiro.
