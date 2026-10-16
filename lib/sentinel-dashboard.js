'use strict';
const HTML=String.raw`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#090911"><title>Sentinel | Gustavo</title>
<style>
:root{color-scheme:dark;--bg:#090911;--surface:#151320;--line:#342b48;--text:#eee9f9;--muted:#aaa0ba;--accent:#c6b0ff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 70% 0%,#60419336,transparent 55%),var(--bg);color:var(--text);font:14px/1.55 system-ui,sans-serif}
main{max-width:1100px;padding:28px 20px 70px;margin:auto}a{color:var(--accent)}header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);padding-bottom:22px}
.brand{font-size:12px;font-weight:850;letter-spacing:.18em}.brand strong{color:var(--accent)}h1{font-size:clamp(36px,5vw,62px);letter-spacing:-.075em;line-height:1.06;margin:29px 0 12px}p{color:var(--muted)}.intro{max-width:650px;margin:0 0 28px}
.layout{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}.card{background:linear-gradient(155deg,#191523,#100e18);border:1px solid var(--line);border-radius:15px;padding:22px;min-width:0}
.card h2{font-size:17px;margin:0 0 13px}.muted{font-size:12px;color:var(--muted)}.pill{font-size:10px;border:1px solid #6e578f;color:#ddd0ff;border-radius:99px;padding:6px 11px}
button{padding:10px 15px;color:#191125;background:#c6b0ff;border:1px solid #c6b0ff;border-radius:8px;font:700 12px system-ui;cursor:pointer}button:disabled{opacity:.5}
.check{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #30293a;font-size:12px}.check b{font-size:11px;font-weight:700}.check:last-child{border:0}
.ok{color:#abedc8}.bad{color:#ffb2ae}.pending{color:#b9aacc}
.stat{font-size:36px;font-weight:800;letter-spacing:-.07em;color:var(--accent);line-height:1}
.info{border-left:2px solid var(--accent);padding:4px 0 4px 14px;color:#c6b7d5;font-size:12px}
small{font-size:11px;color:var(--muted)}.history{margin-top:20px}.incident{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line);font-size:12px}.incident span{color:var(--muted)}
@media(max-width:720px){.layout{grid-template-columns:1fr}.card{padding:18px}header{flex-wrap:wrap}}
</style></head><body><main>
<header><div class="brand">GUSTAVO<strong>® SENTINEL</strong> / PRIVATE OPS</div><a href="/gerenciar-projetos.html">← Painel de vídeos</a></header>
<div class="pill" style="display:inline-block;margin-top:28px">Monitoramento de integridade · V1</div>
<h1>Saúde do<br>portfólio.</h1><p class="intro">Verificações ao vivo dos recursos públicos e agregados anônimos de incidentes, quando a coleta estiver configurada. Nenhuma informação de formulários é capturada.</p>
<div class="layout">
<section class="card"><h2>Diagnóstico imediato</h2><p class="muted">Cada verificação lê um recurso real do site. Atualize depois de publicar alterações.</p><button id="run" type="button">Verificar agora ↗</button><div id="checks" role="status" aria-live="polite" style="margin-top:13px"></div></section>
<section class="card"><h2>Eventos de visitantes</h2><div class="stat" id="count">—</div><p class="muted" id="telemetry">Consultando a coleta...</p><div id="events" class="history"></div><p class="info">Coleta limitada por Redis, sem endereço IP, dados de contato, textos digitados ou URL completa. Erros de produção não autorizam mudanças automáticas de código.</p></section>
</div>
<div class="card" style="margin-top:17px"><h2>Recuperação e alertas</h2>
<p class="muted">As capas já tentam origens alternativas e exibem uma arte de segurança. O G / PLAYER oferece controle de qualidade. Uma rotina do GitHub verifica o site periodicamente e registra incidentes quando encontra indisponibilidade persistente.</p>
<p class="muted">Correções de código precisam passar pelos testes e por uma implantação de prévia. A IA não publica alterações sozinha a partir de um relato anônimo.</p>
<a href="https://github.com/gustavoeditor/portfolio-gustavo/actions" target="_blank" rel="noopener noreferrer">Histórico dos testes automáticos ↗</a>
</div>
<p class="muted" style="margin-top:28px">Área restrita a usuários autenticados no painel. Para acessar novamente, use /admin.</p>
</main>
<script>
(()=>{
'use strict';
const checks=document.getElementById('checks'),btn=document.getElementById('run');
const targets=[['Página inicial','/','html'],['Sitemap','/sitemap.xml','xml'],['Robots','/robots.txt','robots'],['G / PLAYER','/player.js?v=4','player'],['G / AMBIENCE','/ambience.js?v=2','audio'],['Formulário','/quote-modal.js?v=1','form'],['Galeria','/api/managed-projects','json']];
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function scan(){
 btn.disabled=true;checks.textContent='Executando testes...';
 const result=await Promise.all(targets.map(async([name,url,type])=>{
  try {
   const r=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(9000)});
   if(!r.ok)return{name,ok:false,status:String(r.status)};
   const t=await r.text();
   const ok=type==='html'?t.includes('GUSTAVO'):type==='xml'?t.includes('<urlset'):type==='robots'?t.includes('Sitemap:'):type==='player'?t.includes('GustavoPlayer'):type==='audio'?t.includes('GustavoAmbience'):type==='form'?t.includes('quote'):type==='json'?t.includes('projects'):true;
   return{name,ok,status:ok?'Resposta válida':'Conteúdo inesperado'};
  }catch(_){return{name,ok:false,status:'Sem resposta'};}
 }));
 checks.innerHTML=result.map(r=>'<div class="check"><span>'+escape(r.name)+'</span><b class="'+(r.ok?'ok':'bad')+'">'+(r.ok?'OK':'FALHA')+' · '+escape(r.status)+'</b></div>').join('');
 btn.disabled=false;
}
async function load(){
 const label=document.getElementById('telemetry'),count=document.getElementById('count'),events=document.getElementById('events');
 try{
  const r=await fetch('/api/sentinel-status',{cache:'no-store',credentials:'same-origin'});
  if(!r.ok)throw Error('status');
  const d=await r.json();
  if(!d.telemetryEnabled){count.textContent='OFF';label.textContent='Coleta de visitantes ainda não ativada. Configure Redis compartilhado com o armazenamento Vercel Blob.';return;}
  const total=d.daily.reduce((n,day)=>n+(Number(day.total)||0),0);
  count.textContent=String(total);
  label.textContent='Eventos anônimos dos últimos 7 dias. São sinais técnicos, não reclamações confirmadas.';
  const counts={};
  d.daily.forEach(day=>Object.entries(day.stats||{}).forEach(([key,n])=>{counts[key]=(counts[key]||0)+Number(n)}));
  events.innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([key,n])=>'<div class="incident"><b>'+escape(key)+'</b><span>'+n+' ocorrências</span></div>').join('')||'<p class="muted">Nenhum evento registrado.</p>';
 }catch(_){label.textContent='Não foi possível obter o diagnóstico. Confira sua sessão e tente novamente.';}
}
btn.addEventListener('click',scan);scan();load();
})();
</script>
</body></html>`;
module.exports={HTML};