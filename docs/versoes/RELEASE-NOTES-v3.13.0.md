# SERÁ QUEM FAZ? — v3.13.0

- Agenda: filtros de próximos horários, histórico, situação e data; aviso de sobreposição entre horários carregados, sem bloqueio transacional no servidor.
- Portfólio: agrupamento por serviço, capas primeiro, filtro exclusivo de capas e contador real.
- Desempenho e administração: percentual histórico de atendimentos concluídos por solicitações, sem confundir com conversão comercial; valores ausentes aparecem como indisponíveis, inclusive no CSV.
- Layout responsivo e testes automatizados. RLS e RPCs existentes preservadas; sem migração.
- Sem Mercado Pago, SMTP ou hospedagem. A homologação multiusuário e a prevenção transacional de conflitos continuam pendentes.

## Pacotes
- `SeraQuemFaz_site_v3.13.0.zip`
- `SeraQuemFaz_codigo_v3.13.0.zip`

## Homologação
Os alertas de conflito consideram até 200 horários retornados à sessão. Testar contas distintas, confirmar/rejeitar/reagendar e validar autorização e MFA antes da operação comercial. O relatório não simula dados ausentes. Não há migração de banco.
