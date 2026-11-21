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
      throw new Error("The chant couldn't be saved on this device (" + e.message + ").");
    }
    listeners.forEach(function(f) { f(); });
  }
  function get(id) {
    return load()[id] || null;
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
  // throws unless the text looks like a GABC score with a header
  function checkGabc(gabc) {
    if(typeof(gabc) != 'string' || gabc.indexOf('%%') < 0 || !/\([^)]*\)/.test(gabc.slice(gabc.indexOf('%%')))) {
      throw new Error(/^\s*wrong id\s*$/i.test(gabc || '')? 'GregoBase has no chant with this ID.' : "This isn't a GABC score.");
    }
    return gabc.replace(/\r\n?/g, '\n');
  }
  function download(id) {
    var url = gregobase + 'download.php?format=gabc&elem=1&id=' + id,
        http = window.cordova && cordova.plugin && cordova.plugin.http;
    return new Promise(function(resolve, reject) {
      if(http) {
        http.sendRequest(url, { method: 'get', responseType: 'text' },
          function(response) { resolve(response.data); },
          function(response) { reject(new Error(response.status > 0? 'GregoBase answered ' + response.status + '.' : (response.error || 'No connection.'))); });
      } else {
        fetch(url).then(function(response) {
          if(!response.ok) throw new Error('GregoBase answered ' + response.status + '.');
          return response.text();
        }).then(resolve, function(e) {
          var error = new Error("The app can't download from GregoBase here.");
          error.canPaste = true;
          reject(error);
        });
      }
    }).then(checkGabc);
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
  // another device (a choir member's phone) without depending on GregoBase.
  var fileFormat = 'cantemus-my-chants';
  function exportText() {
    return JSON.stringify({ format: fileFormat, version: 1, exported: new Date().toISOString(), chants: load() }, null, 1);
  }
  function exportFileName() {
    return 'cantemus-my-chants-' + new Date().toISOString().slice(0, 10) + '.json';
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
          chooserTitle: 'Save or send My chants'
        }, resolve, function(error) { reject(new Error('The file could not be shared (' + error + ').')); });
      } else if(window.cordova) {
        reject(new Error("This version of the app can't export files."));
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
  // Adds the chants of an exported file to the library; chants already in it (or official ones) are kept as they are.
  // Returns {added: [names], already: count, invalid: count}.
  function importText(text, isOfficial) {
    var data;
    try {
      data = JSON.parse(text);
    } catch(e) {}
    if(!data || data.format != fileFormat || !data.chants || typeof(data.chants) != 'object') {
      throw new Error("This isn't a My chants file (exported with “Export My chants”).");
    }
    var lib = load(), result = { added: [], already: 0, invalid: 0 };
    Object.keys(data.chants).forEach(function(id) {
      var chant = data.chants[id], gabc;
      try {
        if(!/^\d+$/.test(id) || !chant || typeof(chant.name) != 'string') throw new Error();
        gabc = checkGabc(chant.gabc);
      } catch(e) {
        return result.invalid++;
      }
      if(lib[id] || (isOfficial && isOfficial(id))) return result.already++;
      lib[id] = { name: chant.name.trim() || headerValue(gabc, 'name') || 'GregoBase ' + id, gabc: gabc,
        added: new Date().toISOString() };
      result.added.push(lib[id].name);
    });
    if(result.added.length) save(lib);
    return result;
  }
  function readFile(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { reject(new Error('The file could not be read.')); };
      reader.readAsText(file);
    });
  }
  function plural(n, one, many) {
    return n + ' ' + (n == 1? one : many);
  }
  function importSummary(result) {
    var parts = [];
    if(result.added.length) parts.push(plural(result.added.length, 'chant was', 'chants were') + ' added');
    if(result.already) parts.push(plural(result.already, 'was', 'were') + ' already in the app');
    if(result.invalid) parts.push(plural(result.invalid, 'was', 'were') + ' damaged and left out');
    if(!parts.length) return 'The file has no chants.';
    var text = parts.join('; ') + '.';
    return text.charAt(0).toUpperCase() + text.slice(1);
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
    $('<button class="btn btn-xs btn-default my-chants-close" title="Close"><span class="glyphicon glyphicon-remove"></span></button>')
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
    var d = dialog('Add a chant from GregoBase'),
        $body = d.$body,
        isOfficial = options.isOfficial || function() { return false; };
    $('<p></p>').html('Paste the link or the ID of the chant on <a target="_blank" href="' + gregobase + '">GregoBase</a>, ' +
      'e.g. <i>' + gregobase + 'chant.php?id=3973</i>').appendTo($body);
    var $form = $('<form class="my-chants-form"></form>').appendTo($body),
        $input = $('<input type="text" class="form-control" placeholder="GregoBase link or ID" autocomplete="off">').val(options.id || '').appendTo($form),
        $name = $('<input type="text" class="form-control" placeholder="Name in the menu (optional)" autocomplete="off">').appendTo($form),
        $add = $('<button type="submit" class="btn btn-sm btn-primary">Add</button>').appendTo($form),
        $status = $('<div class="my-chants-status" aria-live="polite"></div>').appendTo($body),
        $paste = $('<div class="my-chants-paste"></div>').hide().appendTo($body),
        $pasteText = $('<p></p>').appendTo($paste),
        $gabc = $('<textarea class="form-control" rows="6" spellcheck="false" placeholder="Paste the GABC here"></textarea>').appendTo($paste),
        $addPasted = $('<button class="btn btn-sm btn-primary">Add the pasted chant</button>').appendTo($paste),
        $list = $('<div class="my-chants-list"></div>').appendTo($body),
        $files = $('<div class="my-chants-buttons my-chants-files"></div>').appendTo($body),
        $export = $('<button class="btn btn-sm btn-default"><span class="glyphicon glyphicon-export"></span> Export My chants</button>').appendTo($files),
        $import = $('<button class="btn btn-sm btn-default"><span class="glyphicon glyphicon-import"></span> Import a file</button>').appendTo($files),
        $file = $('<input type="file" style="display: none">').appendTo($files),
        $fileStatus = $('<div class="my-chants-status" aria-live="polite"></div>').appendTo($body);
    $('<p class="my-chants-hint"></p>').text('Export saves all your chants in one file, as a backup or to send to other singers; ' +
      'Import adds the chants of such a file.').insertBefore($files);
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
      status($fileStatus, 'Reading ' + file.name + '…');
      readFile(file).then(function(text) {
        var result = importText(text, isOfficial);
        status($fileStatus, importSummary(result));
        renderList();
      }).catch(function(error) { status($fileStatus, error.message, true); });
    });
    var added = function(id, name) {
      status($status, '“' + name + '” was added to My chants.');
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
      if(!id) return status($status, 'Paste a GregoBase link (…chant.php?id=…) or a number.', true);
      if(isOfficial(id)) return status($status, 'This chant is already in the list of ad libitum chants.', true);
      status($status, 'Downloading GregoBase ' + id + '…');
      $add.prop('disabled', true);
      install(id, $name.val().trim()).then(function(name) {
        added(id, name);
      }, function(error) {
        status($status, error.message, true);
        if(error.canPaste) {
          $pasteText.html('Open <a target="_blank" href="' + chantUrl(id) + '">the chant on GregoBase</a>, ' +
            'copy all the text in its <b>GABC</b> box (Ctrl+A, Ctrl+C) and paste it below.');
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
      $('<h5>My chants</h5>').appendTo($list);
      var $ul = $('<ul></ul>').appendTo($list);
      chants.forEach(function(chant) {
        var $li = $('<li></li>').appendTo($ul);
        $('<a target="_blank"></a>').attr('href', chantUrl(chant.id)).text(chant.name).appendTo($li);
        $('<button class="btn btn-xs btn-default" title="Remove from My chants"><span class="glyphicon glyphicon-trash"></span></button>')
          .click(function() {
            if(!confirm('Remove “' + chant.name + '” from My chants?')) return;
            remove(chant.id);
            renderList();
          }).appendTo($li);
      });
    }
    renderList();
    $input.focus();
    return d;
  }

  // Offers to add the chants of a shared link that aren't on this device; onDone is called once any were added.
  function offerMissing(ids, onDone) {
    var d = dialog('Chants missing from this app'),
        $body = d.$body;
    $('<p></p>').text('This link uses ' + (ids.length == 1? 'a chant' : ids.length + ' chants') +
      ' from GregoBase that ' + (ids.length == 1? "isn't" : "aren't") + ' in your app yet:').appendTo($body);
    var $ul = $('<ul class="my-chants-missing"></ul>').appendTo($body),
        items = {};
    ids.forEach(function(id) {
      var $li = $('<li></li>').appendTo($ul);
      $('<a target="_blank"></a>').attr('href', chantUrl(id)).text('GregoBase ' + id).appendTo($li);
      items[id] = $('<span class="my-chants-item-status"></span>').appendTo($li);
    });
    var $buttons = $('<div class="my-chants-buttons"></div>').appendTo($body),
        $add = $('<button class="btn btn-sm btn-primary">Add to My chants</button>').appendTo($buttons),
        $later = $('<button class="btn btn-sm btn-default">Not now</button>').click(d.close).appendTo($buttons),
        $status = $('<div class="my-chants-status" aria-live="polite"></div>').appendTo($body);
    $add.click(function() {
      $add.prop('disabled', true);
      var anyAdded = false, canPaste = false;
      Promise.all(ids.map(function(id) {
        status(items[id], ' — downloading…');
        return install(id).then(function(name) {
          anyAdded = true;
          status(items[id], ' — added: ' + name);
        }, function(error) {
          canPaste = canPaste || error.canPaste;
          status(items[id], ' — ' + error.message, true);
        });
      })).then(function() {
        if(anyAdded && onDone) onDone();
        if(canPaste) {
          status($status, 'Add them one by one with “Add a chant from GregoBase…” in an ad libitum menu, pasting their GABC.', true);
          $add.prop('disabled', false);
        } else {
          $later.text('Close');
          $add.remove();
        }
      });
    });
    return d;
  }

  return {
    get: get, list: list, add: add, remove: remove, onChange: onChange,
    parseId: parseId, install: install, showAddDialog: showAddDialog, offerMissing: offerMissing,
    exportText: exportText, importText: importText
  };
})();
