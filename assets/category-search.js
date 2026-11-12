'use strict';
/* Busca assistida: aproxima termos do cotidiano às categorias reais do banco.
   Não cria categorias artificiais nem inventa prestadores ou disponibilidade.
   Nenhuma pesquisa pessoal é enviada a serviço externo. */
(function(scope){
  const normalize=value=>String(value??'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  // Correspondências editoriais: a existência de cada destino é validada
  // contra os dados ativos retornados pela API MySQL antes de ser mostrada.
  const aliases=Object.freeze([
    ['faxina',['Limpeza']],
    ['diarista',['Limpeza']],
    ['limpar casa',['Limpeza']],
    ['empregada domestica',['Limpeza']],
    ['vazamento',['Encanador']],
    ['encanamento',['Encanador']],
    ['cano estourado',['Encanador']],
    ['torneira',['Encanador']],
    ['chuveiro eletrico',['Eletricista']],
    ['instalacao eletrica',['Eletricista']],
    ['fiação',['Eletricista']],
    ['fiacao',['Eletricista']],
    ['tomada',['Eletricista']],
    ['computador',['Técnico de Informática']],
    ['notebook',['Técnico de Informática']],
    ['formatar pc',['Técnico de Informática']],
    ['conserto pc',['Técnico de Informática']],
    ['impressora',['Técnico de Informática','Fotocópias e Impressões']],
    ['geladeira',['Técnico em Refrigeração']],
    ['freezer',['Técnico em Refrigeração']],
    ['refrigerador',['Técnico em Refrigeração']],
    ['celular quebrado',['Técnico de Celular']],
    ['tela de celular',['Técnico de Celular']],
    ['smartphone',['Técnico de Celular']],
    ['corte de cabelo',['Barbeiro','Cabeleireiro']],
    ['cabelo',['Cabeleireiro','Barbeiro']],
    ['unhas',['Manicure e Pedicure']],
    ['unha em gel',['Manicure e Pedicure']],
    ['grama',['Jardineiro']],
    ['jardim',['Jardineiro']],
    ['poda',['Jardineiro']],
    ['obra',['Construção','Pedreiro']],
    ['reforma',['Construção','Pedreiro']],
    ['parede',['Pedreiro','Pintor']],
    ['mudar cor parede',['Pintor']],
    ['carro quebrado',['Mecânico']],
    ['oficina mecanica',['Mecânico']],
    ['conserto carro',['Mecânico']],
    ['revisao carro',['Mecânico']],
    ['aula particular',['Professor Particular']],
    ['reforco escolar',['Professor Particular']],
    ['aulas de reforco',['Professor Particular']],
    ['advocacia',['Advogado']],
    ['advogado criminal',['Advogado']],
    ['direito de familia',['Advogado']],
    ['imposto de renda',['Contador']],
    ['contabilidade',['Contador']],
    ['filmagem',['Videomaker','Fotógrafo de Eventos']],
    ['ensaio fotografico',['Fotógrafo']],
    ['casamento',['Eventos','Fotógrafo de Eventos','Buffet']]
  ].map(([word,names])=>Object.freeze([normalize(word),Object.freeze(names.map(normalize))])));
  const words=q=>q.split(' ').filter(Boolean);
  function aliasMatches(query,term){
    if(query===term)return true;
    if(term.length<4)return false;
    const queryWords=words(query),termWords=words(term);
    if(termWords.length===1)return queryWords.includes(term);
    return (' '+query+' ').includes(' '+term+' ');
  }
  function rank(category,query){
    const q=normalize(query);if(!q)return 0;
    const name=normalize(category?.name),description=normalize(category?.description);
    if(!name)return 0;
    if(name===q)return 120;
    if(name.startsWith(q))return 100;
    if(name.includes(q))return 80;
    if(description.includes(q))return 60;
    let score=0;
    for(const [term,targetNames] of aliases){
      if(targetNames.includes(name)&&aliasMatches(q,term)){
        score=Math.max(score,q===term?75:68);
      }
    }
    return score;
  }
  function find(categories,query){
    if(!Array.isArray(categories))return [];
    const q=normalize(query);if(!q)return categories.slice();
    return categories.filter(x=>rank(x,q)>0);
  }
  function distance(a,b){
    if(Math.abs(a.length-b.length)>2)return 3;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];
      for(let j=1;j<=b.length;j++){
        cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+Number(a[i-1]!==b[j-1]));
      }
      prev=cur;
    }
    return prev[b.length];
  }
  // Sugestões de grafia: apenas nomes de categorias de fato cadastradas.
  function suggest(categories,query,limit=3){
    const q=normalize(query);
    if(!Array.isArray(categories)||q.length<4||q.length>48||find(categories,q).length)return [];
    return categories.map(category=>{
      const name=normalize(category?.name);
      const min=words(name).reduce((value,word)=>Math.min(value,distance(q,word)),distance(q,name));
      return {category,d:min};
    }).filter(x=>x.d<=2)
      .sort((a,b)=>a.d-b.d||String(a.category.name).localeCompare(String(b.category.name),'pt-BR'))
      .slice(0,Math.max(0,Math.min(5,Number(limit)||3))).map(x=>x.category);
  }
  scope.SQFCategorySearch=Object.freeze({normalize,rank,find,suggest});
})(typeof window==='undefined'?globalThis:window);
