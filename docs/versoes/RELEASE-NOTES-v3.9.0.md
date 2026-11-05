# SERÁ QUEM FAZ? — v3.9.0

## Entregas

- Solicitação privada de orçamento a partir do perfil do prestador, com serviço, descrição, data e fotografias opcionais;
- Fluxo completo de estados de pedido, orçamento, aceite, início, conclusão e confirmação pelo cliente;
- Mensagens privadas e mídias em bucket protegido por RLS;
- Histórico de decisões e cotações sem permissão de alteração pelo navegador;
- Painéis do cliente e profissional com filtros, respostas e acompanhamento;
- Perfil público com contagem de atendimentos confirmados pelo sistema, sem certificação de idoneidade;
- Catálogo de profissionais com filtro por especialidade e modalidade, preservando o requisito de cadastro aprovado;
- Histórico financeiro de assinaturas verificadas, nova consulta administrativa agregada, sinais operacionais de volume e workflow de conciliação *desativado por padrão*;
- Layout mobile e acessibilidade preservados, sem mudanças de identidade visual.

## Segurança e limites

A entrega não habilita pagamentos reais, não aplica migrações externas nem implanta Edge Functions. Não há mensagens criptografadas ponta a ponta, varredura antimalware no backend nem garantia de segurança do prestador. A validação do fluxo entre usuários e das políticas RLS precisa ocorrer em Supabase de homologação. Pagamentos reais requerem teste Sandbox Mercado Pago e revisão operacional.
