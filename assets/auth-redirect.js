'use strict';
// Avoid issuing links that point to localhost on a different device.
(function(scope){
  const localHosts=new Set(['localhost','127.0.0.1','[::1]','0.0.0.0']);
  function safeOrigin(candidate){
    if(typeof candidate!=='string'||!candidate.trim())return null;
    try{
      const parsed=new URL(candidate);
      if(parsed.protocol!=='https:'||localHosts.has(parsed.hostname.toLowerCase()))return null;
      if(parsed.username||parsed.password||parsed.search||parsed.hash)return null;
      return parsed.origin;
    }catch{return null;}
  }
  function publicRedirect(page='entrar.html'){
    const current=safeOrigin(scope.location?.origin);
    const origin=current;
    if(!origin)return null;
    const path=String(page||'entrar.html');
    if(!/^(entrar\.html)(\?recuperar=1)?$/.test(path))return null;
    return new URL(path,`${origin}/`).href;
  }
  scope.SQFAuthRedirect=Object.freeze({publicRedirect,safeOrigin});
})(typeof window==='undefined'?globalThis:window);
