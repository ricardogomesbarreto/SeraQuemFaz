import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(process.argv[2]||resolve(root,'dist/hostinger'));
const files=['001_schema.sql','002_auth.sql','003_staff_mfa.sql','004_provider_verification_backfill.sql','005_billing_payment_uniqueness.sql','006_payment_attempts.sql','007_billing_intents_indexes.sql'];
const migrations=await Promise.all(files.map(name=>readFile(resolve(root,'database/mysql/migrations',name),'utf8')));
const categories=JSON.parse(await readFile(resolve(root,'database/seed/categories.json'),'utf8'));
const cities=JSON.parse(await readFile(resolve(root,'assets/municipios-br.json'),'utf8'));
if(categories.length!==51||cities.length<5500)throw new Error('Dados públicos incompletos');
const hex=value=>value===null?'NULL':"CONVERT(X'"+Buffer.from(String(value),'utf8').toString('hex')+"' USING utf8mb4)";
const chunks=(rows,size=200)=>Array.from({length:Math.ceil(rows.length/size)},(_,i)=>rows.slice(i*size,(i+1)*size));
const cityRows=cities.map(m=>{
 if(!/^[0-9]{7}$/.test(m.id)||!/^[A-Z]{2}$/.test(m.uf))throw new Error('Município inválido');
 return '('+[hex(m.id),hex(m.name),hex(m.uf),Number(m.id.slice(0,2))].join(',')+')';
});
const catRows=categories.map(c=>{
 if(!/^[0-9a-f-]{36}$/i.test(c.id)||c.status!=='active')throw new Error('Categoria inválida');
 return '('+[c.id,c.name,c.description,c.image_url,c.status].map(hex).join(',')+')';
});
const seed=[
 'START TRANSACTION;',
 ...chunks(cityRows).map(rows=>'INSERT INTO sqf_ibge_municipalities(code,name,uf,ibge_uf) VALUES\n'+rows.join(',\n')+';'),
 ...chunks(catRows).map(rows=>'INSERT INTO categories(id,name,description,image_url,status) VALUES\n'+rows.join(',\n')+';'),
 'INSERT INTO sqf_billing_settings(singleton,require_paid_subscription,checkout_enabled) VALUES (1,0,0);',
 'COMMIT;'
].join('\n');
const sql=['-- SERA QUEM FAZ? | Hostinger | INSTALACAO LIMPA, HOMOLOGACAO',
 '-- Selecione um banco NOVO e VAZIO. Nao contem contas ou dados privados.',
 '-- MySQL 8.0 / MariaDB 10.11 (matriz CI). Nao executar sobre dados existentes.',
 'SET NAMES utf8mb4;','SET time_zone = \' +00:00\';'.replace(' +','+'),
 ...migrations.map((body,i)=>'-- '+files[i]+'\n'+body.trim()),
 '-- Dados publicos (municipios IBGE e categorias); checkout desativado.',seed,''].join('\n\n');
const forbidden=/^\s*(?:CREATE|DROP)\s+DATABASE\b|^\s*GRANT\b|^\s*USE\s+\w|\bDEFINER\s*=/im;
if(forbidden.test(sql))throw new Error('SQL incompatível com importação compartilhada');
await mkdir(out,{recursive:true});
const filename='01-instalar-banco.sql';
await writeFile(resolve(out,filename),sql,'utf8');
for(const name of ['README.md','config.example.php','api-entry.example.php','02-verificar-banco.sql'])await copyFile(resolve(root,'database/hostinger',name),resolve(out,name));
const digest=createHash('sha256').update(sql).digest('hex');
await writeFile(resolve(out,'SHA256SUMS'),digest+'  '+filename+'\n');
console.log('SQL Hostinger: '+filename+' | '+categories.length+' categorias | '+cities.length+' municípios | SHA256 '+digest);
