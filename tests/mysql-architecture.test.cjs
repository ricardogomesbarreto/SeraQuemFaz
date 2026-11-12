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
test('database restoration comparison accepts only native MySQL utf8mb4',()=>{
 const restore=read('database/tests/restore-check.php');
 assert.match(restore,/str_starts_with\(\$dsn,'mysql:'\)/);
 assert.match(restore,/charset=utf8mb4/);
 assert.match(restore,/PDO::ATTR_DRIVER_NAME/);
 assert.match(read('database/tests/run-isolated-restore.sh'),/sqf_import_restore/);
});

test('isolated fictional restore rejects extra and altered media files',()=>{const source=read('database/tests/isolated-media-inventory.php');assert.match(source,/sqfMediaInventory/);assert.match(source,/physicalInventory/);assert.match(source,/orphan media/);assert.match(read('database/tests/run-isolated-restore.sh'),/isolated-media-inventory[.]php/);});

test('migration audit rejects database-specific SQL unsupported by both engines',()=>{
 const code=read('database/audit/verify-mysql.mjs');
 assert.match(code,/incompatibleSql/);
 assert.ok(code.includes('CONFLICT')&&code.includes('incompatibleSql'));
 assert.match(code,/TIMESTAMPTZ/);
 assert.match(code,/incompatible SQL dialect/);
});
test('staging suite tests persisted rollback and all imported table counts',()=>{
 const code=read('database/tests/snapshot-integration.php');
 assert.match(code,/persistent import rejects tampered WebP manifest/);
 assert.match(code,/persistent import rejects orphaned message sender/);
 assert.ok(code.includes('foreach(sqfImportTables() as $name)'));
});

test('source audit executes on real temporary files, not only on its own source text',()=>{
 const os=require('node:os');
 const cp=require('node:child_process');
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'sqf-mysql-audit-'));
 const audit=path.join(root,'database/audit/verify-mysql.mjs');
 const run=()=>cp.spawnSync(process.execPath,[audit],{cwd:scratch,encoding:'utf8'});
 try{
  const legacy=path.join(scratch,'retired.php');
  fs.writeFileSync(legacy,'<?php // '+['post','gres'].join('')+'\\n');
  let result=run();
  assert.notEqual(result.status,0,'retired database reference must fail source audit');
  assert.match(result.stderr,/Referências proibidas/);
  fs.rmSync(legacy);
  const migrations=path.join(scratch,'database','mysql','migrations');
  fs.mkdirSync(migrations,{recursive:true});
  fs.writeFileSync(path.join(migrations,'001_syntax.sql'),'INSERT INTO t VALUES (1) ON CONFLICT DO NOTHING;\\n');
  result=run();
  assert.notEqual(result.status,0,'unsupported SQL dialect must fail source audit');
  assert.match(result.stderr,/incompatible SQL dialect/);
 }finally{
  fs.rmSync(scratch,{recursive:true,force:true});
 }
});

test('every frontend PHP/MySQL API route is registered in the server router',()=>{
 const client=read('assets/mysql-api-client.js');
 const server=read('backend/public/index.php');
 const routes=[...new Set([...client.matchAll(/\bcall\('([^']+)'/g)].map(match=>match[1]))];
 assert.ok(routes.length>=65,'unexpectedly small API contract');
 for(const route of routes)
  assert.ok(server.includes("'"+route+"'")||server.includes('"'+route+'"'),'route missing in PHP router: '+route);
});

test('MySQL/MariaDB read-path indexes are part of the local schema installer',()=>{
 const installer=read('database/hostinger/build-install.mjs');
 const migration=read('database/mysql/migrations/009_marketplace_read_indexes.sql');
 for(const name of ['ix_sqf_messages_request_time','ix_sqf_requests_open_lookup','ix_sqf_reviews_provider_status_time','ix_sqf_reviews_moderation_queue'])
  assert.ok(migration.includes(name),'missing index '+name);
 assert.ok(installer.includes('009_marketplace_read_indexes.sql'),'migration 009 is not included');
 assert.match(read('database/tests/index-inventory.php'),/information_schema[.]statistics/);
});
test('message reads preserve participant authorization without write locks',()=>{
 const server=read('backend/src/Marketplace.php');
 const start=server.indexOf('function sqfMessages(');
 const end=server.indexOf('function sqfSendMessage(',start);
 assert.ok(start>=0&&end>start);
 const method=server.slice(start,end);
 assert.match(method,/client_id,provider_id/);
 assert.match(method,/Acesso negado/);
 assert.doesNotMatch(method,/FOR UPDATE|sqfTxn/);
 assert.match(method,/LIMIT 100/);
});

test('PHP API and browser client agree on GET versus POST for every registered call',()=>{
 const client=read('assets/mysql-api-client.js');
 const router=read('backend/public/index.php');
 const publicGet=new Set([...router.matchAll(/\$method==='GET'&&\$route==='([^']+)'/g)].map(match=>match[1]));
 const calls=[...client.matchAll(/\bcall\('([^']+)'([^)]*)\)/g)];
 assert.ok(calls.length>=65,'unexpectedly small API surface');
 for(const [,route,args] of calls){
  const get=!args.trim()||args.trim().startsWith(',undefined');
  assert.equal(get,publicGet.has(route),'HTTP method mismatch for '+route);
 }
 assert.ok(client.includes("url.searchParams.set('route','media/upload')"),'multipart upload route missing');
});
test('unknown-account login uses Argon2id rather than a cheaper dummy hash',()=>{
 const source=read('backend/src/Auth.php');
 assert.ok(source.includes("dummy='$argon2id$"));
 assert.ok(source.includes("password_verify($password,$u['password_hash']??$dummy)"));
});

test('recurring service engagements preserve existing reviews while creating distinct records',()=>{
 const schema=read('database/mysql/migrations/010_engagement_per_request.sql');
 const installer=read('database/hostinger/build-install.mjs');
 const service=read('backend/src/Marketplace.php');
 const review=read('backend/src/Moderation.php');
 const integration=read('database/tests/agenda-integration.php');
 assert.match(schema,/ADD COLUMN source_request_id/);
 assert.match(schema,/ADD UNIQUE KEY uq_service_engagement_source_request/);
 assert.match(schema,/DROP INDEX service_engagements_client_id_provider_id_key/);
 assert.doesNotMatch(schema,/\b(?:DELETE FROM|TRUNCATE|DROP TABLE)\b/i);
 assert.ok(installer.includes('010_engagement_per_request.sql'),'migration 010 missing from installer');
 assert.ok(service.includes('INSERT INTO service_engagements(id,client_id,provider_id,source_request_id,status'));
 assert.doesNotMatch(service,/ON DUPLICATE KEY UPDATE status='confirmed'/);
 assert.ok(review.includes('source_request_id IS NULL OR source_request_id=?'));
 assert.match(integration,/repeat engagement uses distinct review slot/);
 assert.match(integration,/repeat service cannot be reviewed twice/);
 assert.match(read('database/tests/run-isolated-import.sh'),/engagement-integrity[.]php/);
});

test('Hostinger upload builder separates public site from private PHP and SQL',()=>{
 const script=read('database/hostinger/package-upload.mjs');
 const pkg=JSON.parse(read('package.json'));
 assert.match(pkg.scripts['build:dist'],/package-upload[.]mjs/);
 assert.match(script,/site-public_html[.]zip/);
 assert.match(script,/sqf-private[.]zip/);
 assert.ok(script.includes("name:'sqf-private/'+x.name"));
 assert.match(script,/config[.]php/);
 assert.match(script,/SHA256SUMS/);
 assert.match(read('.github/workflows/mysql-mariadb.yml'),/hostinger-unlimited-staging-uploads/);
});

test('candidate release and Hostinger staging metadata remain internally consistent',()=>{
 const pkg=JSON.parse(read('package.json'));
 const candidate=JSON.parse(read('database/candidate-version.json'));
 const profile=JSON.parse(read('database/hostinger/unlimited-profile.json'));
 assert.equal(pkg.version,candidate.version);
 assert.equal(pkg.version,'3.14.0-rc.15');
 assert.equal(candidate.production,false);
 assert.equal(candidate.deploymentAllowed,false);
 assert.equal(profile.deploymentAllowed,false);
 assert.equal(profile.phpMinimum,'8.2');
 const preflight=read('backend/bin/hostinger-preflight.php');
 assert.match(preflight,/php_8_2_plus/);
 assert.match(preflight,/PHP_VERSION_ID>=80200/);
 assert.match(read('.github/workflows/mysql-mariadb.yml'),/needs: \[repository-audit, database\]/);
 assert.match(read('.github/workflows/mysql-mariadb.yml'),/--prerelease/);
});

test('service worker cache version matches release manifest and PWA integration test',()=>{
 const version=JSON.parse(read('package.json')).version;
 const expected='sqf-public-v'+version;
 const sw=read('service-worker.js');
 const pwa=read('database/tests/pwa-integration.mjs');
 assert.ok(sw.includes("const CACHE='"+expected+"'"),'service worker cache is out of sync with package version');
 assert.equal((pwa.match(/sqf-public-v3[.]14[.]0-rc[.]15/g)||[]).length,2,'PWA test must use current cache key for install and offline verification');
});
