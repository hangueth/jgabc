// The About page in the reader's language: faq.html (English) or faq-pt-BR.html (Portuguese, also for
// "Português (dias em latim)"). The language is chosen as in js/i18n.js: the one picked in the menu next to the dark
// mode button (localStorage.lang), or else the device's. Loaded in <head> by both pages, so the switch happens before
// the page shows.
(function() {
  var lang = '';
  try { lang = localStorage.lang || ''; } catch(e) {}
  if(!lang) lang = /^pt\b/i.test(navigator.language || navigator.userLanguage || '')? 'pt-BR' : 'en';
  var page = /^pt-BR/.test(lang)? 'faq-pt-BR.html' : 'faq.html',
      here = location.pathname.split('/').pop();
  if(here && here != page && /^faq(-pt-BR)?\.html$/.test(here)) location.replace(page + location.search + location.hash);
})();
