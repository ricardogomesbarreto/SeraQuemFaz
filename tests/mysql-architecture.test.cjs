const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('official backend is fixed to mysql',()=>assert.match(read('assets/backend-mode.js'),/SQFDataMode = 'mysql'/));
test('public pages use no external database SDK',()=>{for(const p of ['index.html','categorias.html','categoria.html','entrar.html','cadastro.html','privacidade.html','termos.html','painel.html','prestador.html','admin.html'])assert.doesNotMatch(read(p),/<script\b[^>]*src=["']https?:\/\//i,p);});
test('canonical panels match validated candidate',()=>{for(const p of ['painel','prestador','admin'])assert.equal(read(p+'.html'),read(p+'-mysql.html'));});
test('server connection rejects non-mysql DSN',()=>assert.match(read('backend/src/Database.php'),/str_starts_with\(\$dsn, 'mysql:'\)/));
test('database connection enforces utf8mb4 and native PDO MySQL driver',()=>{const code=read('backend/src/Database.php');assert.match(code,/charset=utf8mb4/);assert.match(code,/PDO::ATTR_DRIVER_NAME/);assert.match(code,/SET time_zone/);});
test('candidate explicitly blocks production',()=>{const x=JSON.parse(read('database/candidate-version.json'));assert.equal(x.production,false);assert.equal(x.deploymentAllowed,false);assert.deepEqual(x.database,['MySQL 8.0','MariaDB 10.11']);});
test('private config is not included as live config',()=>assert.equal(fs.existsSync(path.join(root,'backend/config.php')),false));

test('Hostinger candidate rejects legacy database artifacts and connection secrets',()=>{
 const source=read('database/hostinger/build-candidate.mjs');
 assert.match(source,/forbiddenPath/);
 assert.match(source,/forbiddenRuntime/);
 assert.match(source,/await inspect\(pub\)/);
 assert.match(source,/await inspect\(join\(priv,'backend'\)\)/);
 assert.match(source,/config[.]example[.]php/);
 assert.match(source,/01-instalar-banco[.]sql/);
 assert.match(source,/02-verificar-banco[.]sql/);
 assert.match(source,/hasLegacyReference\(contents\)/);
 assert.match(source,/forbiddenRuntime=new RegExp/);
 assert.match(source,/hasLegacyReference/);
});
test('Hostinger package is built from an explicit page allowlist',()=>{
 const source=read('database/hostinger/build-candidate.mjs');
 assert.match(source,/const pages=\[/);
 assert.match(source,/dist\/mysql-candidate/);
 assert.match(source,/allowedAssetDirectories/);
 assert.match(source,/Unapproved public asset directory/);
});

test('persistent MySQL import requires explicitly matched isolated staging schema',()=>{
 const source=read('backend/src/ImportSnapshot.php');
 assert.match(source,/SQF_IMPORT_STAGING_ENABLED/);
 assert.match(source,/SQF_IMPORT_STAGING_DATABASE/);
 assert.match(source,/hash_equals\(\$expected,\$database\)/);
 assert.match(source,/Destino de importação não é o banco isolado autorizado/);
 const runner=read('database/tests/run-isolated-import.sh');
 assert.match(runner,/sqf_import_stage/);
 assert.match(runner,/SQF_TEST_ISOLATED_IMPORT_STAGE=1/);
});
test('database restoration comparison accepts only the MySQL DSN family',()=>{
 assert.match(read('database/tests/restore-check.php'),/str_starts_with\(\$dsn,'mysql:'\)/);
 assert.match(read('database/tests/run-isolated-restore.sh'),/sqf_import_restore/);
});

test('isolated fictional restore rejects extra and altered media files',()=>{const source=read('database/tests/isolated-media-inventory.php');assert.match(source,/sqfMediaInventory/);assert.match(source,/physicalInventory/);assert.match(source,/orphan media/);assert.match(read('database/tests/run-isolated-restore.sh'),/isolated-media-inventory[.]php/);});
