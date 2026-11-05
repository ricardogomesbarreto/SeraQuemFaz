/* Descrições editoriais genéricas: não representam oferta ou credencial de prestadores. */
'use strict';
(function (scope) {
  const topics = [
    [/ar[ -]?condicionado|climatiza|refrigera/, 'Instalação, higienização, diagnóstico de falhas e manutenção preventiva ou corretiva de equipamentos de climatização. Consulte a especialidade de cada prestador.'],
    [/advoc|jur[ií]dic|direito/, 'Orientação jurídica, análise documental e acompanhamento de demandas legais, conforme a habilitação profissional e a área de atuação informadas.'],
    [/mec[aâ]nic|automotiv|ve[ií]cul|oficina/, 'Diagnóstico, revisões, manutenção preventiva e reparos de veículos, conforme o tipo de automóvel e a especialização do profissional.'],
    [/pedreir|constru|reforma|alvenaria/, 'Serviços de construção e reforma, incluindo alvenaria, acabamentos, reparos e manutenção de imóveis, de acordo com o escopo contratado.'],
    [/eletric/, 'Instalações, inspeções, reparos e manutenção de sistemas elétricos, observadas as qualificações e exigências de segurança aplicáveis.'],
    [/encan|hidr[aá]ul|bombeiro hidr/, 'Instalação e manutenção de tubulações, torneiras, redes hidráulicas e soluções para vazamentos.'],
    [/inform[aá]tic|comput|tecnolog/, 'Suporte técnico, configuração, manutenção de equipamentos e soluções digitais, conforme o serviço anunciado.'],
    [/beleza|cabel|barbear|est[eé]tic/, 'Atendimentos de beleza e cuidados pessoais, sujeitos à especialidade e às condições de atendimento de cada profissional.'],
    [/limpeza|diarista|faxina/, 'Limpeza, organização e conservação de ambientes residenciais ou comerciais, conforme a modalidade de atendimento.']
  ];
  function forCategory(category) {
    const name = String(category?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const match = topics.find(([pattern]) => pattern.test(name));
    if (match) return match[1];
    const desc = String(category?.description || '').trim();
    return desc || 'Esta área reúne serviços relacionados à especialidade informada. Consulte o perfil de cada profissional para conhecer os trabalhos oferecidos, a experiência declarada e as avaliações de clientes.';
  }
  scope.SQFCategorySummary = Object.freeze({ forCategory });
})(typeof window === 'undefined' ? globalThis : window);
