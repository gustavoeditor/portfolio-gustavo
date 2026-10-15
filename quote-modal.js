(() => {
  'use strict';
  const dialog = document.getElementById('quick-quote-dialog');
  const form = document.getElementById('quote-form');
  const slot = document.getElementById('quick-quote-form-slot');
  const closeButton = document.getElementById('quick-quote-close');
  const firstField = document.getElementById('quote-name');
  if (!dialog || !form || !slot || !closeButton || typeof dialog.showModal !== 'function') return;

  // One real form: no duplicated ids, validation, drafts, or WhatsApp handlers.
  const originalParent = form.parentNode;
  const originalNext = form.nextSibling;
  let restoreFocus = null;
  let savedOverflow = '';
  let active = false;

  function restoreForm() {
    if (!active) return;
    active = false;
    if (originalNext && originalNext.parentNode === originalParent) {
      originalParent.insertBefore(form, originalNext);
    } else {
      originalParent.appendChild(form);
    }
    document.body.style.overflow = savedOverflow;
    const focus = restoreFocus;
    restoreFocus = null;
    if (focus && focus.isConnected && typeof focus.focus === 'function') {
      focus.focus({preventScroll:true});
    }
  }

  function openQuote(event) {
    if (active) return;
    restoreFocus = (event && event.currentTarget) || document.activeElement;
    savedOverflow = document.body.style.overflow;
    slot.appendChild(form);
    active = true;
    try {
      dialog.showModal();
    } catch (_) {
      restoreForm();
      return;
    }
    document.body.style.overflow = 'hidden';
    try { window.va?.('event',{name:'quote_modal_open',data:{source:event?.currentTarget?.classList?.contains('quote-float')?'floating':'page'}}); } catch (_) {}
    requestAnimationFrame(() => {
      // Avoid triggering the mobile keyboard before the visitor chooses a field.
      if (window.matchMedia('(max-width: 600px)').matches) closeButton.focus({preventScroll:true});
      else firstField?.focus({preventScroll:true});
      syncKeyboardViewport();
    });
  }

  document.querySelectorAll('[data-open-quote], a[href="#orcamento"]').forEach(trigger => {
    trigger.addEventListener('click', event => {
      if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openQuote(event);
    });
  });

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', restoreForm);
  dialog.addEventListener('cancel', () => { /* Native Escape key closes and returns focus. */ });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  // Chrome Android's software keyboard shrinks the visual viewport, not necessarily 100dvh.
  const viewport=window.visualViewport;
  const shell=dialog.querySelector('.quick-quote-shell');
  let pendingFrame=0;
  function syncKeyboardViewport() {
    if (!active || !window.matchMedia('(max-width: 600px)').matches) return;
    const height=viewport ? viewport.height : window.innerHeight;
    const offset=viewport ? viewport.offsetTop : 0;
    dialog.style.setProperty('--quote-visible-height',Math.round(height)+'px');
    dialog.style.setProperty('--quote-visible-top',Math.round(offset)+'px');
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    pendingFrame=requestAnimationFrame(()=>{
      pendingFrame=0;
      const field=document.activeElement;
      if (!field || !form.contains(field) || !shell) return;
      const fieldRect=field.getBoundingClientRect();
      const shellRect=shell.getBoundingClientRect();
      const bottom= Math.min(shellRect.bottom, offset+height)-22;
      const top= Math.max(shellRect.top, offset)+20;
      if (fieldRect.bottom>bottom) shell.scrollTop+=fieldRect.bottom-bottom;
      else if (fieldRect.top<top) shell.scrollTop+=fieldRect.top-top;
    });
  }
  function clearKeyboardViewport() {
    if(pendingFrame){cancelAnimationFrame(pendingFrame);pendingFrame=0;}
    dialog.style.removeProperty('--quote-visible-height');
    dialog.style.removeProperty('--quote-visible-top');
  }
  viewport?.addEventListener('resize',syncKeyboardViewport);
  viewport?.addEventListener('scroll',syncKeyboardViewport);
  dialog.addEventListener('focusin',()=>requestAnimationFrame(syncKeyboardViewport));
  dialog.addEventListener('close',clearKeyboardViewport);
  window.addEventListener('orientationchange',syncKeyboardViewport);
    // Fallback: people can still navigate to /#orcamento and use the inline form.
})();
