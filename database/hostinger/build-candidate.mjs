import {mkdir,readFile,writeFile,cp,readdir,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dest=join(root,'dist/mysql-candidate'),pub=join(dest,'public_html'),priv=join(dest,'sqf-private');
await rm(dest,{recursive:true,force:true});await mkdir(pub,{recursive:true});await mkdir(priv,{recursive:true});
const pages=['index.html','categorias.html','categoria.html','entrar.html','cadastro.html','ajuda.html','privacidade.html','termos.html','painel-mysql.html','prestador-mysql.html','admin-mysql.html'];
const scripts=new Set(['backend-mode.js','mysql-api-client.js']);
for(const page of pages){
 let html=await readFile(join(root,page),'utf8');
 html=html.replace(/<script\b[^>]*src=["'][^"']*(?:supabase-js|supabase-config\.js|account-compat\.js)[^"']*["'][^>]*>\s*<\/script>/gi,'');
 if(/src=["']assets\/auth-navigation\.js/.test(html)&&!html.includes('assets/backend-mode.js'))html=html.replace(/(<script\b[^>]*src=["']assets\/auth-navigation\.js["'][^>]*>)/i,'<script defer src="assets/backend-mode.js"></script><script defer src="assets/mysql-api-client.js"></script>$1');
 for(const m of html.matchAll(/<script\b[^>]*src=["']assets\/([^"']+\.js)["']/g))scripts.add(m[1]);
 if(/<script\b[^>]*src=["'][^"']*supabase/i.test(html))throw Error('Legacy SDK: '+page);
 await writeFile(join(pub,page),html);
}
for(const [legacy,candidate] of [['painel.html','painel-mysql.html'],['prestador.html','prestador-mysql.html'],['admin.html','admin-mysql.html']])await cp(join(pub,candidate),join(pub,legacy));
await mkdir(join(pub,'assets'),{recursive:true});
for(const entry of await readdir(join(root,'assets'),{withFileTypes:true})){
 if(entry.isDirectory()||/\.(?:css|json|png|webp|jpg|jpeg|svg|ico)$/i.test(entry.name)||scripts.has(entry.name))await cp(join(root,'assets',entry.name),join(pub,'assets',entry.name),{recursive:true});
}
await writeFile(join(pub,'assets/backend-mode.js'),"'use strict';\nwindow.SQFDataMode = 'mysql';\n");
for(const p of ['manifest.webmanifest','service-worker.js','offline.html'])await cp(join(root,p),join(pub,p));
await cp(join(root,'backend/src'),join(priv,'backend/src'),{recursive:true});
await cp(join(root,'backend/bin'),join(priv,'backend/bin'),{recursive:true});
await mkdir(join(priv,'backend/public'),{recursive:true});
await cp(join(root,'backend/public/index.php'),join(priv,'backend/public/index.php'));
await cp(join(root,'database/hostinger/config.example.php'),join(priv,'config.example.php'));
await mkdir(join(pub,'api'),{recursive:true});await cp(join(root,'database/hostinger/api-entry.example.php'),join(pub,'api/index.php'));
await cp(join(root,'dist/hostinger'),join(dest,'database'),{recursive:true});
await cp(join(root,'database/hostinger/public.htaccess'),join(pub,'.htaccess'));
await cp(join(root,'database/hostinger/unlimited-profile.json'),join(dest,'unlimited-profile.json'));
await writeFile(join(dest,'README.txt'),'HOSTINGER UNLIMITED — CANDIDATO DE HOMOLOGAÇÃO — NÃO IMPLANTAR EM PRODUÇÃO.\npublic_html: arquivos públicos; sqf-private: fora da raiz web, config.php a provisionar localmente.\nSQL: database/01-instalar-banco.sql. MySQL/MariaDB; checkout desativado.\n');
console.log('MySQL candidate generated: '+scripts.size+' public scripts; no production credentials.');
