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
    try {
      dialog.showModal();
    } catch (_) {
      restoreForm();
      return;
    }
    active = true;
    document.body.style.overflow = 'hidden';
    try { window.va?.('event',{name:'quote_modal_open',data:{source:event?.currentTarget?.classList?.contains('quote-float')?'floating':'page'}}); } catch (_) {}
    requestAnimationFrame(() => firstField?.focus({preventScroll:true}));
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

  // Fallback: people can still navigate to /#orcamento and use the inline form.
})();
