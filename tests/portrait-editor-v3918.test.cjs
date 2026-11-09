'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const portrait=require('../assets/portrait.js');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('recorte 3:4 é o mesmo apresentado na prévia e permite deslocamento horizontal',()=>{
  const left=portrait.frameCrop(1200,600,{zoom:1,panX:0,panY:50});
  const right=portrait.frameCrop(1200,600,{zoom:1,panX:100,panY:50});
  assert.equal(portrait.FRAME_RATIO,3/4);
  assert.equal(left.sx,0);
  assert.equal(right.sx,1200-right.sw);
  assert.ok(right.sx>left.sx);
  assert.equal(left.sh,600);
  assert.ok(Math.abs(left.width/left.height-3/4)<.005);
});

test('ajuste vertical em foto alta, zoom e foto exatamente 3:4',()=>{
  const top=portrait.frameCrop(600,1200,{zoom:1,panY:0});
  const bottom=portrait.frameCrop(600,1200,{zoom:1,panY:100});
  assert.equal(top.sy,0);
  assert.ok(bottom.sy>top.sy);
  assert.equal(bottom.sy,1200-bottom.sh);
  const full=portrait.frameCrop(600,800,{zoom:1,panX:0,panY:100});
  assert.equal(full.sx,0);
  assert.equal(full.sy,0);
  const zoomed=portrait.frameCrop(600,800,{zoom:1.5,panX:100,panY:100});
  assert.ok(zoomed.sw<full.sw && zoomed.sh<full.sh);
  assert.ok(zoomed.sx>0 && zoomed.sy>0);
  for(const [w,h] of [[1,1],[16,60],[200,50]])assert.doesNotThrow(()=>portrait.frameCrop(w,h));
  assert.throws(()=>portrait.frameCrop(0,100));
  assert.throws(()=>portrait.frameCrop(600,800,{zoom:0}));
});

test('processamento realmente utiliza posição do slider no bitmap salvo',async()=>{
  const oldBitmap=global.createImageBitmap, oldDocument=global.document;
  const calls=[];
  global.createImageBitmap=async()=>({width:1200,height:600,close(){}});
  global.document={createElement(tag){
    assert.equal(tag,'canvas');
    return {
      width:0,height:0,
      getContext(){return {fillStyle:'',fillRect(){},drawImage(...args){calls.push(args.slice(1));}};},
      toBlob(callback,type){assert.equal(type,'image/webp');callback({type:'image/webp',size:256});}
    };
  }};
  try{
    const file={type:'image/jpeg',size:4000};
    await portrait.process(file,{zoom:1,panX:0,panY:50});
    await portrait.process(file,{zoom:1,panX:100,panY:50});
    assert.equal(calls.length,2);
    assert.ok(calls[1][0]>calls[0][0], 'o pan horizontal deve modificar o recorte enviado');
    await portrait.process(file,{zoom:1.5,panX:50,panY:50});
    assert.ok(calls[2][2]<calls[0][2], 'zoom deve mudar a área recortada');
  }finally{
    if(oldBitmap===undefined)delete global.createImageBitmap;else global.createImageBitmap=oldBitmap;
    if(oldDocument===undefined)delete global.document;else global.document=oldDocument;
  }
});

test('editor usa uma prévia e não bloqueia foto privada de cliente por declaração',()=>{
  const js=read('assets/account.js');
  const html=read('painel.html');
  const css=read('assets/site.css');
  assert.match(js,/showPreparedPortrait\(portraitPreviewUrl\)/);
  assert.match(js,/savedPreview\.hidden=Boolean\(url\)/);
  assert.match(js,/\$\('portraitDeclarationLabel'\)\.hidden=profile\?\.account_type!=='prestador'/);
  assert.match(js,/selectedAvatar && profile\.account_type==='prestador' && !\$\('portraitDeclaration'\)\.checked/);
  assert.doesNotMatch(js,/function schedulePortraitPreview\(\)[\s\S]*?clearTimeout\(portraitDebounce\);[\s\S]*?\$\('portraitDeclaration'\)\.checked=false/);
  assert.match(js,/await preparePortrait\(selectedAvatar\)/);
  assert.match(js,/discardPortraitSelection/);
  assert.match(html,/id="portraitDiscard"/);
  assert.match(html,/id="portraitZoomValue"/);
  assert.match(css,/\.portrait-candidate\[hidden\]/);
  assert.match(css,/\.portrait-confirm\[hidden\]/);
  assert.match(css,/\.avatar-preview\[hidden\]/);
});
