// I18n: translates the Propers Tool's English texts (the interface, the rubrics and the titles of the extra chants)
// with a dictionary of "English → translation" pairs, e.g. js/i18n-pt-BR.js; Latin and the chant itself are never
// touched. Anything missing from the dictionary stays in English, so a partial dictionary is safe.
//
// - Rubrics and titles are translated where they are made (makeRubric and the extra chants in propers.js).
// - The rest of the page is translated as it appears: every text node, <option> and title/placeholder whose whole
//   (trimmed) text is a key of the "ui" table, also those added or changed later (menus, dialogs), except inside the
//   chant (svg), the readings, editors and rubrics.
// - Scripts can also ask for a translation with I18n.t.
// - The names of the days in the menus (Proper of the Time, of the Saints, Votive Masses, Commons) go through dayName,
//   with the "days" table (keyed by the English name, without its date) and "daysByKey" (by the day's key, for the
//   few English names that stand for two different days).
// - The language is the one chosen in the menu next to the dark mode button (kept in localStorage.lang), or else the
//   device's: Portuguese devices get pt-BR, the others English.
// - A variant ({base: 'pt-BR', latinDays: true}) uses its base's dictionary but keeps the days' Latin names.
var I18n = (function() {
  var dictionaries = {},
      languages = [{ code: 'en', name: 'English' }],
      lang;
  function storedLanguage() {
    try { return localStorage.lang || ''; } catch(e) { return ''; }
  }
  function detect() {
    var stored = storedLanguage();
    if(stored) return stored;
    return /^pt\b/i.test(navigator.language || navigator.userLanguage || '')? 'pt-BR' : 'en';
  }
  lang = detect();

  // dictionary: {name: 'Português', ui: {...}, rubrics: {...}, titles: {...}}
  function add(code, dictionary) {
    dictionaries[code] = dictionary;
    languages.push({ code: code, name: dictionary.name || code });
  }
  // the dictionary with the tables of the current language (a variant's base)
  function tables() {
    var dictionary = dictionaries[lang];
    return dictionary && dictionary.base? dictionaries[dictionary.base] : dictionary;
  }
  // the translation of text from the given table ('ui' by default), or text itself; whitespace around it is kept
  function t(text, table) {
    var dictionary = tables();
    if(!dictionary || typeof(text) != 'string') return text;
    var entries = dictionary[table || 'ui'] || {},
        key = text.trim();
    return key && Object.prototype.hasOwnProperty.call(entries, key)? text.replace(key, entries[key]) : text;
  }
  function rubric(text) { return t(text, 'rubrics'); }
  function title(text) { return t(text, 'titles'); }

  // The name of a day for the menus: o is an entry of propersdata.js ({key, title (Latin), en}) and key the field
  // propers.js would show ('title' or 'en'). Dates ("Feb 23 or 24: ", " (2027: Mar 25)") follow the dictionary's
  // "months"; a name missing from the dictionary is shown as before.
  var regexDate = /^([A-Z][a-z]{2}) (\d+)(?: (?:or|vel) (\d+))?: /,
      regexTransferred = / \((\d{4}): ([A-Z][a-z]{2}) (\d+)\)$/;
  function dayName(o, key) {
    var dictionary = dictionaries[lang],
        days = tables();
    if(!dictionary) return storedLanguage() == 'en' && o.en != null? o.en : o[key];
    var text = dictionary.latinDays? o.title : o.en;
    if(typeof(text) != 'string') return o[key];
    var months = days.months || {},
        month = function(m) { return months[m] || m; },
        indent = text.match(/^\s*/)[0],
        date = '', transferred = '', match;
    text = text.slice(indent.length);
    if((match = regexDate.exec(text))) {
      date = match[2] + (match[3]? ' ' + (days.or || 'or') + ' ' + match[3] : '') + ' ' + month(match[1]) + ': ';
      text = text.slice(match[0].length);
    }
    if((match = regexTransferred.exec(text))) {
      transferred = ' (' + match[3] + ' ' + month(match[2]) + ' ' + match[1] + ')';
      text = text.slice(0, match.index);
    }
    if(!dictionary.latinDays) {
      var byKey = days.daysByKey || {}, byName = days.days || {},
          has = Object.prototype.hasOwnProperty;
      if(typeof(o.key) == 'string' && has.call(byKey, o.key)) text = byKey[o.key];
      else if(has.call(byName, text)) text = byName[text];
      else return o[key];
    }
    return indent + date + text + transferred;
  }

  // DOM translation
  var skip = 'svg, script, style, textarea, [contenteditable], .rubric, .lectio-text, .no-i18n';
  function translateElementAttributes(el) {
    ['title', 'placeholder', 'aria-label'].forEach(function(name) {
      var value = el.getAttribute && el.getAttribute(name);
      if(value) {
        var translated = t(value);
        if(translated !== value) el.setAttribute(name, translated);
      }
    });
  }
  function translateTree(root) {
    if(!dictionaries[lang] || !root) return;
    if(root.nodeType == 3) {
      if(root.parentNode && root.parentNode.closest && !root.parentNode.closest(skip)) {
        var translated = t(root.nodeValue);
        if(translated !== root.nodeValue) root.nodeValue = translated;
      }
      return;
    }
    if(root.nodeType != 1 || root.closest(skip)) return;
    translateElementAttributes(root);
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        if(node.nodeType == 1 && node.matches(skip)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while((node = walker.nextNode())) {
      if(node.nodeType == 1) translateElementAttributes(node);
      else {
        var value = node.nodeValue, translated = t(value);
        if(translated !== value) node.nodeValue = translated;
      }
    }
  }

  // the language menu, next to the dark mode button
  function addLanguageMenu() {
    if(languages.length < 2 || document.getElementById('selLanguage')) return;
    var anchor = document.querySelector('.dark-mode-toggle');
    if(!anchor) return;
    var select = document.createElement('select');
    select.id = 'selLanguage';
    select.className = 'no-i18n';
    select.title = 'Language / Idioma';
    select.style.cssText = 'margin-left: 6px; font-size: 12px; vertical-align: middle;';
    languages.forEach(function(l) {
      var option = document.createElement('option');
      option.value = l.code;
      option.textContent = l.name;
      option.selected = l.code == lang;
      select.appendChild(option);
    });
    select.addEventListener('change', function() {
      try { localStorage.lang = select.value; } catch(e) {}
      location.reload();
    });
    anchor.parentNode.insertBefore(select, anchor.nextSibling);
  }

  function start() {
    addLanguageMenu();
    if(!dictionaries[lang]) return;
    document.documentElement.lang = dictionaries[lang].base || lang;
    translateTree(document.body);
    // also the titles that change later, e.g. the dark mode button's "Dark mode: On" (the translation isn't a key, so
    // setting it doesn't start over)
    new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if(mutation.type == 'attributes') {
          if(!mutation.target.closest(skip)) translateElementAttributes(mutation.target);
          return;
        }
        for(var i = 0; i < mutation.addedNodes.length; ++i) translateTree(mutation.addedNodes[i]);
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
  }
  if(document.readyState == 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  return { add: add, t: t, rubric: rubric, title: title, dayName: dayName, language: function() { return lang; } };
})();
