(()=>{'use strict';
// Customer sign-in is strictly separate from /admin. Public Supabase API key only.
// Uses PKCE, token refresh and secure server-side validation of user/order/ZIP.
const by=id=>document.getElementById(id);
const KEY='creative-tools-customer-session',PKCE='creative-tools-pkce-verifier',PENDING='creative-tools-pending-order';
let config=null,session=null;
function notify(msg){by('notice').textContent=msg||'';}
function store(s){session=s;try{s?sessionStorage.setItem(KEY,JSON.stringify(s)):sessionStorage.removeItem(KEY);}catch(_){notify('Seu navegador bloqueou o armazenamento da sessão.');}}
function restore(){try{const value=JSON.parse(sessionStorage.getItem(KEY)||'null');if(value?.access_token&&value?.refresh_token)return value;}catch(_){}return null;}
function validConfig(){return config?.enabled&&config?.auth?.url&&config?.auth?.anonKey;}
async function authRequest(endpoint,body){
 const a=config?.auth;if(!a)throw Error('Autenticação ainda indisponível.');
 const response=await fetch(a.url+'/auth/v1/'+endpoint,{method:'POST',cache:'no-store',headers:{apikey:a.anonKey,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.msg||data.error_description||data.message||'Não foi possível entrar. Tente novamente.');
 return data;
}
function saveTokens(data){if(!data?.access_token||!data?.refresh_token)throw Error('Sessão de login inválida.');store({...data,expires_at:Math.floor(Date.now()/1000)+Math.max(60,Number(data.expires_in||3600))});}
async function refresh(){
 if(!session?.refresh_token)return false;
 try{saveTokens(await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token}));return true;}
 catch(_){store(null);return false;}
}
async function activeSession(){
 if(!session?.access_token)return false;
 if((session.expires_at||0)-Math.floor(Date.now()/1000)<120)return refresh();
 return true;
}
async function protectedFetch(url,options={}){
 if(!await activeSession())throw Error('Sua sessão expirou. Entre novamente.');
 const headers={...options.headers,Authorization:'Bearer '+session.access_token};
 const r=await fetch(url,{...options,headers,cache:'no-store',credentials:'same-origin'});
 if(r.status===401){store(null);renderUser(null);throw Error('Sessão expirada. Entre novamente.');}
 return r;
}
function b64url(bytes){let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function verifierChallenge(){const bytes=new Uint8Array(48);crypto.getRandomValues(bytes);const v=b64url(bytes),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));try{localStorage.setItem(PKCE,JSON.stringify({verifier:v,expiresAt:Date.now()+60*60*1000}));}catch(_){throw Error('Ative o armazenamento temporário do navegador para fazer login.');}return b64url(new Uint8Array(digest));}
async function startOAuth(provider){
 if(!validConfig())return notify('A integração de contas ainda não está disponível.');
 try{
  notify('Abrindo '+(provider==='google'?'Google':'Discord')+'…');
  const challenge=await verifierChallenge();
  const u=new URL(config.auth.url+'/auth/v1/authorize');
  u.searchParams.set('provider',provider);
  u.searchParams.set('redirect_to',location.origin+'/conta.html');
  u.searchParams.set('code_challenge',challenge);
  u.searchParams.set('code_challenge_method','s256');
  location.assign(u.href);
 }catch(e){notify(e.message);}
}
async function emailLink(e){
 e.preventDefault();if(!validConfig())return;
 const email=by('email').value.trim();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254)return notify('Informe um e-mail válido.');
 const button=by('mail-form').querySelector('button');button.disabled=true;
 try{
  const challenge=await verifierChallenge();
  const url=encodeURIComponent(location.origin+'/conta.html');
  await authRequest('otp?redirect_to='+url,{email,create_user:true,code_challenge:challenge,code_challenge_method:'s256'});
  notify('Verifique seu e-mail para receber o link de acesso. Confira também a pasta de spam.');
 }catch(err){notify(err.message);}
 finally{button.disabled=false;}
}
async function acceptCallback(){
 const params=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
 const order=params.get('session_id');
 if(order&&/^cs_test_[A-Za-z0-9_]{15,200}$/.test(order))try{sessionStorage.setItem(PENDING,order);}catch(_){}
 if(params.has('pagamento'))notify('Pagamento cancelado. Nenhuma compra foi cobrada.');
 const code=params.get('code');
 if(code){
  if(!/^[a-zA-Z0-9_-]{15,512}$/.test(code))return notify('Código de autenticação inválido.');
  let verifier;try{const pending=JSON.parse(localStorage.getItem(PKCE)||'null');if(pending?.expiresAt>Date.now()&&/^[A-Za-z0-9_-]{64}$/.test(pending.verifier))verifier=pending.verifier;else localStorage.removeItem(PKCE);}catch(_){}
  if(!verifier)return notify('Link expirado ou aberto em outro navegador. Faça login novamente.');
  try{
   notify('Confirmando seu login…');
   saveTokens(await authRequest('token?grant_type=pkce',{auth_code:code,code_verifier:verifier}));
   localStorage.removeItem(PKCE);
   params.delete('code');params.delete('sb_flow_id');history.replaceState({},'',location.pathname+(params.toString()?'?'+params:''));
  }catch(err){notify(err.message);}
 }else if(hash.has('access_token')||hash.has('refresh_token')){
  history.replaceState({},'',location.pathname+location.search);
  notify('Este link utiliza um formato antigo. Solicite um novo link de acesso.');
 }
}
function renderUser(user){
 by('guest').hidden=!!user;by('member').hidden=!user;
 by('no-access').hidden=!!user;by('library').hidden=!user;
 if(user){by('member-name').textContent=user.user_metadata?.full_name||'Conta conectada';by('member-email').textContent=user.email||'';}
}
async function whoami(){
 if(!await activeSession())return null;
 try{
  const r=await fetch(config.auth.url+'/auth/v1/user',{cache:'no-store',headers:{apikey:config.auth.anonKey,Authorization:'Bearer '+session.access_token}});
  if(!r.ok)throw Error('Sua sessão expirou.');
  const user=await r.json();
  if(!user.id||!user.email_confirmed_at)throw Error('Confirme seu e-mail para continuar.');
  return user;
 }catch(_){store(null);return null;}
}
async function claimPending(){
 let id;try{id=sessionStorage.getItem(PENDING);}catch(_){}
 if(!id)return;
 notify('Verificando compra e disponibilizando seu produto…');
 try{
  const r=await protectedFetch('/api/customer/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:id})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Pagamento ainda não confirmado.');
  sessionStorage.removeItem(PENDING);
  const u=new URL(location.href);u.searchParams.delete('session_id');history.replaceState({},'',u.pathname+u.search);
  notify('Pagamento confirmado. Creative Tools liberado na sua biblioteca.');
 }catch(e){notify(e.message+' Se você concluiu a compra, entre novamente para verificar.');}
}
async function download(id,btn){
 btn.disabled=true;btn.textContent='Validando pagamento e arquivo…';
 try{
  const r=await protectedFetch('/api/customer/download?session_id='+encodeURIComponent(id));
  if(!r.ok){const p=await r.json().catch(()=>({}));throw Error(p.error||'Não foi possível baixar.');}
  const blob=await r.blob();if(blob.type!=='application/zip'||!blob.size)throw Error('Arquivo inválido.');
  const blobUrl=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=blobUrl;a.download='Creative_Tools_v1.4.16.zip';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(blobUrl),10000);
  notify('Download iniciado. Obrigado por adquirir o Creative Tools.');
 }catch(e){notify(e.message);}finally{btn.disabled=false;btn.textContent='Baixar Creative Tools ↗';}
}
async function library(){
 const panel=by('library');panel.replaceChildren();
 try{
  const r=await protectedFetch('/api/customer/library');const data=await r.json();
  if(!r.ok)throw Error(data.error||'Biblioteca temporariamente indisponível.');
  const purchases=data.products||[];
  if(!purchases.length){const p=document.createElement('p');p.className='empty';p.textContent='Nenhuma compra associada à sua conta. Quando você comprar, seu produto aparecerá aqui.';panel.appendChild(p);return;}
  for(const order of purchases){
   if(order.productId!=='creative-tools')continue;
   const card=document.createElement('div');card.className='purchase-item';
   const row=document.createElement('div');row.className='item-head';
   const icon=document.createElement('span');icon.className='item-logo';icon.textContent='CT';
   const info=document.createElement('div'),name=document.createElement('b'),sub=document.createElement('small');
   name.textContent='Creative Tools';sub.textContent='After Effects 2026 · Windows · '+(order.status==='active'?'Adquirido':'Acesso suspenso');
   info.append(name,sub);row.append(icon,info);card.appendChild(row);
   const b=document.createElement('button');b.type='button';b.className='primary download-btn';b.textContent=order.canDownload?'Baixar Creative Tools ↗':'Download indisponível';b.disabled=!order.canDownload;
   if(order.canDownload)b.addEventListener('click',()=>download(order.id,b));
   card.appendChild(b);panel.appendChild(card);
  }
 }catch(e){const p=document.createElement('p');p.textContent=e.message;panel.appendChild(p);}
}
async function startCheckout(){
 const btn=by('test-buy');btn.disabled=true;btn.textContent='Abrindo Stripe Test…';
 try{
  const r=await protectedFetch('/api/customer/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Checkout não está pronto.');
  const u=new URL(data.url);
  if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com')throw Error('Destino de pagamento inválido.');
  location.assign(u.href);
 }catch(e){notify(e.message);btn.disabled=false;btn.textContent='Simular compra ↗';}
}
async function signOut(){
 try{if(session?.access_token)await fetch(config.auth.url+'/auth/v1/logout',{method:'POST',headers:{apikey:config.auth.anonKey,Authorization:'Bearer '+session.access_token}});}catch(_){}
 store(null);renderUser(null);by('test-buy').disabled=true;by('test-buy').textContent='Entre para testar a compra';
 notify('Você saiu da conta.');
}
async function boot(){
 by('google').addEventListener('click',()=>startOAuth('google'));
 by('discord').addEventListener('click',()=>startOAuth('discord'));
 by('mail-form').addEventListener('submit',emailLink);
 by('test-buy').addEventListener('click',startCheckout);
 by('logout').addEventListener('click',signOut);
 try{
  const r=await fetch('/api/customer/settings',{cache:'no-store'});if(!r.ok)throw Error('Configuração indisponível.');
  config=await r.json();by('account-price').textContent=config.product?.priceLabel||'Preço a confirmar';
  const oauth=config.providers||[];
  by('google').hidden=!oauth.includes('google');
  by('discord').hidden=!oauth.includes('discord');
  by('social-login').hidden=!oauth.includes('google')&&!oauth.includes('discord');
  const separator=document.querySelector('.divider');if(separator)separator.hidden=by('social-login').hidden;
  if(!validConfig()){by('availability').textContent='O acesso de clientes está sendo preparado. O cadastro ainda não está disponível.';by('buy-status').textContent='Aguardando a configuração segura do sistema de contas, dos pagamentos de teste e da entrega digital.';return;}
  by('availability').textContent='Entre com '+[...(oauth.includes('google')?['Google']:[]),...(oauth.includes('discord')?['Discord']:[]),'e-mail'].join(', ')+'.';
  session=restore();await acceptCallback();
  const user=await whoami();renderUser(user);
  if(user){
   if(config.libraryEnabled){await claimPending();await library();}
   else{const panel=by('library');panel.replaceChildren();const note=document.createElement('p');note.className='empty';note.textContent='Conta de teste conectada. A biblioteca de compras será habilitada após a configuração segura do servidor.';panel.appendChild(note);}
  }
  by('test-buy').disabled=!user||!config.testCheckoutEnabled;
  by('test-buy').textContent=config.testCheckoutEnabled?(user?'Simular compra ↗':'Entre para testar a compra'):'Pagamento de teste indisponível';
  by('buy-status').textContent=config.testCheckoutEnabled?'Ambiente de testes Stripe: nenhuma cobrança real será realizada.':'Checkout aguardando configuração de teste e arquivo privado.';
 }catch(err){by('availability').textContent='Área de clientes temporariamente indisponível.';notify('Não foi possível iniciar as contas. Nenhuma cobrança foi habilitada.');}
}
boot();
})();
