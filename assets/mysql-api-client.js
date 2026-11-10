'use strict';
/* Same-origin PHP API. Never transmit database credentials or SQL to this client. */
(function(scope){
  let csrf=null, sessionFlight=null;
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
  async function uploadMedia(kind,context,file,caption=''){
    if(!csrf)await session();
    const url=new URL(endpoint,scope.location.origin);url.searchParams.set('route','media/upload');
    const form=new FormData();form.append('kind',kind);form.append('context',context);form.append('caption',caption);form.append('file',file);
    const response=await fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-CSRF-Token':csrf,Accept:'application/json'},body:form});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Falha ao enviar arquivo');return result;
  }
  const mediaUrl=(kind,id)=>{const url=new URL(endpoint,scope.location.origin);url.searchParams.set('route','media/read');url.searchParams.set('kind',kind);url.searchParams.set('id',id);return url.pathname+url.search;};
  const session=()=>{
    if(!sessionFlight)sessionFlight=call('session').finally(()=>{sessionFlight=null;});
    return sessionFlight;
  };
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
    reviewCases:()=>call('review-cases',{}),
    reviewResponse:body=>call('review/response',body),
    reviewDispute:body=>call('review/dispute',body),
    staffReviewCases:()=>call('staff/review-cases',{}),
    staffReviewCaseDecide:body=>call('staff/review-case/decide',body),
    reviews:()=>call('reviews',{}),
    publicReviews:id=>call('reviews/public',undefined,{id}),
    createReview:body=>call('review/create',body),
    staffMfa:code=>call('staff/mfa',{code}),
    staffReviews:()=>call('staff/reviews',{}),
    staffReviewDecide:body=>call('staff/review/decide',body),
    categories:()=>call('categories'),
    category:(id,city)=>call('category',undefined,{id,city}),
    favoriteProviders:()=>call('favorites/providers',{}),
    favoriteProvider:body=>call('favorite/provider',body),
    recordView:provider_id=>call('profile/view',{provider_id}),
    performance:()=>call('performance',{}),
    compareQuotes:()=>call('quotes/compare',{}),
    favoriteCategories:()=>call('favorites/categories',{}),
    favoriteCategory:body=>call('favorite/category',body),
    billing:()=>call('billing',{}),
    checkout:cycle=>call('billing/checkout',{cycle}),
    cancelSubscription:()=>call('billing/cancel',{}),
    requestCycle:cycle=>call('billing/cycle',{cycle}),
    staffMetrics:()=>call('staff/metrics',{}),
    staffBilling:()=>call('staff/billing',{}),
    privacyExport:()=>call('account/export',{}),
    accountSecurity:()=>call('account/security',{}),
    changePassword:body=>call('account/password',body),
    revokeSessions:body=>call('account/revoke-sessions',body),
    notificationPreference:enabled=>call('notification/preference',{email_enabled:enabled}),
    readNotification:id=>call('notification/read',{id}),
    verification:()=>call('verification',{}),
    cases:()=>call('cases',{}),
    createCase:body=>call('case/create',body),
    staffProviders:()=>call('staff/providers',{}),
    staffProviderDecide:body=>call('staff/provider/decide',body),
    staffCases:()=>call('staff/cases',{}),
    staffCaseDecide:body=>call('staff/case/decide',body),
    staffDocuments:()=>call('staff/documents',{}),
    staffDocumentDecide:body=>call('staff/document/decide',body),
    mediaList:(kind,request_id)=>call('media/list',{kind,...(request_id?{request_id}:{})}),
    uploadMedia,
    mediaUrl,
    provider:id=>call('provider',undefined,{id}),
    professional:()=>call('professional',{}),
    saveProfessional:body=>call('professional/save',body),
    managePortfolio:body=>call('portfolio/manage',body),
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
