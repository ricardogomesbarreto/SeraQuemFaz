// Dados fictícios apenas para testes visuais. NÃO é produção.

(() => {
const pro='11111111-1111-4111-8111-111111111111', clientId='22222222-2222-4222-8222-222222222222';
const categories=[{id:'3',name:'Serviços de Mecânica',description:'Revisão, reparos automotivos e manutenção de veículos.',image_url:null,status:'active'}, {id:'4',name:'Instalações Elétricas',description:'Elétrica residencial e comercial.',image_url:null,status:'active'}];
const profiles=[{id:pro,full_name:'Marina Alves',account_type:'prestador',city:'Santa Inês – MA',bio:'Profissional com experiência em manutenção automotiva e serviços de diagnóstico. Atendimento sob consulta.',avatar_path:'11111111-1111-4111-8111-111111111111/avatar.png',is_public:true},{id:clientId,full_name:'Cliente de teste',account_type:'cliente',city:'',bio:'',avatar_path:null,is_public:false}];
const provider_services=[{id:'service1',provider_id:pro,category_id:'3',service_title:'Manutenção preventiva',description:'Revisão e inspeção geral.'},{id:'service2',provider_id:pro,category_id:'3',service_title:'Diagnóstico de motor',description:'Avaliação de funcionamento.'}];
const portfolio_photos=[{id:'photo1',provider_id:pro,storage_path:pro+'/portfolio.png',caption:'Trabalho de manutenção automotiva',created_at:'2026-11-03T14:00:00Z'}];
const reviews=[{id:'review1',provider_id:pro,reviewer_id:clientId,rating:5,comment:'Excelente atendimento, explicação clara e trabalho organizado.',created_at:'2026-10-30T15:00:00Z'}];
const tables={categories,profiles,provider_services,portfolio_photos,reviews};
const user=location.pathname.includes('painel') ? {id:pro,email:'marina@example.test',user_metadata:{full_name:'Marina Alves',account_type:'prestador'}} : {id:clientId,email:'cliente@example.test',user_metadata:{full_name:'Cliente de teste',account_type:'cliente'}};
class Query{
 constructor(table){this.table=table;this.filters=[];this.sorter=null;this.mode='select';this.data=null;this.lim=null;}
 select(){return this;} eq(k,v){this.filters.push(row=>String(row[k])===String(v));return this;}
 in(k,values){this.filters.push(row=>values.map(String).includes(String(row[k])));return this;}
 order(k,opts={}){this.sorter=[k,opts];return this;}
 limit(n){this.lim=n;return this;}
 maybeSingle(){const result=this.run();return Promise.resolve({data:result.data[0]||null,error:null});}
 single(){const result=this.run();return Promise.resolve({data:result.data[0]||this.data||null,error:null});}
 insert(record){this.mode='insert';this.data=record;return this;}
 update(record){this.mode='update';this.data=record;return this;}
 delete(){this.mode='delete';return this;}
 run(){let list=tables[this.table]||[];let found=list.filter(row=>this.filters.every(fn=>fn(row)));if(this.mode==='insert'){const entry={id:'new_'+Date.now(),...this.data, created_at:new Date().toISOString()};list.push(entry);return {data:[entry],error:null};}
 if(this.mode==='update'){found.forEach(row=>Object.assign(row,this.data));return {data:found,error:null};}
 if(this.mode==='delete'){found.forEach(row=>{let i=list.indexOf(row);if(i>=0)list.splice(i,1)});return {data:found,error:null};}
 if(this.sorter){let [k,opt]=this.sorter;found.sort((a,b)=>String(a[k]??'').localeCompare(String(b[k]??''))*(opt.ascending===false?-1:1));}
 return {data:this.lim==null?found:found.slice(0,this.lim),error:null};}
 then(resolve,reject){try{resolve(this.run())}catch(e){if(reject)reject(e)}}
}
const client={from:(table)=>new Query(table),auth:{getUser:async()=>({data:{user},error:null}),signOut:async()=>({error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},storage:{from:(bucket)=>({getPublicUrl:(path)=>({data:{publicUrl:'https://ujrzbwoqcgygaizxnyhl.supabase.co/storage/v1/object/public/'+bucket+'/'+path}}),upload:async()=>({error:null}),remove:async()=>({error:null})})}};
window.supabase={createClient:()=>client};
})();

