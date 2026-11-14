'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('admin login uses a high-quality version of the same lawyer portrait',()=>{
  const file=fs.readFileSync(path.join(root,'assets/images/admin-advogado.webp'));
  assert.ok(file.length>=30000,'Hero image below 30 KB: severe compression regression');
  assert.equal(file.toString('ascii',0,4),'RIFF','Expected RIFF WebP');
  assert.equal(file.toString('ascii',8,12),'WEBP','Expected WebP');
  assert.equal(file.toString('ascii',12,16),'VP8 ','Expected WebP lossy photo payload');
  const width=file.readUInt16LE(26)&0x3fff;
  const height=file.readUInt16LE(28)&0x3fff;
  assert.ok(width>=900&&height>=1100,'Hero image pixel resolution is too small');
  for(const page of ['admin.html','admin-mysql.html']){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    assert.match(html,/assets\/images\/admin-advogado\.webp\?v=20261113-hq/);
    assert.match(html,/class="sqf-admin-hero-photo"/);
    assert.match(html,/id="staffLoginForm"/);
    assert.match(html,/id="staffMfa"/);
  }
});
