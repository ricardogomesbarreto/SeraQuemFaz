const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('official backend is fixed to mysql',()=>assert.match(read('assets/backend-mode.js'),/SQFDataMode = 'mysql'/));
test('public pages use no external database SDK',()=>{for(const p of ['index.html','categorias.html','categoria.html','entrar.html','cadastro.html','privacidade.html','termos.html','painel.html','prestador.html','admin.html'])assert.doesNotMatch(read(p),/<script\b[^>]*src=["']https?:\/\//i,p);});
test('canonical panels match validated candidate',()=>{for(const p of ['painel','prestador','admin'])assert.equal(read(p+'.html'),read(p+'-mysql.html'));});
test('server connection rejects non-mysql DSN',()=>assert.match(read('backend/src/Database.php'),/str_starts_with\(\$dsn, 'mysql:'\)/));
test('candidate explicitly blocks production',()=>{const x=JSON.parse(read('database/candidate-version.json'));assert.equal(x.production,false);assert.equal(x.deploymentAllowed,false);assert.deepEqual(x.database,['MySQL 8.0','MariaDB 10.11']);});
test('private config is not included as live config',()=>assert.equal(fs.existsSync(path.join(root,'backend/config.php')),false));
