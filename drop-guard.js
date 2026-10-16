(() => {
  'use strict';
  if(document.getElementById('auto-drop'))return;
  const hasFiles=event=>Array.from(event.dataTransfer?.types || []).includes('Files');
  let notice;
  document.addEventListener('dragover',event=>{if(hasFiles(event))event.preventDefault();});
  document.addEventListener('drop',event=>{
    if(!hasFiles(event))return;
    event.preventDefault();
    if(!notice){
      notice=document.createElement('div');
      notice.className='file-drop-notice';
      notice.setAttribute('role','status');
      const message=document.createElement('p');
      message.textContent='Para enviar vídeos, entre no painel privado e arraste o arquivo na área de envio.';
      const link=document.createElement('a');
      link.href='/admin';link.textContent='Abrir painel';
      const close=document.createElement('button');
      close.type='button';close.textContent='Fechar';
      close.addEventListener('click',()=>{notice.remove();notice=null;});
      notice.append(message,link,close);document.body.append(notice);
    }
  });
})();
