'use strict';
/* Imagens de solicitações não são públicas. A confirmação de acesso ocorre por RLS no storage. */
(function (scope) {
  const BUCKET='sqf-request-attachments';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const MAX_FILES=3;
  const MAX_INPUT=5*1024*1024;
  const MAX_OUTPUT=2*1024*1024;
  const accept=['image/jpeg','image/png','image/webp'];
  async function encode(file) {
    if(!file || !accept.includes(file.type) || file.size<=0 || file.size>MAX_INPUT)
      throw new Error('Use JPG, PNG ou WebP com até 5 MB por imagem.');
    const bitmap=await createImageBitmap(file);
    try {
      if(bitmap.width<64 || bitmap.height<64 || bitmap.width>8192 || bitmap.height>8192)
        throw new Error('Dimensões da foto fora dos limites.');
      for(const width of [1600,1200,900]){
        const factor=Math.min(1,width/Math.max(bitmap.width,bitmap.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível processar a foto.');
        ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.78));
        if(blob?.type==='image/webp' && blob.size<=MAX_OUTPUT)return blob;
      }
      throw new Error('Não foi possível reduzir a foto para 2 MB.');
    }finally{bitmap.close();}
  }
  async function upload(client,requestId,userId,files){
    const list=Array.from(files||[]);
    if(list.length>MAX_FILES)throw new Error('São permitidas no máximo três fotos por envio.');
    if(!UUID.test(requestId)||!UUID.test(userId))throw new Error('Identificador de solicitação inválido.');
    const done=[];
    for(const file of list){
      const blob=await encode(file);
      const mediaId=crypto.randomUUID();
      const storagePath=`${requestId}/${userId}/${mediaId}.webp`;
      const storage=client.storage.from(BUCKET);
      const result=await storage.upload(storagePath,blob,{contentType:'image/webp',upsert:false,cacheControl:'0'});
      if(result.error)throw new Error('Falha ao enviar uma das imagens privadas. A solicitação foi preservada.');
      const row=await client.from('sqf_request_attachments').insert({id:mediaId,request_id:requestId,uploaded_by:userId,storage_path:storagePath});
      if(row.error){
        // A migração 10 permite apagar somente um anexo próprio NÃO registrado.
        try{await storage.remove([storagePath]);}catch{/* Limpeza best-effort; operação principal não é reprocessada. */}
        throw new Error('Não foi possível registrar uma foto. A solicitação continua disponível; reabra e confira os anexos.');
      }
      done.push(mediaId);
    }
    return done.length;
  }
  async function signed(client, path){
    if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(path||''))return null;
    const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,120);
    if(error||!data?.signedUrl)return null;
    const candidate=new URL(data.signedUrl,scope.SQFSupabase.url);
    if(candidate.protocol!=='https:'||candidate.host!==new URL(scope.SQFSupabase.url).host)return null;
    return candidate.href;
  }
  scope.SQFRequestMedia=Object.freeze({encode,upload,signed,MAX_FILES});
})(window);
