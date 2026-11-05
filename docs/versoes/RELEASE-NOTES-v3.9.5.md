# SERÁ QUEM FAZ? v3.9.5 — Correção de autenticação local

**Motivo:** após clicar na confirmação no Gmail do celular, o navegador abre `localhost:3000` e falha. O frontend anterior também gerava redirecionamentos baseados na página local.

**Implementado:** controle de URL pública HTTPS, bloqueio de redirecionamento local na chamada `signUp`/recuperação, interface opcional de confirmação via código com seis dígitos, avisos claros e guia de configuração do Supabase Auth.

**Resultado no Supabase (somente leitura):** 2 contas / 2 e-mails confirmados / 0 pendentes. A migração privada de contas v3.9.4 permanece instalada; as migrações de pedidos/mensagens não foram aplicadas.

**Não implementado remotamente:** Site URL, URLs permitidas e template de e-mail ainda precisam ser configurados pelo administrador quando houver um domínio HTTPS acessível. A confirmação por código só funciona se o template incluir `{{ .Token }}`.

**Sem alteração:** identidade visual, cadastros, regras de aprovação, base de dados, dados de usuários, Mercado Pago desativado.

**Modelo opcional:** `docs/contas/TEMPLATE-CONFIRMACAO-EMAIL.html` traz uma versão em português da mensagem de confirmação com o código e o link oficial. Só é utilizado após o administrador aplicá-lo ao template no Dashboard.
