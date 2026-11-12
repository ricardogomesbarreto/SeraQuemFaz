// Archives for manual hPanel deployment. Never upload this repository ZIP as a site backup.
import { readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const candidate=join(root,'dist/mysql-candidate');
const output=join(root,'dist/hostinger-upload');
const MAX32=0xffffffff;
const dosDate=(1<<5)|1; // 1980-01-01 UTC, deterministic archives.

async function listFiles(directory,prefix=''){
    const out=[];
    const entries=(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'));
    for(const entry of entries){
        if(entry.isSymbolicLink())throw new Error('Symlink not allowed in hosting package: '+entry.name);
        const name=prefix+entry.name;
        if(entry.isDirectory())out.push(...await listFiles(join(directory,entry.name),name+'/'));
        else if(entry.isFile())out.push({name,bytes:await readFile(join(directory,entry.name))});
        else throw new Error('Unsupported package entry: '+name);
    }
    return out;
}
function crc32(data){
    let crc=0xffffffff;
    for(const byte of data){
        crc^=byte;
        for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
    }
    return (crc^0xffffffff)>>>0;
}
function createZip(entries){
    if(entries.length>65535)throw new Error('ZIP entry limit exceeded');
    const local=[],central=[];let offset=0,centralLength=0;
    for(const {name,bytes} of entries){
        if(name.startsWith('/')||name.includes('\\')||name.split('/').includes('..'))throw new Error('Unsafe path: '+name);
        const filename=Buffer.from(name,'utf8'),data=deflateRawSync(bytes,{level:6});
        if(filename.length>65535||bytes.length>MAX32||data.length>MAX32||offset>MAX32)throw new Error('ZIP32 limits exceeded');
        const checksum=crc32(bytes);
        const l=Buffer.alloc(30);
        l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(20,4);l.writeUInt16LE(0x0800,6);
        l.writeUInt16LE(8,8);l.writeUInt16LE(0,10);l.writeUInt16LE(dosDate,12);
        l.writeUInt32LE(checksum,14);l.writeUInt32LE(data.length,18);l.writeUInt32LE(bytes.length,22);
        l.writeUInt16LE(filename.length,26);
        const c=Buffer.alloc(46);
        c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
        c.writeUInt16LE(0x0800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(0,12);
        c.writeUInt16LE(dosDate,14);c.writeUInt32LE(checksum,16);
        c.writeUInt32LE(data.length,20);c.writeUInt32LE(bytes.length,24);
        c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
        local.push(l,filename,data);central.push(c,filename);
        offset+=l.length+filename.length+data.length;
        centralLength+=c.length+filename.length;
    }
    if(offset+centralLength>MAX32)throw new Error('ZIP exceeds 4 GiB');
    const end=Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50,0);
    end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
    end.writeUInt32LE(centralLength,12);end.writeUInt32LE(offset,16);
    return Buffer.concat([...local,...central,end]);
}
await mkdir(output,{recursive:true});
const publicFiles=await listFiles(join(candidate,'public_html'));
const privateFiles=await listFiles(join(candidate,'sqf-private'));
if(!publicFiles.some(x=>x.name==='.htaccess')||!publicFiles.some(x=>x.name==='api/index.php')||!publicFiles.some(x=>x.name==='index.html'))
    throw new Error('Missing essential public site files');
if(!privateFiles.some(x=>x.name==='backend/src/Database.php')||!privateFiles.some(x=>x.name==='config.example.php'))
    throw new Error('Missing essential private backend files');
if(publicFiles.some(x=>/(^|\/)(?:config\.php|\.env(?:\..*)?|\.git|node_modules|tests|sqf-private)(\/|$)|\.(?:sql|bak|dump|sqlite|log|pem|key|p12|pfx)$/i.test(x.name)))
    throw new Error('Potential secret or database backup in public archive');
if(privateFiles.some(x=>/(^|\/)(?:config\.php|\.env(?:\..*)?)(\/|$)/i.test(x.name)))
    throw new Error('Live configuration must not be packaged');
const siteZip=createZip(publicFiles);
const privateZip=createZip(privateFiles.map(x=>({name:'sqf-private/'+x.name,bytes:x.bytes})));
const products={'site-public_html.zip':siteZip,'sqf-private.zip':privateZip};
for(const [file,bytes] of Object.entries(products))await writeFile(join(output,file),bytes);
for(const name of ['01-instalar-banco.sql','02-verificar-banco.sql'])
    await copyFile(join(candidate,'database',name),join(output,name));
const checksums=[];
for(const name of [...Object.keys(products),'01-instalar-banco.sql','02-verificar-banco.sql'])
    checksums.push(createHash('sha256').update(await readFile(join(output,name))).digest('hex')+'  '+name);
await writeFile(join(output,'SHA256SUMS'),checksums.join('\n')+'\n');
await writeFile(join(output,'LEIA-ME-HPANEL.txt'),[
 'SERÁ QUEM FAZ? — HOMOLOGAÇÃO EM HOSTINGER UNLIMITED',
 '',
 'Não use o assistente de migração de backups com um ZIP do repositório.',
 '1) Crie um site PHP/HTML em subdomínio de testes com HTTPS no hPanel.',
 '2) Em Arquivos > Gerenciador de Arquivos, localize o diretório do domínio.',
 '3) Extraia site-public_html.zip DENTRO de public_html, substituindo somente arquivos de staging revisados.',
 '4) Extraia sqf-private.zip no DIRETÓRIO PAI de public_html, nunca dentro da raiz pública.',
 '5) Crie sqf-private/config.php a partir de config.example.php, preenchendo os dados de staging no painel.',
 '6) Crie sqf-private/media (permissões privadas) para os uploads; não habilite checkout, notificações ou cron.',
 '7) Em um banco NOVO e VAZIO, importe 01-instalar-banco.sql via phpMyAdmin; execute 02-verificar-banco.sql.',
 '8) Verifique as somas SHA256, as extensões PHP, HTTPS, acesso à API, páginas e testes responsivos.',
 '9) O candidato NÃO está autorizado para produção antes de CI, reconciliação, segurança e rollback aprovados.',
 '',
 'A pasta sqf-private deve ser irmã de public_html, porque /api/index.php resolve o caminho a partir desse layout.',
 ''
].join('\n'));
console.log('Hostinger staging uploads: '+publicFiles.length+' public files, '+privateFiles.length+' private files. Archives: '+Object.keys(products).join(', '));
