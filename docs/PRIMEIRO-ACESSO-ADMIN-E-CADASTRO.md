# Primeiro acesso administrativo, e-mail e catálogo regional

Este roteiro se aplica ao site publicado pela Hostinger Unlimited, com backend PHP e banco MySQL/MariaDB. A interface pública não pode criar administradores nem confirmar e-mails sem que exista um transporte de saída válido.

## 1. Por que admin.html não deve enviar à página inicial

**admin.html** agora oferece o próprio formulário de login. Após autenticação:

- Contas administrativas autorizadas devem validar um código TOTP (MFA).
- Contas de cliente ou prestador recebem um aviso de acesso restrito, sem exposição de dados administrativos.
- Visitantes podem informar e-mail/senha sem serem redirecionados a outras páginas.
- A autorização efetiva continua no backend: todas as rotas staff exigem sessão, papel e MFA.

A tela é apenas uma interface. Ela **não concede o papel admin** a quem fizer login.

## 2. Criar o primeiro administrador sem depender do SMTP

Conecte-se ao servidor por SSH e acesse o diretório do domínio. Se **ainda não existir nenhum administrador**, execute uma única vez:

```bash
php sqf-private/backend/bin/bootstrap-first-admin.php
```

O procedimento pede nome, e-mail sob controle do operador (Hotmail/Outlook é permitido), senha digitada sem eco, confirmação textual e um código TOTP gerado pelo aplicativo autenticador a partir da chave exibida no SSH.

Essa é uma **atestação excepcional de controle pelo proprietário do servidor SSH**: a conta inicial é criada e habilitada por essa autoridade, sem comprovar a entrega de e-mail. Não confundir esse processo com a verificação do endereço pelo inbox. Uma segunda execução é negada se houver administrador registrado. Não copiar senhas ou segredos TOTP ao GitHub, ao chat ou ao public_html. A chave do TOTP é criptografada em sqf-private/mail-settings; faça backup privado.

Se um administrador já existir, não execute esse assistente. Use suas credenciais e o TOTP na tela admin.html. A recuperação de um administrador existente exige procedimento separado, nunca criação duplicada automática.

## 3. Ativar entrega por e-mail de forma segura

**Opção recomendada para operação regular: SMTP autenticado Hostinger/Titan.** Com uma caixa postal existente, execute uma vez:

```bash
php sqf-private/backend/bin/setup-mail.php
```

Também é possível alterar as configurações posteriormente em admin.html > E-mails e notificações, com MFA. A senha SMTP permanece cifrada e fora do document root.

**Opção de testes com seu Hotmail/Outlook como destinatário, sem senha do Outlook e sem caixa postal própria na Hostinger:**

```bash
php sqf-private/backend/bin/setup-mail-fallback.php
```

O assistente SSH solicita um e-mail que você controla e pede confirmação antes de enviar **um único código** pela função PHP mail da Hostinger. A opção de homologação só é ativada depois que o código enviado realmente é informado de volta no terminal. Se a mensagem for rejeitada ou não chegar, o recurso permanece desativado.

A aceitação por mail() **não prova entrega**, por isso há uma verificação humana do código na caixa postal. Quando habilitado e sem SMTP ativo, o recurso pode emitir códigos de confirmação e recuperação, mas entrega confiável não é garantida para todos os provedores. A Hostinger informa limite de 10 mensagens por minuto e 100 por dia para PHP mail sem autenticação; mensagens podem cair no spam. A migração para SMTP autenticado é recomendada antes da operação comercial.

Para desativar a alternativa básica por SSH:

```bash
php sqf-private/backend/bin/setup-mail-fallback.php --disable
```

O worker geral de notificações e o checkout permanecem desativados até homologação. Nunca habilitar aprovação automática de prestadores.

## 4. Validar o estado da instalação, sem tocar nos dados

```bash
php sqf-private/backend/bin/onboarding-preflight.php
```

O diagnóstico mostra apenas estados agregados: conectividade, municípios, categorias, existência de administrador, transporte de e-mails e possibilidade de listar profissionais. Não exibe contas, nomes, senhas ou tokens.

## 5. Validar contas e catálogo no navegador

1. Criar conta **cliente** com um e-mail acessível e município selecionado, e confirmar o código recebido.
2. Criar conta **prestador** com e-mail diferente e um município real do IBGE. Confirmar o código, concluir perfil e cadastrar um serviço ativo.
3. No painel do prestador, consultar **Preparação para aparecer no catálogo** para identificar pendências de cidade, documentação, aprovação e publicação.
4. No painel administrativo, revisar o documento privado de identidade e registrar decisão fundamentada. Um documento aceito **não publica automaticamente** a conta.
5. No catálogo, selecionar o município e a categoria do serviço. O cliente deve ver somente os profissionais elegíveis daquele município e poder abrir o perfil completo.

A eventual exigência de assinatura é independente do cadastro, depende da política comercial ativa. Não forçar is_public nem v.status=approved via SQL para contornar verificação.

## 6. Testes automatizados

O GitHub Actions executa sintaxe PHP e JavaScript, testes de configuração de entrega com desafio simulado, bootstrap de primeiro administrador em banco descartável, fluxos de cadastro, confirmação, moderação e busca regional, testes E2E com Chromium, integridade de mídia e restauração em MySQL 8.0 e MariaDB 10.11.

Os testes **não enviam e-mail real**. A confirmação operacional requer o assistente SSH e o recebimento do código no seu e-mail. Não confundir CI aprovada com capacidade de entrega comprovada para todos os destinatários.
