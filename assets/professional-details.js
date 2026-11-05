'use strict';
// Campos complementares declarados pelo prestador; a validação de autorização
// e limites é repetida pelo PostgreSQL/RLS, nunca confiada somente à interface.
(function(scope){
  const WORKDAY_LABELS = Object.freeze(['','Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']);
  const MODES = Object.freeze({nao_informado:'Não informado',presencial:'Presencial',remoto:'Remoto',hibrido:'Presencial e remoto'});
  const PERIODS = Object.freeze({nao_informado:'A combinar',manha:'Manhã',tarde:'Tarde',noite:'Noite',flexivel:'Horário flexível'});
  const QUOTES = Object.freeze({sob_consulta:'Condições sob consulta',orcamento_gratuito:'Orçamento informado como gratuito',orcamento_pago:'Orçamento informado como pago'});
  const clean = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  const allowedUrl = (value) => {
    const str=clean(value);
    if(!str)return '';
    try{
      const url=new URL(str);
      if(url.protocol!=='https:' || url.username || url.password || !url.hostname.includes('.') || str.length>300)
        return null;
      if(['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname.toLowerCase()))return null;
      return url.href;
    }catch{return null;}
  };
  const normalizeDays = (days) => [...new Set((Array.isArray(days)?days:[]).map(Number))]
    .filter(day => Number.isInteger(day) && day>=1 && day<=7).sort((a,b)=>a-b);
  const readForm = (root) => {
    const get=(name)=>root.querySelector(`[name="${name}"]`);
    const title=clean(get('professional_title')?.value);
    const specialties=clean(get('specialties')?.value);
    const coverage=clean(get('coverage_area')?.value);
    const experience=get('experience_years')?.value.trim() || '';
    const mode=get('service_mode')?.value || 'nao_informado';
    const period=get('work_period')?.value || 'nao_informado';
    const quote=get('quote_policy')?.value || 'sob_consulta';
    const website=allowedUrl(get('professional_website')?.value);
    const workdays=normalizeDays([...root.querySelectorAll('[name="workdays"]:checked')].map(node=>node.value));
    if(title.length>100)throw new Error('O título profissional deve ter até 100 caracteres.');
    if(specialties.length>220)throw new Error('As especialidades devem ter até 220 caracteres.');
    if(coverage.length>240)throw new Error('A área de atendimento deve ter até 240 caracteres.');
    if(experience && (!/^\d+$/.test(experience)||Number(experience)>60))throw new Error('Informe uma experiência entre 0 e 60 anos, ou deixe em branco.');
    if(!Object.hasOwn(MODES,mode) || !Object.hasOwn(PERIODS,period) || !Object.hasOwn(QUOTES,quote))
      throw new Error('Selecione apenas opções válidas de atendimento e orçamento.');
    if(website===null)throw new Error('O site profissional precisa usar HTTPS e não pode conter credenciais.');
    return {
      professional_title:title,
      specialties,
      experience_years:experience===''?null:Number(experience),
      service_mode:mode,
      coverage_area:coverage,
      workdays,
      work_period:period,
      quote_policy:quote,
      professional_website:website
    };
  };
  const populate = (root,data={}) => {
    for(const key of ['professional_title','specialties','experience_years','service_mode','coverage_area','work_period','quote_policy','professional_website']){
      const el=root.querySelector(`[name="${key}"]`);
      if(el)el.value=data[key]??(key==='quote_policy'?'sob_consulta':key==='service_mode'||key==='work_period'?'nao_informado':'');
    }
    const days=normalizeDays(data.workdays);
    for(const input of root.querySelectorAll('[name="workdays"]'))input.checked=days.includes(Number(input.value));
  };
  const completion=(data={})=>{
    const checklist=[
      ['Título profissional',Boolean(clean(data.professional_title))],
      ['Especialidades',Boolean(clean(data.specialties))],
      ['Modalidade de atendimento',Boolean(data.service_mode && data.service_mode!=='nao_informado')],
      ['Regiões atendidas',Boolean(clean(data.coverage_area))],
      ['Dias de atendimento',normalizeDays(data.workdays).length>0],
      ['Turnos de atendimento',Boolean(data.work_period && data.work_period!=='nao_informado')]
    ];
    return {items:checklist,done:checklist.filter(([,value])=>value).length,total:checklist.length};
  };
  scope.SQFProfessionalDetails=Object.freeze({readForm,populate,completion,allowedUrl,normalizeDays,MODES,PERIODS,QUOTES,WORKDAY_LABELS});
})(typeof window==='undefined'?globalThis:window);
