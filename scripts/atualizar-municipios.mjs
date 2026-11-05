// Execute no ambiente de desenvolvimento com Internet: node scripts/atualizar-municipios.mjs
// Gera um snapshot local opcional para melhorar disponibilidade e desempenho.
import { writeFile, mkdir } from 'node:fs/promises';
const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome';
const response = await fetch(url);
if (!response.ok) throw new Error(`IBGE HTTP ${response.status}`);
const raw = await response.json();
const list = raw.map(r => ({
 id: String(r.id), name: String(r.nome),
 uf: r.microrregiao?.mesorregiao?.UF?.sigla ?? r['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
})).filter(c => /^\d{7}$/.test(c.id) && /^[A-Z]{2}$/.test(c.uf) && c.name);
if (list.length < 5500) throw new Error(`Lista incompleta: ${list.length} municípios`);
await mkdir('assets',{recursive:true});
await writeFile('assets/municipios-br.json',JSON.stringify(list));
console.log(`${list.length} municípios salvos em assets/municipios-br.json`);
