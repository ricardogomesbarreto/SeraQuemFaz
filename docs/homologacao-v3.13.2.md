# Homologação v3.13.2

Status: em desenvolvimento. A versão publicada permanece 3.13.1.

## Evidências de 10/11/2026

- PostgreSQL 17: 28 migrações remotas registradas; última `sqf_appointment_no_overlap_20261110`.
- `sqf_request_verification()` retorna `void` no remoto. Reconciliar o histórico sem mudar o contrato vigente.
- `sqf_manage_appointment(uuid,text,timestamptz,integer)` substitui a reserva confirmada ao propor horário. Separar proposta e reserva; confirmar atomicamente sob restrição de exclusão.
- Storage: `sqf-avatars` público (2 objetos), `sqf-portfolios` público (18). Não excluir objetos nem privatizar buckets antes de migrar consumidores para acesso autorizado.

## Gates de aceite

- [ ] Restaurar a partir de banco vazio e comparar funções, grants, políticas, triggers e constraints.
- [ ] Designar administrador explicitamente autorizado; testar MFA e acesso negado a clientes/prestadores comuns.
- [ ] Testar catálogo com prestador de homologação aprovado pelo administrador; negar acesso após retirada.
- [ ] Testar proposta, recusa, expiração, confirmação concorrente e conflito de reagendamento; preservar horário original em caso de falha.
- [ ] Inventariar referências de mídia, exportar backup e validar URLs assinadas; nenhuma exclusão automática.
- [ ] Revisar advisors individualmente e documentar decisões sobre privilégios e senhas vazadas.
- [ ] Proteger main com checks obrigatórios após identificar nomes dos checks e validar fluxo de revisão.
- [ ] Rodar npm verify e testes de navegador; validar instalação/atualização PWA e ausência de cache privado.
- [ ] Atualizar README, CHANGELOG, package e identificador de cache na promoção da versão.

Mercado Pago real, hospedagem comercial e lançamento permanecem fora do escopo.
