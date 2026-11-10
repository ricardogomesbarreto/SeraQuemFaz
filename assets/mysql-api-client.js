'use strict';
/* Candidate client. Existing Supabase pages remain unchanged until their full
   contracts are ported. Never transmit credentials or SQL to this client. */
(function(scope){
  let csrf=null;
  const endpoint='/api/index.php';
  async function call(route,body,query={}){
    const url=new URL(endpoint,scope.location.origin);
    url.searchParams.set('route',route);
    for(const [k,v] of Object.entries(query))url.searchParams.set(k,String(v));
    const options={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
    if(body!==undefined){
      if(!csrf)await session();
      options.method='POST';
      options.headers['Content-Type']='application/json';
      options.headers['X-CSRF-Token']=csrf;
      options.body=JSON.stringify(body);
    }
    const response=await fetch(url,options);
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Operação indisponível');
    if(typeof data.csrf==='string')csrf=data.csrf;
    return data;
  }
  const session=()=>call('session');
  scope.SQFMySQL=Object.freeze({
    session,
    login:(email,password)=>call('login',{email,password}),
    register:(email,password,name,account_type,city_ibge)=>call('register',{email,password,name,account_type,city_ibge}),
    profile:()=>call('profile',{}),
    updateProfile:body=>call('profile/update',body),
    requests:()=>call('requests',{}),
    appointments:()=>call('appointments',{}),
    notifications:()=>call('notifications',{}),
    verify:token=>call('verify',{token}),
    resendVerification:email=>call('resend-verification',{email}),
    requestReset:email=>call('request-reset',{email}),
    reset:(token,password)=>call('reset',{token,password}),
    logout:async()=>{try{return await call('logout',{});}finally{csrf=null;}},
    reviews:()=>call('reviews',{}),
    publicReviews:id=>call('reviews/public',undefined,{id}),
    createReview:body=>call('review/create',body),
    staffMfa:code=>call('staff/mfa',{code}),
    staffReviews:()=>call('staff/reviews',{}),
    staffReviewDecide:body=>call('staff/review/decide',body),
    categories:()=>call('categories'),
    provider:id=>call('provider',undefined,{id}),
    services:()=>call('services',{}),
    saveService:body=>call('service/save',body),
    toggleService:body=>call('service/toggle',body),
    catalog:city=>call('catalog',undefined,{city}),
    createRequest:body=>call('request/create',body),
    quote:body=>call('request/quote',body),
    requestAction:body=>call('request/action',body),
    messages:request_id=>call('request/messages',{request_id}),
    sendMessage:body=>call('request/message',body),
    appointment:body=>call('appointment/action',body)
  });
})(window);
