import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const root=process.cwd(),out=resolve(root,'dist/audit');
const walk=async dir=>{const paths=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules','dist','.artifacts'].includes(entry.name))continue;const p=resolve(dir,entry.name);if(entry.isDirectory())paths.push(...await walk(p));else paths.push(p);}return paths;};
const files=(await walk(root)).filter(p=>/\.(?:html|js|mjs|ts|php|sql|ya?ml|json|sh)$/.test(p));
const patterns={supabase:/\b(?:supabase|getSQFClient|SQFSupabase)\b|supabase\.co/i,postgres:/\b(?:postgres(?:ql)?|jsonb|CREATE POLICY|ROW LEVEL SECURITY)\b/i,mysql:/\b(?:SQFMySQL|SQF_DB_DSN|MariaDB|MySQL)\b/i};
const findings=[];
for(const path of files){const content=await readFile(path,'utf8');const rel=relative(root,path);const kinds=Object.keys(patterns).filter(k=>patterns[k].test(content));if(kinds.length)findings.push({path:rel,kinds,scope:/^(?:supabase\/|database\/legacy\/|tests\/postgres\/)/.test(rel)?'legacy':/^(?:tests\/|database\/tests\/|\.github\/)/.test(rel)?'validation':/^(?:assets\/|backend\/)|\.html$/.test(rel)?'runtime':'other'});}
const report={scanned:files.length,findings,remainingRuntimeSupabase:findings.filter(f=>f.scope==='runtime'&&f.kinds.includes('supabase')).map(f=>f.path),note:'Text inventory: references may be compatibility branches, comments or live calls. Manual review required; not a completeness score.'};
await mkdir(out,{recursive:true});await writeFile(resolve(out,'migration-inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log('Scanned '+report.scanned+' text files; '+report.remainingRuntimeSupabase.length+' runtime files mention Supabase. See dist/audit/migration-inventory.json.');
