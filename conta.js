/* GUSTAVO® · Minha conta
 * Login por link mágico do Supabase Auth (REST, sem SDK). Só a chave pública "anon" chega aqui;
 * compras, licenças e downloads são decididos no servidor (/api/conta/*, /api/creative-hub/download).
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const STORE_KEY='gustavo.conta.session.v1';
const views=['view-loading','view-off','view-login','view-library'];
let cfg=null,session=null;

function show(id){for(const v of views)$(v).hidden=v!==id;$('logout').hidden=id!=='view-library';}
function setStatus(el,text,kind){el.textContent=text||'';el.classList.toggle('error',kind==='error');el.classList.toggle('ok',kind==='ok');}
function readStored(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'null');}catch(_){return null;}}
function store(s){session=s;try{s?localStorage.setItem(STORE_KEY,JSON.stringify(s)):localStorage.removeItem(STORE_KEY);}catch(_){}}

function sessionFrom(data){
  if(!data||typeof data.access_token!=='string'||typeof data.refresh_token!=='string')return null;
  const expiresIn=Number(data.expires_in)||3600;
  return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Number(data.expires_at)||Math.floor(Date.now()/1000)+expiresIn};
}
// Volta do link mágico: #access_token=...&refresh_token=...  ou  #error_description=...
function consumeRedirect(){
  if(!location.hash||location.hash.length<2)return null;
  const p=new URLSearchParams(location.hash.slice(1));
  const clean=()=>history.replaceState(null,'',location.pathname+location.search);
  if(p.get('error')||p.get('error_description')){clean();return {error:p.get('error_code')==='otp_expired'?'Este link expirou ou já foi usado. Peça um novo abaixo.':'Não foi possível validar o link. Peça um novo abaixo.'};}
  const s=sessionFrom({access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_in:p.get('expires_in'),expires_at:p.get('expires_at')});
  if(s)clean();
  return s?{session:s}:null;
}
async function auth(path,body,token){
  const r=await fetch(cfg.auth.url+'/auth/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.auth.anonKey,Authorization:'Bearer '+(token||cfg.auth.anonKey)},body:JSON.stringify(body||{})});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch(_){}
  if(!r.ok){const e=new Error((data&&(data.msg||data.error_description||data.message))||'Falha '+r.status);e.status=r.status;throw e;}
  return data;
}
async function token(){
  if(!session)return null;
  if(session.expires_at-60>Date.now()/1000)return session.access_token;
  try{const s=sessionFrom(await auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token}));store(s);return s&&s.access_token;}
  catch(_){store(null);return null;}
}
async function api(path,options={}){
  const t=await token();
  if(!t){const e=new Error('Sessão expirada');e.status=401;throw e;}
  const r=await fetch(path,{...options,cache:'no-store',credentials:'same-origin',headers:{...(options.headers||{}),Authorization:'Bearer '+t}});
  let data=null;try{data=await r.json();}catch(_){}
  if(!r.ok){const e=new Error((data&&data.error)||'Falha '+r.status);e.status=r.status;throw e;}
  return data;
}
function payloadEmail(t){try{return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).email||'';}catch(_){return '';}}

/* ---------- Login ---------- */
async function sendLink(e){
  e.preventDefault();
  const email=$('email').value.trim().toLowerCase(),btn=$('login-submit'),st=$('login-status');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setStatus(st,'Digite um e-mail válido.','error');$('email').focus();return;}
  btn.disabled=true;setStatus(st,'Enviando…');
  try{
    await auth('otp?redirect_to='+encodeURIComponent(location.origin+'/conta'),{email,create_user:true});
    setStatus(st,'Pronto! Abra o link que enviamos para '+email+'. Confira também o spam.','ok');
  }catch(err){
    setStatus(st,err.status===429?'Muitas tentativas. Aguarde alguns minutos e tente de novo.':'Não foi possível enviar o link agora. Tente novamente.','error');
  }finally{btn.disabled=false;}
}

/* ---------- Biblioteca ---------- */
const STATUS={paid:['ATIVA','on'],refunded:['REEMBOLSADA','off'],chargedback:['CONTESTADA','off']};
const fmtDate=d=>{try{return new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});}catch(_){return '';}};

async function loadLibrary(){
  show('view-library');
  const st=$('library-status'),list=$('purchases');
  setStatus(st,'Carregando seus produtos…');$('empty').hidden=true;
  try{
    const data=await api('/api/conta/biblioteca');
    $('who').textContent='Conectado como '+data.email;
    list.replaceChildren(...data.purchases.map(renderPurchase));
    $('empty').hidden=data.purchases.length>0;
    setStatus(st,'');
  }catch(err){
    if(err.status===401){store(null);return showLogin('Sua sessão expirou. Entre novamente.');}
    setStatus(st,err.message||'Não foi possível carregar seus produtos.','error');
  }
}
function renderPurchase(p){
  const node=$('tpl-purchase').content.firstElementChild.cloneNode(true),q=s=>node.querySelector('['+s+']');
  q('data-name').textContent=p.name;
  q('data-date').textContent='Compra em '+fmtDate(p.purchasedAt);
  const [label,cls]=STATUS[p.status]||['—',''];
  const pill=q('data-status');pill.textContent=label;if(cls)pill.classList.add(cls);
  if(!p.active){
    q('data-active').hidden=true;
    const n=q('data-inactive');n.hidden=false;
    n.textContent='Esta compra foi '+(p.status==='refunded'?'reembolsada':'contestada')+'. O download e a chave de licença foram desativados.';
    return node;
  }
  const line=q('data-status-line');
  setHint(q('data-hint'),p.license);
  q('data-license').textContent=p.license?'Gerar nova chave':'Gerar chave';
  q('data-license').addEventListener('click',()=>generateKey(node,line));
  q('data-copy').addEventListener('click',()=>copyKey(node,line));
  const dl=q('data-download');
  if(!p.canDownload){dl.disabled=true;dl.textContent='Download em breve';q('data-download-note').textContent='O instalador será liberado aqui assim que a distribuição for ativada.';}
  else dl.addEventListener('click',()=>download(node,line));
  return node;
}
function setHint(el,lic){el.textContent=lic?'•••• '+lic.hint:'Nenhuma chave ativa';}

async function generateKey(node,line){
  const btn=node.querySelector('[data-license]'),hadKey=btn.textContent.includes('nova');
  if(hadKey&&!confirmInline(btn))return;
  btn.disabled=true;setStatus(line,'Gerando chave…');
  try{
    const data=await api('/api/conta/licenca',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    node.querySelector('[data-key-value]').textContent=data.key;
    node.querySelector('[data-key]').hidden=false;
    node.querySelector('[data-key-warn]').hidden=false;
    setHint(node.querySelector('[data-hint]'),{hint:data.hint});
    btn.textContent='Gerar nova chave';
    setStatus(line,hadKey?'Nova chave criada. A anterior foi desativada.':'Chave criada.','ok');
  }catch(err){setStatus(line,err.message,'error');}
  finally{btn.disabled=false;delete btn.dataset.confirm;}
}
// Confirmação em dois cliques no próprio botão (sem caixa de diálogo).
function confirmInline(btn){
  if(btn.dataset.confirm==='1')return true;
  btn.dataset.confirm='1';const old=btn.textContent;btn.textContent='Clique de novo para confirmar';
  setTimeout(()=>{if(btn.dataset.confirm==='1'){delete btn.dataset.confirm;btn.textContent=old;}},4000);
  return false;
}
async function copyKey(node,line){
  const value=node.querySelector('[data-key-value]').textContent;
  try{await navigator.clipboard.writeText(value);setStatus(line,'Chave copiada.','ok');}
  catch(_){const r=document.createRange();r.selectNodeContents(node.querySelector('[data-key-value]'));const s=getSelection();s.removeAllRanges();s.addRange(r);setStatus(line,'Selecionei a chave: use Ctrl+C.');}
}

/* ---------- Download em partes (limite de resposta das Functions) ---------- */
async function download(node,line){
  const btn=node.querySelector('[data-download]'),bar=node.querySelector('[data-progress]'),fill=bar.firstElementChild;
  btn.disabled=true;bar.hidden=false;fill.style.width='0%';setStatus(line,'Preparando download…');
  try{
    const feed=await (await fetch('/updates/creative-tools/hub-manifest.json',{cache:'no-store'})).json();
    const rel=(feed.releases||[]).find(r=>r.version===feed.latest&&r.status==='published');
    if(!rel||!rel.downloadUrl||!Number.isSafeInteger(rel.size))throw new Error('Nenhuma versão publicada no momento.');
    node.querySelector('[data-version]').textContent='v'+rel.version;
    const chunk=rel.rangeChunkSize||3145728,parts=[];let got=0;
    while(got<rel.size){
      const t=await token();if(!t){const e=new Error('Sessão expirada');e.status=401;throw e;}
      const end=Math.min(got+chunk,rel.size)-1;
      const r=await fetch(rel.downloadUrl,{cache:'no-store',headers:{Authorization:'Bearer '+t,Range:'bytes='+got+'-'+end}});
      if(r.status!==206){let msg='Download indisponível agora.';try{msg=(await r.json()).error||msg;}catch(_){}const e=new Error(msg);e.status=r.status;throw e;}
      const buf=await r.arrayBuffer();if(!buf.byteLength)throw new Error('Resposta vazia.');
      parts.push(buf);got+=buf.byteLength;
      fill.style.width=Math.round(got/rel.size*100)+'%';
      setStatus(line,'Baixando… '+(got/1048576).toFixed(1)+' de '+(rel.size/1048576).toFixed(1)+' MB');
    }
    const blob=new Blob(parts,{type:'application/octet-stream'});
    if(rel.sha256&&crypto.subtle){
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==rel.sha256)throw new Error('O arquivo não passou na verificação de integridade. Tente novamente.');
    }
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=rel.fileName||'Creative_Tools_Setup.exe';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
    setStatus(line,'Download concluído e verificado. Execute o instalador no Windows.','ok');
  }catch(err){
    if(err.status===401&&!session){return showLogin('Sua sessão expirou. Entre novamente.');}
    setStatus(line,err.message||'Falha no download.','error');
  }finally{btn.disabled=false;setTimeout(()=>{bar.hidden=true;},1200);}
}

/* ---------- Fluxo ---------- */
function showLogin(message,kind){
  show('view-login');
  const hinted=session&&payloadEmail(session.access_token);
  if(hinted)$('email').value=hinted;
  setStatus($('login-status'),message||'',kind||(message?'error':''));
}
async function logout(){
  const t=session&&session.access_token;store(null);
  if(t)auth('logout',{},t).catch(()=>{});
  showLogin('Você saiu da sua conta.','ok');
}
async function start(){
  $('login-form').addEventListener('submit',sendLink);
  $('logout').addEventListener('click',logout);
  $('retry').addEventListener('click',loadLibrary);
  try{
    const r=await fetch('/api/conta/config',{cache:'no-store'});
    cfg=r.ok?await r.json():null;
  }catch(_){cfg=null;}
  if(!cfg||!cfg.enabled||!cfg.auth)return show('view-off');
  const back=consumeRedirect();
  if(back&&back.session)store(back.session);else session=readStored();
  if(back&&back.error){store(null);return showLogin(back.error);}
  if(!session)return showLogin();
  if(!cfg.libraryReady){show('view-library');setStatus($('library-status'),'Sua conta está ativa, mas a biblioteca ainda está em configuração.');return;}
  return loadLibrary();
}
start();
})();
