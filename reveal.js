/* G / MOTION - scroll entrance for both initial markup and asynchronously inserted cards.
   Independent CSS 'translate' preserves 3D hover, parallax and sticky position. */
(() => {
  'use strict';
  if (!('IntersectionObserver' in window)) return;

  const selectors = [
    '.site-header .brand',
    '.site-header nav',
    '.site-header .header-whatsapp',
    '.hero-copy > .eyebrow',
    '.hero-copy > h1',
    '.hero-copy > .intro',
    '.hero-copy > .hero-actions',
    '.hero-copy > .hero-meta',
    '.hero-stage',
    '.capability-strip .wrap',
    '.portfolio > .section-head > div',
    '.portfolio > .section-head > p',
    '.project-toolbar',
    '.project-status',
    '.projects-empty',
    '#project-grid > .project-card',
    '.case-studies > .section-head > div',
    '.case-studies > .section-head > p',
    '.case-card',
    '.case-footnote',
    '.channels > .section-head > div',
    '.channels > .section-head > p',
    '.channels-group-title',
    '.channel-card',
    '.why > .section-head > div',
    '.why > .section-head > p',
    '.why-item',
    '.services > .wrap > .eyebrow',
    '.services .section-head > h2',
    '.services .section-head > p',
    '.service-grid > .service',
    '.workflow > .section-head > div',
    '.workflow > .section-head > p',
    '.workflow-grid > li',
    '.comparison > .section-head > div',
    '.comparison > .section-head > p',
    '.compare-card',
    '.reviews > .section-head > div',
    '.reviews > .section-head > p',
    '.review-card',
    '.faq > .section-head > div',
    '.faq > .section-head > p',
    '.faq-list > details',
    '.quote > .quote-intro > .eyebrow',
    '.quote > .quote-intro > h2',
    '.quote > .quote-intro > p',
    '.quote > .quote-intro > .quote-highlights',
    '#quote-form',
    '.contact > div',
    '.site-footer > span',
    '.site-footer > nav',
    '.quote-float'
  ];
  const dynamicContainers = [
    '#project-grid', '#channels-current', '#channels-past',
    '#compare-list', '#reviews-grid'
  ];
  const matching = selectors.join(',');
  const tracked = new WeakSet();
  const observer = new IntersectionObserver((entries, io) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target); // Entrance plays once; no distracting reverse fades.
    }
  }, {threshold:0.08,rootMargin:'0px 0px -18px 0px'});

  function prepare(element) {
    if (!element || element.nodeType !== 1 || tracked.has(element)) return;
    if (!element.matches(matching)) return;
    // Never animate the overlay itself or obscure an active, focused input.
    if (element.closest('.quick-quote-dialog')) return;
    tracked.add(element);
    const siblings = element.parentElement ? [...element.parentElement.children] : [];
    const order = Math.max(0,siblings.indexOf(element));
    const interval = element.classList.contains('project-card') ? 55 : 65;
    element.style.setProperty('--reveal-delay',Math.min(order % 5,4)*interval+'ms');
    element.classList.add('reveal-entry');
    observer.observe(element);
  }
  function prepareTree(node) {
    if (!node || node.nodeType !== 1) return;
    prepare(node);
    node.querySelectorAll(matching).forEach(prepare);
  }

  // Start only after observer is ready. Without JS or browser support,
  // all content remains visible and interactive.
  document.querySelectorAll(matching).forEach(prepare);
  document.body.classList.add('reveal-enabled');

  if ('MutationObserver' in window) {
    const changes = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) prepareTree(node);
      }
    });
    dynamicContainers.forEach(selector => {
      const container = document.querySelector(selector);
      if (container) changes.observe(container,{childList:true});
    });
  }

  // An open modal must show its reusable form immediately, even if the
  // end-of-page form has not yet scrolled into view.
  const dialog = document.getElementById('quick-quote-dialog');
  if (dialog) {
    dialog.addEventListener('close',() => {
      const form = document.getElementById('quote-form');
      if (form && !tracked.has(form)) prepare(form);
    });
  }
})();
