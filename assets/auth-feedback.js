'use strict';
/* Mensagens públicas sem revelar detalhes de outras contas ou SMTP. */
(function (scope) {
  const asText = value => String(value ?? '').toLowerCase();
  function classify(error) {
    const code = asText(error?.code);
    const message = asText(error?.message);
    const status = Number(error?.status || 0);
    if (code === 'over_email_send_rate_limit' || message.includes('email rate limit exceeded')) return 'email-limit';
    if (code === 'email_address_not_authorized') return 'email-unauthorized';
    if (status === 429 || code.includes('rate_limit') || code === 'too_many_requests') return 'rate-limit';
    if (code === 'signup_disabled') return 'signup-disabled';
    if (code === 'email_not_confirmed') return 'email-unconfirmed';
    if (code === 'weak_password') return 'weak-password';
    return 'other';
  }
  function message(error, context = 'signup') {
    switch (classify(error)) {
      case 'email-limit':
        return 'O serviço de e-mail do Supabase atingiu o limite de envios (HTTP 429). Não tente enviar o cadastro repetidamente: aguarde a liberação do limite. O administrador deve configurar SMTP próprio antes de liberar novos cadastros.';
      case 'email-unauthorized':
        return 'Este projeto do Supabase não está autorizado a enviar mensagens para esse endereço. O administrador precisa configurar um provedor SMTP próprio para permitir cadastros públicos.';
      case 'rate-limit':
        return 'Muitas solicitações foram enviadas em pouco tempo (HTTP 429). Evite repetir as tentativas e tente mais tarde; se persistir, consulte o administrador.';
      case 'signup-disabled':
        return 'Novos cadastros estão desativados neste projeto do Supabase. Contate a administração.';
      case 'email-unconfirmed':
        return 'Confirme seu e-mail antes de entrar. Se não recebeu a mensagem, aguarde e verifique o limite de envio do Supabase.';
      case 'weak-password':
        return 'A senha não atende às exigências de segurança do servidor. Utilize uma senha mais longa e difícil de adivinhar.';
      default:
        return context === 'signup'
          ? 'Não foi possível concluir o cadastro. Confira os dados e a conexão; se o erro persistir, consulte a administração.'
          : context === 'reset'
            ? 'Não foi possível enviar a recuperação agora. Tente novamente mais tarde.'
            : 'Não foi possível entrar. Confira as credenciais e o status de confirmação do e-mail.';
    }
  }
  scope.SQFAuthFeedback = Object.freeze({ classify, message });
})(typeof window === 'undefined' ? globalThis : window);
