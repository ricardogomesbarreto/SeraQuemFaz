// Atualize a cópia versionada a partir da API oficial; uma resposta inválida não substitui os dados.
import { writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import '../assets/cities.js';
const api = globalThis.SQFCities;
const response = await fetch(api.ENDPOINT, {signal:AbortSignal.timeout(20000)});
if (!response.ok) throw new Error(`IBGE HTTP ${response.status}`);
const raw = await response.json();
const list = Array.isArray(raw) ? raw.map(api.toCity) : [];
if (!api.validateList(list) || new Set(list.map(c=>c.uf)).size !== 27) throw new Error('Cadastro incompleto ou inválido; arquivos preservados.');
list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR') || a.id.localeCompare(b.id));
const content = JSON.stringify(list);
const metadata = {schemaVersion:1,source:api.ENDPOINT,importedAt:new Date().toISOString(),count:list.length,sha256:createHash('sha256').update(content).digest('hex')};
await writeFile('assets/municipios-br.json.tmp',content);
await rename('assets/municipios-br.json.tmp','assets/municipios-br.json');
await writeFile('assets/municipios-br.meta.json',JSON.stringify(metadata,null,2)+'\n');
console.log(`${list.length} municípios validados nas 27 UFs.`);
