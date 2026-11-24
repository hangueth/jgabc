// My chants: the user's own library of ad libitum chants from GregoBase, kept on this device (localStorage) by GregoBase ID,
// so that each choir can add the chants it sings without waiting for them to be added to the app.
//
// A chant is downloaded from GregoBase by its ID or link. GregoBase does not allow cross-origin requests (no CORS headers),
// so the download only works in the app, through cordova-plugin-advanced-http, or if GregoBase ever allows them;
// otherwise the user is asked to paste the chant's GABC, copied from its GregoBase page.
var MyChants = (function() {
  var storageKey = 'myChants',
      gregobase = 'https://gregobase.selapa.net/',
      listeners = [];

  // text in the user's language (js/i18n.js, if the page has it; the English text is the key), with each {name} replaced
  // by values.name, e.g. _('Downloading GregoBase {id}…', {id: 3973})
  function _(text, values) {
    if(window.I18n) text = I18n.t(text);
    return values? text.replace(/\{(\w+)\}/g, function(match, key) { return key in values? values[key] : match; }) : text;
  }
  // _ of one or many, by n: plural(2, '{n} chant', '{n} chants') → "2 chants"
  function plural(n, one, many) {
    return _(n == 1? one : many, { n: n });
  }

  function load() {
    try {
      var lib = JSON.parse(localStorage[storageKey] || '{}');
      return lib && typeof(lib) == 'object'? lib : {};
    } catch(e) {
      return {};
    }
  }
  function save(lib) {
    try {
      localStorage[storageKey] = JSON.stringify(lib);
    } catch(e) {
      throw new Error(_("The chant couldn't be saved on this device ({error}).", { error: e.message }));
    }
    listeners.forEach(function(f) { f(); });
  }
  function get(id) {
    var chant = load()[id];
    // fixGabc also here, for the chants saved before it existed
    return chant? { name: chant.name, gabc: fixGabc(chant.gabc), added: chant.added } : null;
  }
  // [{id, name}], sorted by name
  function list() {
    var lib = load();
    return Object.keys(lib).map(function(id) { return { id: id, name: lib[id].name }; })
      .sort(function(a, b) { return a.name.localeCompare(b.name); });
  }
  function add(id, name, gabc) {
    var lib = load();
    lib[id] = { name: name, gabc: gabc, added: new Date().toISOString() };
    save(lib);
  }
  function remove(id) {
    var lib = load();
    delete lib[id];
    save(lib);
  }
  function onChange(f) {
    listeners.push(f);
  }

  // the GregoBase ID in an ID, a chant page link or a download link
  function parseId(text) {
    text = String(text || '').trim();
    var match = /^(\d+)$/.exec(text) || /[?&]id=(\d+)/.exec(text);
    return match && match[1];
  }
  function chantUrl(id) {
    return gregobase + 'chant.php?id=' + id;
  }
  function headerValue(gabc, key) {
    var header = gabc.slice(0, Math.max(0, gabc.indexOf('%%'))),
        match = new RegExp('(?:^|\\n)\\s*' + key + '\\s*:\\s*([^;\\n]*)').exec(header);
    return match? match[1].trim() : '';
  }
  // GregoBase sometimes writes the * (and the dagger and cross) as Gregorio's LaTeX symbols in <v>…</v>, e.g.
  // <v>\gresixstar</v>; exsurge draws them with a glyph that the lyrics font doesn't have (an empty box), so
  // they're turned into the plain characters, which Chant Tools' own chants use.
  var gabcSymbols = { gresixstar: '*', grestar: '*', greheightstar: '*', gredagger: '†', grecross: '✠', grealtcross: '✠' };
  function fixGabc(gabc) {
    return typeof(gabc) == 'string'? gabc.replace(/<v>\s*\\(gresixstar|grestar|greheightstar|gredagger|grecross|grealtcross)\s*(?:\{\})?\s*<\/v>/g,
      function(match, name) { return gabcSymbols[name]; }) : gabc;
  }
  // throws unless the text looks like a GABC score with a header; returns it with \n line ends and fixGabc applied
  function checkGabc(gabc) {
    if(typeof(gabc) != 'string' || gabc.indexOf('%%') < 0 || !/\([^)]*\)/.test(gabc.slice(gabc.indexOf('%%')))) {
      throw new Error(/^\s*wrong id\s*$/i.test(gabc || '')? _('GregoBase has no chant with this ID.') : _("This isn't a GABC score."));
    }
    return fixGabc(gabc.replace(/\r\n?/g, '\n'));
  }
  // In the app, the plugin's "legacy" trust mode checks GregoBase's certificate with the app's network security config,
  // which adds Let's Encrypt's root certificates for Android 7.0 (its default mode reads only the phone's own ones).
  var trustModeSet = null;
  function setTrustMode(http) {
    return trustModeSet = trustModeSet || new Promise(function(resolve) {
      http.setServerTrustMode('legacy', resolve, resolve);
    });
  }
  function download(id) {
    var url = gregobase + 'download.php?format=gabc&elem=1&id=' + id,
        http = window.cordova && cordova.plugin && cordova.plugin.http;
    return (http? setTrustMode(http) : Promise.resolve()).then(function() { return new Promise(function(resolve, reject) {
      if(http) {
        http.sendRequest(url, { method: 'get', responseType: 'text' },
          function(response) { resolve(response.data); },
          function(response) {
            // -2: the secure connection failed (an unknown certificate, or the device's date and time are wrong)
            reject(new Error(response.status > 0? _('GregoBase answered {status}.', { status: response.status }) :
              response.status == -2? _("Couldn't connect securely to GregoBase. Check that this device's date and time are right. ({error})", { error: response.error }) :
              (response.error || _('No connection.'))));
          });
      } else {
        fetch(url).then(function(response) {
          if(!response.ok) throw new Error(_('GregoBase answered {status}.', { status: response.status }));
          return response.text();
        }).then(resolve, function(e) {
          var error = new Error(_("The app can't download from GregoBase here."));
          error.canPaste = true;
          reject(error);
        });
      }
    }); }).then(checkGabc);
  }
  // downloads chant id and adds it to the library; resolves with its name
  function install(id, name) {
    return download(id).then(function(gabc) {
      name = name || headerValue(gabc, 'name') || 'GregoBase ' + id;
      add(id, name, gabc);
      return name;
    });
  }

  // Export and import: the whole library in one JSON file, with the scores, so that it can be restored or given to
  // another device (a choir member's phone) without depending on GregoBase. The file's extension, .mychants, and its
  // format name don't name any app, so that any version of Chant Tools can open them; the Android app opens .mychants
  // files from other apps (WhatsApp, Drive, files) by itself.
  var fileFormat = 'my-chants',
      oldFileFormats = ['cantemus-my-chants'];
  function exportText() {
    return JSON.stringify({ format: fileFormat, version: 1, exported: new Date().toISOString(), chants: load() }, null, 1);
  }
  function exportFileName() {
    return 'my-chants-' + new Date().toISOString().slice(0, 10) + '.mychants';
  }
  function base64(text) {
    var bytes = new TextEncoder().encode(text), binary = '';
    for(var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }
  // Gives the library file to the user: in the app, through the phone's share menu (WhatsApp, Drive, e-mail…),
  // with cordova-plugin-x-socialsharing, since the app's web view ignores downloads; on the web, as a download.
  function exportFile() {
    var text = exportText(), name = exportFileName(),
        sharing = window.cordova && window.plugins && window.plugins.socialsharing;
    return new Promise(function(resolve, reject) {
      if(sharing) {
        sharing.shareWithOptions({
          files: ['df:' + name + ';data:application/json;base64,' + base64(text)],
          chooserTitle: _('Save or send My chants')
        }, resolve, function(error) { reject(new Error(_('The file could not be shared ({error}).', { error: error }))); });
      } else if(window.cordova) {
        reject(new Error(_("This version of the app can't export files.")));
      } else {
        var url = URL.createObjectURL(new Blob([text], { type: 'application/json' })),
            link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
        resolve();
      }
    });
  }
  // The chants of an exported file: {chants: [{id, name, gabc}], invalid: count}; throws if it isn't one.
  function parseFile(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch(e) {}
    if(!data || (data.format != fileFormat && oldFileFormats.indexOf(data.format) < 0) ||
        !data.chants || typeof(data.chants) != 'object') {
      throw new Error(_("This isn't a My chants file (exported with “Export My chants”)."));
    }
    var result = { chants: [], invalid: 0 };
    Object.keys(data.chants).forEach(function(id) {
      var chant = data.chants[id], gabc;
      try {
        if(!/^\d+$/.test(id) || !chant || typeof(chant.name) != 'string') throw new Error();
        gabc = checkGabc(chant.gabc);
      } catch(e) {
        return result.invalid++;
      }
      result.chants.push({ id: id, name: chant.name.trim() || headerValue(gabc, 'name') || 'GregoBase ' + id, gabc: gabc });
    });
    return result;
  }
  // Adds the chants of an exported file to the library; chants already in it (or official ones) are kept as they are.
  // Returns {added: [names], already: count, invalid: count}.
  function importText(text, isOfficial) {
    var file = parseFile(text), lib = load(), result = { added: [], already: 0, invalid: file.invalid };
    file.chants.forEach(function(chant) {
      if(lib[chant.id] || (isOfficial && isOfficial(chant.id))) return result.already++;
      lib[chant.id] = { name: chant.name, gabc: chant.gabc, added: new Date().toISOString() };
      result.added.push(chant.name);
    });
    if(result.added.length) save(lib);
    return result;
  }
  function readFile(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { reject(new Error(_('The file could not be read.'))); };
      reader.readAsText(file);
    });
  }
  function importSummary(result) {
    var parts = [];
    if(result.added.length) parts.push(plural(result.added.length, '{n} chant was added', '{n} chants were added'));
    if(result.already) parts.push(plural(result.already, '{n} was already in the app', '{n} were already in the app'));
    if(result.invalid) parts.push(plural(result.invalid, '{n} was damaged and left out', '{n} were damaged and left out'));
    if(!parts.length) return _('The file has no chants.');
    var text = parts.join('; ') + '.';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // a chant in the dialogs' lists: its name, linking to its GregoBase page, followed by its GregoBase ID, e.g. "Media vita (3973)"
  function chantLink(chant) {
    return $('<span></span>')
      .append($('<a target="_blank"></a>').attr('href', chantUrl(chant.id)).text(chant.name))
      .append($('<span class="my-chants-id"></span>').text(' (' + chant.id + ')'));
  }
  // a simple dialog: returns {$overlay, $body, close}
  function dialog(title) {
    var $overlay = $('<div class="my-chants-overlay"></div>'),
        $box = $('<div class="my-chants-dialog" role="dialog" aria-modal="true"></div>').appendTo($overlay),
        $head = $('<div class="my-chants-head"></div>').appendTo($box),
        $body = $('<div class="my-chants-body"></div>').appendTo($box);
    $('<h4></h4>').text(title).appendTo($head);
    var close = function() {
      $overlay.remove();
      $(document).off('keydown.myChants');
    };
    $('<button class="btn btn-xs btn-default my-chants-close"><span class="glyphicon glyphicon-remove"></span></button>').attr('title', _('Close'))
      .click(close).appendTo($head);
    $overlay.on('mousedown', function(e) { if(e.target === this) close(); });
    $(document).on('keydown.myChants', function(e) { if(e.key == 'Escape') close(); });
    $overlay.appendTo(document.body);
    return { $overlay: $overlay, $body: $body, close: close };
  }
  function status($status, text, isError) {
    $status.text(text || '').toggleClass('my-chants-error', !!isError);
  }

  // The "Add a chant from GregoBase" dialog, which also lists the chants in the library.
  // onAdded(id) is called with the ID of each chant added.
  function showAddDialog(options) {
    options = options || {};
    var d = dialog(_('Add a chant from GregoBase')),
        $body = d.$body,
        isOfficial = options.isOfficial || function() { return false; };
    var links = { gregobase: '<a target="_blank" href="' + gregobase + '">GregoBase</a>', example: '<i>' + chantUrl(3973) + '</i>' },
        $intro = $('<p></p>').html(_('Paste the link or the ID of the chant on {gregobase}, e.g. {example}', links) + ' ').appendTo($body),
        $help = $('<div class="my-chants-help"></div>').html(
          '<p>' + _('<b>What is GregoBase?</b> A free website, with no login, that holds a huge index of Gregorian chants ' +
          '(antiphons, hymns, sequences, Mass chants…), transcribed by volunteers. Chant Tools takes its chants from there, ' +
          'so any chant on GregoBase can be brought into this app.') + '</p>' +
          '<p><b>' + _('How to bring a chant:') + '</b></p>' +
          '<ol>' +
          '<li>' + _('Open {gregobase} and look for the chant by its first words (the search box, or the lists by type or by book).', links) + '</li>' +
          '<li>' + _('Open the chant. The address of its page looks like {example}; the number at the end is its ID.', links) + '</li>' +
          '<li>' + _('Copy that address (or just the number), paste it in the field below and tap <b>Add</b>.') + '</li>' +
          '</ol>' +
          '<p>' + _('The chant is then kept on this device and appears in every ad libitum menu, marked with *.') + '</p>'
        ).hide().appendTo($body);
    $('<button type="button" class="btn btn-xs btn-link my-chants-info">' +
      '<span class="glyphicon glyphicon-info-sign"></span></button>').attr('title', _('What is GregoBase, and how to find a chant'))
      .click(function(e) { e.preventDefault(); $help.toggle(); }).appendTo($intro);
    var $form = $('<form class="my-chants-form"></form>').appendTo($body),
        $input = $('<input type="text" class="form-control" autocomplete="off">').attr('placeholder', _('GregoBase link or ID')).val(options.id || '').appendTo($form),
        $name = $('<input type="text" class="form-control" autocomplete="off">').attr('placeholder', _('Name in the menu (optional)')).appendTo($form),
        $add = $('<button type="submit" class="btn btn-sm btn-primary"></button>').text(_('Add')).appendTo($form),
        $status = $('<div class="my-chants-status" aria-live="polite"></div>').appendTo($body),
        $paste = $('<div class="my-chants-paste"></div>').hide().appendTo($body),
        $pasteText = $('<p></p>').appendTo($paste),
        $gabc = $('<textarea class="form-control" rows="6" spellcheck="false"></textarea>').attr('placeholder', _('Paste the GABC here')).appendTo($paste),
        $addPasted = $('<button class="btn btn-sm btn-primary"></button>').text(_('Add the pasted chant')).appendTo($paste),
        $list = $('<div class="my-chants-list"></div>').appendTo($body),
        $files = $('<div class="my-chants-buttons my-chants-files"></div>').appendTo($body),
        $export = $('<button class="btn btn-sm btn-default"><span class="glyphicon glyphicon-export"></span> </button>').append(document.createTextNode(_('Export My chants'))).appendTo($files),
        $import = $('<button class="btn btn-sm btn-default"><span class="glyphicon glyphicon-import"></span> </button>').append(document.createTextNode(_('Import a file'))).appendTo($files),
        $file = $('<input type="file" style="display: none">').appendTo($files),
        $fileStatus = $('<div class="my-chants-status" aria-live="polite"></div>').appendTo($body);
    $('<p class="my-chants-hint"></p>').text(_('Export saves all your chants in one file, as a backup or to send to other singers; ' +
      'Import adds the chants of such a file.')).insertBefore($files);
    $export.click(function(e) {
      e.preventDefault();
      status($fileStatus, '');
      exportFile().catch(function(error) { status($fileStatus, error.message, true); });
    });
    $import.click(function(e) {
      e.preventDefault();
      $file.val('').click();
    });
    $file.on('change', function() {
      var file = this.files && this.files[0];
      if(!file) return;
      status($fileStatus, _('Reading {file}…', { file: file.name }));
      readFile(file).then(function(text) {
        var result = importText(text, isOfficial);
        status($fileStatus, importSummary(result));
        renderList();
      }).catch(function(error) { status($fileStatus, error.message, true); });
    });
    var added = function(id, name) {
      status($status, _('“{name}” was added to My chants.', { name: name }));
      $input.val('');
      $name.val('');
      $gabc.val('');
      $paste.hide();
      renderList();
      if(options.onAdded) options.onAdded(id);
    };
    $form.on('submit', function(e) {
      e.preventDefault();
      var id = parseId($input.val());
      $paste.hide();
      if(!id) return status($status, _('Paste a GregoBase link (…chant.php?id=…) or a number.'), true);
      if(isOfficial(id)) return status($status, _('This chant is already in the list of ad libitum chants.'), true);
      status($status, _('Downloading GregoBase {id}…', { id: id }));
      $add.prop('disabled', true);
      install(id, $name.val().trim()).then(function(name) {
        added(id, name);
      }, function(error) {
        status($status, error.message, true);
        if(error.canPaste) {
          $pasteText.html(_('Open <a target="_blank" href="{url}">the chant on GregoBase</a>, ' +
            'copy all the text in its <b>GABC</b> box (Ctrl+A, Ctrl+C) and paste it below.', { url: chantUrl(id) }));
          $paste.data('id', id).show();
        }
      }).then(function() { $add.prop('disabled', false); });
    });
    $addPasted.click(function(e) {
      e.preventDefault();
      var id = $paste.data('id');
      try {
        var gabc = checkGabc($gabc.val()),
            name = $name.val().trim() || headerValue(gabc, 'name') || 'GregoBase ' + id;
        add(id, name, gabc);
        added(id, name);
      } catch(error) {
        status($status, error.message, true);
      }
    });
    function renderList() {
      var chants = list();
      $list.empty();
      $export.prop('disabled', !chants.length);
      if(!chants.length) return;
      $('<h5></h5>').text(_('My chants')).appendTo($list);
      $('<p class="my-chants-hint-inline"></p>').text(_('In the ad libitum menus, they are among the other chants, marked with *.')).appendTo($list);
      var $ul = $('<ul></ul>').appendTo($list);
      chants.forEach(function(chant) {
        var $li = $('<li></li>').appendTo($ul);
        chantLink(chant).appendTo($li);
        $('<button class="btn btn-xs btn-default"><span class="glyphicon glyphicon-trash"></span></button>').attr('title', _('Remove from My chants'))
          .click(function() {
            if(!confirm(_('Remove “{name}” from My chants?', { name: chant.name }))) return;
            remove(chant.id);
            renderList();
          }).appendTo($li);
      });
    }
    renderList();
    $input.focus();
    return d;
  }

  // Shows the chants of a My chants file opened from another app and offers to add the new ones.
  // text is the file's content, or an Error if it couldn't be read.
  function showImportDialog(text, options) {
    options = options || {};
    var d = dialog(_('Import My chants')),
        $body = d.$body,
        file;
    try {
      if(text instanceof Error) throw text;
      file = parseFile(text);
    } catch(error) {
      $('<p class="my-chants-error"></p>').text(error.message).appendTo($body);
      $('<div class="my-chants-buttons"></div>').append($('<button class="btn btn-sm btn-default"></button>').text(_('Close')).click(d.close)).appendTo($body);
      return d;
    }
    var lib = load(),
        isOfficial = options.isOfficial || function() { return false; },
        fresh = file.chants.filter(function(chant) { return !lib[chant.id] && !isOfficial(chant.id); });
    $('<p></p>').text(!file.chants.length? _('This file has no chants.') :
      !fresh.length? _('All the chants in this file are already in your app:') :
      fresh.length == file.chants.length? plural(file.chants.length, 'This file has {n} chant:', 'This file has {n} chants:') :
      _('This file has {chants}; {new} (the others are already in your app):', {
        chants: plural(file.chants.length, '{n} chant', '{n} chants'),
        new: plural(fresh.length, '{n} is new', '{n} are new')
      })).appendTo($body);
    var $ul = $('<ul class="my-chants-missing"></ul>').appendTo($body);
    file.chants.slice().sort(function(a, b) { return a.name.localeCompare(b.name); }).forEach(function(chant) {
      var $li = $('<li></li>').appendTo($ul);
      chantLink(chant).appendTo($li);
      if(fresh.indexOf(chant) < 0) $('<span class="my-chants-item-status"></span>').text(' — ' + _('already in the app')).appendTo($li);
    });
    if(file.invalid) $('<p class="my-chants-error"></p>').text(plural(file.invalid, '{n} chant is damaged and will be left out.', '{n} chants are damaged and will be left out.')).appendTo($body);
    var $buttons = $('<div class="my-chants-buttons"></div>').appendTo($body),
        $status = $('<div class="my-chants-status" aria-live="polite"></div>').appendTo($body);
    if(fresh.length) {
      $('<button class="btn btn-sm btn-primary"></button>').text(plural(fresh.length, 'Add {n} chant to My chants', 'Add {n} chants to My chants'))
        .click(function() {
          var result = importText(text, isOfficial);
          status($status, importSummary(result));
          $(this).remove();
          $close.text(_('Close'));
          if(options.onDone) options.onDone(result);
        }).appendTo($buttons);
    }
    var $close = $('<button class="btn btn-sm btn-default"></button>').text(fresh.length? _('Not now') : _('Close')).click(d.close).appendTo($buttons);
    return d;
  }

  // Offers to add the chants of a shared link that aren't on this device; onDone is called once any were added.
  function offerMissing(ids, onDone) {
    var d = dialog(_('Chants missing from this app')),
        $body = d.$body;
    $('<p></p>').text(plural(ids.length, "This link uses a chant from GregoBase that isn't in your app yet:",
      "This link uses {n} chants from GregoBase that aren't in your app yet:")).appendTo($body);
    var $ul = $('<ul class="my-chants-missing"></ul>').appendTo($body),
        items = {};
    ids.forEach(function(id) {
      var $li = $('<li></li>').appendTo($ul);
      $('<a target="_blank"></a>').attr('href', chantUrl(id)).text('GregoBase ' + id).appendTo($li);
      items[id] = $('<span class="my-chants-item-status"></span>').appendTo($li);
    });
    var $buttons = $('<div class="my-chants-buttons"></div>').appendTo($body),
        $add = $('<button class="btn btn-sm btn-primary"></button>').text(_('Add to My chants')).appendTo($buttons),
        $later = $('<button class="btn btn-sm btn-default"></button>').text(_('Not now')).click(d.close).appendTo($buttons),
        $status = $('<div class="my-chants-status" aria-live="polite"></div>').appendTo($body);
    $add.click(function() {
      $add.prop('disabled', true);
      var anyAdded = false, canPaste = false;
      Promise.all(ids.map(function(id) {
        status(items[id], ' — ' + _('downloading…'));
        return install(id).then(function(name) {
          anyAdded = true;
          status(items[id], ' — ' + _('added: {name}', { name: name }));
        }, function(error) {
          canPaste = canPaste || error.canPaste;
          status(items[id], ' — ' + error.message, true);
        });
      })).then(function() {
        if(anyAdded && onDone) onDone();
        if(canPaste) {
          status($status, _('Add them one by one with “Add a chant from GregoBase…” in an ad libitum menu, pasting their GABC.'), true);
          $add.prop('disabled', false);
        } else {
          $later.text(_('Close'));
          $add.remove();
        }
      });
    });
    return d;
  }

  return {
    get: get, list: list, add: add, remove: remove, onChange: onChange,
    parseId: parseId, install: install, showAddDialog: showAddDialog, offerMissing: offerMissing,
    exportText: exportText, importText: importText, showImportDialog: showImportDialog
  };
})();
