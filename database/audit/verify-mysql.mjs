import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),bad=[],files=[];
const walk=async dir=>{for(const e of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules','dist','.artifacts'].includes(e.name))continue;const p=resolve(dir,e.name);if(e.isDirectory())await walk(p);else files.push(p);}};
await walk(root);
const forbidden=new RegExp('post'+'gres(?:ql)?','i');
const legacyRuntime=new RegExp('supa'+'base|getSQF'+'Client|SQFSupa'+'base','i');
const incompatibleSql=/\b(?:ILIKE|ON\s+CONFLICT|BIGSERIAL|SERIAL|JSONB|TIMESTAMPTZ|RETURNING|pg_catalog|gen_random_uuid|CREATE\s+POLICY|ROW\s+LEVEL\s+SECURITY)\b|::(?:text|uuid|jsonb|integer|timestamp)\b/i;
for(const p of files){
 const rel=relative(root,p);
 const active=rel.startsWith('assets/')||rel.startsWith('backend/')||rel.startsWith('database/hostinger/')||rel.startsWith('database/mysql/')||rel.startsWith('.github/workflows/')||rel.endsWith('.html')||rel==='README.md'||rel==='service-worker.js';
 if(forbidden.test(rel)||(active&&legacyRuntime.test(rel)))bad.push(rel);
 if(/\\.(?:md|html|css|webmanifest|js|mjs|cjs|php|sql|ya?ml|json|sh|txt)$/.test(p)){
  const s=await readFile(p,'utf8');
  if(forbidden.test(s))bad.push(rel);
  if(active&&legacyRuntime.test(s))bad.push(rel+' retired runtime');
  if((rel.startsWith('backend/')&&rel.endsWith('.php')||rel.startsWith('database/mysql/')&&rel.endsWith('.sql'))&&incompatibleSql.test(s))bad.push(rel+' incompatible SQL dialect');
 }
 if(/\\.(?:js|mjs|cjs)$/.test(p)){
  const x=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(x.status!==0)throw Error(x.stderr);
 }
}
if(bad.length)throw Error('Referências proibidas: '+[...new Set(bad)].join(', '));
console.log('PASS: '+files.length+' arquivos; arquitetura de banco exclusiva MySQL/MariaDB; sintaxe JS aprovada');
