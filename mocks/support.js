/* ---------------------------------------------------------------------------
   support.js — a standalone runtime for Trailroom .dc.html prototypes.

   The .dc.html files are Claude Design canvas documents. In the canvas, the
   editor supplies this file. Locally it did not exist, so the <helmet> styles,
   the {{ }} bindings and the <sc-if>/<sc-for> tags were never processed and the
   page rendered as unstyled markup with no images.

   This implements just enough of that runtime to click through the prototypes
   in an ordinary browser:
     <helmet>            hoisted into <head>
     {{ path.to.value }} interpolated in text nodes and attribute values
     <sc-if value>       conditional, unwrapped
     <sc-for list as>    repeat, unwrapped, with a scope for the alias
     onClick/onChange/onScroll, ref, disabled, value, style-hover, style-active
     DCLogic             base class with state / setState / lifecycle
     React.createRef

   Rendering patches the live DOM in place rather than replacing it, so text
   caret, focus, scroll position and an in-progress slider drag all survive a
   setState. Images load from pexels.com, so you need to be online.

   Open any of the three .dc.html files directly in a browser.
   Add ?startSignedIn=1 to the mobile prototype to boot into a signed-in state.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  /* ---------- keep the browser from fetching un-rendered {{ src }} ----------
     The template markup sits in the document, so the parser would otherwise try
     to load an image literally named "{{ curOnYou }}". Strip those as they are
     parsed; the runtime sets the real src when it renders. */
  if (window.MutationObserver) {
    var strip = function (el) {
      if (el.nodeType !== 1) return;
      if (el.tagName === 'IMG' && (el.getAttribute('src') || '').indexOf('{{') >= 0) el.removeAttribute('src');
      if (el.querySelectorAll) {
        var q = el.querySelectorAll('img[src*="{{"]');
        for (var i = 0; i < q.length; i++) q[i].removeAttribute('src');
      }
    };
    new MutationObserver(function (muts) {
      for (var m = 0; m < muts.length; m++) {
        var added = muts[m].addedNodes;
        for (var n = 0; n < added.length; n++) strip(added[n]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------- tiny React stand-in (only createRef is used) ---------- */
  window.React = window.React || {};
  if (!window.React.createRef) window.React.createRef = function () { return { current: null }; };

  /* ---------- component base class ---------- */
  var pending = false, instance = null;
  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; render(); });
  }

  function DCLogic(props) { this.props = props || {}; this._mounted = false; }
  DCLogic.prototype.setState = function (updater) {
    var patch = (typeof updater === 'function') ? updater(this.state) : updater;
    if (!patch) return;
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) this.state[k] = patch[k];
    if (this._mounted) scheduleRender();
  };
  DCLogic.prototype.renderVals = function () { return {}; };
  window.DCLogic = DCLogic;

  /* ---------- expression evaluation ---------- */
  function lookup(path, scopes) {
    var parts = path.split('.'), head = parts[0], base;
    for (var i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i] && Object.prototype.hasOwnProperty.call(scopes[i], head)) { base = scopes[i]; break; }
    }
    if (base === undefined) return undefined;
    var v = base[head];
    for (var j = 1; j < parts.length && v != null; j++) v = v[parts[j]];
    return v;
  }
  var ONE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  var ANY = /\{\{\s*([^}]+?)\s*\}\}/g;
  function isSingle(str) { return ONE.test(String(str).trim()); }
  function single(str, scopes) {
    var m = ONE.exec(String(str).trim());
    if (!m) return undefined;
    var raw = m[1].trim();
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return lookup(raw, scopes);
  }
  function interp(str, scopes) {
    return String(str).replace(ANY, function (_, p) {
      var raw = p.trim();
      var v = (raw === 'true') ? true : (raw === 'false') ? false : lookup(raw, scopes);
      return (v === undefined || v === null || v === false) ? '' : String(v);
    });
  }

  /* ---------- build a detached tree for the current state ---------- */
  var EVENTS = { onclick: 'click', onchange: 'input', onscroll: 'scroll', oninput: 'input' };
  var SKIP = { 'hint-placeholder-count': 1, 'hint-placeholder-val': 1 };

  function buildChildren(source, scopes, out) {
    var kids = source.childNodes;
    var isEl = !Array.isArray(out);
    var bucket = isEl ? [] : out;
    for (var i = 0; i < kids.length; i++) buildNode(kids[i], scopes, bucket);
    if (isEl) for (var j = 0; j < bucket.length; j++) out.appendChild(bucket[j]);
  }

  function buildNode(node, scopes, out) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      out.push(document.createTextNode(t.indexOf('{{') >= 0 ? interp(t, scopes) : t));
      return;
    }
    if (node.nodeType !== 1) return;

    var tag = node.tagName.toLowerCase();

    if (tag === 'sc-if') {
      var cond = node.getAttribute('value');
      var val = isSingle(cond) ? single(cond, scopes) : interp(cond, scopes);
      if (val) buildChildren(node, scopes, out);
      return;
    }

    if (tag === 'sc-for') {
      var listAttr = node.getAttribute('list');
      var alias = node.getAttribute('as') || 'item';
      var arr = isSingle(listAttr) ? single(listAttr, scopes) : null;
      if (!Array.isArray(arr)) return;
      for (var n = 0; n < arr.length; n++) {
        var scope = {};
        scope[alias] = arr[n];
        scope[alias + 'Index'] = n;
        buildChildren(node, scopes.concat([scope]), out);
      }
      return;
    }

    var el = document.createElement(tag);
    var handlers = [];
    var attrs = node.attributes;

    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, raw = attrs[a].value;
      if (SKIP[name]) continue;
      var lower = name.toLowerCase();

      if (EVENTS[lower]) {
        var fn = isSingle(raw) ? single(raw, scopes) : null;
        if (typeof fn === 'function') handlers.push([EVENTS[lower], fn]);
        continue;
      }
      if (name === 'ref') { var r = isSingle(raw) ? single(raw, scopes) : null; if (r) el.__ref = r; continue; }
      if (name === 'disabled') { el.__disabled = !!(isSingle(raw) ? single(raw, scopes) : interp(raw, scopes)); continue; }
      if (name === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) {
        el.__value = interp(raw, scopes);
        el.__key = raw;
        continue;
      }
      if (name === 'style-hover' || name === 'style-active') { el['__' + (name === 'style-hover' ? 'hover' : 'active')] = interp(raw, scopes); continue; }

      var out2 = raw.indexOf('{{') >= 0 ? interp(raw, scopes) : raw;
      if ((name === 'src' || name === 'href') && !out2) continue;   // don't re-request the page
      el.setAttribute(name, out2);
    }

    if (handlers.length) el.__handlers = handlers;
    bindExtras(el);                 // a new node is its own "live" node
    buildChildren(node, scopes, el);
    out.push(el);
  }

  /* ---------- patch the live DOM toward the new tree ---------- */
  var dragging = null;
  document.addEventListener('pointerdown', function (e) { dragging = e.target; }, true);
  document.addEventListener('pointerup', function () { dragging = null; }, true);

  // Wire the non-attribute bits onto an element: events, ref, value, disabled,
  // hover/active styling. Runs for brand-new nodes and again for reused ones.
  function bindExtras(live, fresh) {
    fresh = fresh || live;
    if (fresh.__handlers) {
      if (live.__handlers && live !== fresh) for (var i = 0; i < live.__handlers.length; i++) live.removeEventListener(live.__handlers[i][0], live.__handlers[i][1]);
      if (live.__bound !== fresh.__handlers) {
        for (var j = 0; j < fresh.__handlers.length; j++) live.addEventListener(fresh.__handlers[j][0], fresh.__handlers[j][1]);
        live.__bound = fresh.__handlers;
      }
      live.__handlers = fresh.__handlers;
    } else if (live.__handlers) {
      for (var k = 0; k < live.__handlers.length; k++) live.removeEventListener(live.__handlers[k][0], live.__handlers[k][1]);
      live.__handlers = null; live.__bound = null;
    }
    if (fresh.__ref) fresh.__ref.current = live;
    if (fresh.__disabled !== undefined) live.disabled = fresh.__disabled;
    if (fresh.__value !== undefined) {
      var busy = (live === document.activeElement) || (live === dragging);
      if (!busy && live.value !== fresh.__value) live.value = fresh.__value;
      live.__key = fresh.__key;
    }
    // hover / active styling, applied over whatever the current style attribute is
    if (fresh.__hover !== undefined || fresh.__active !== undefined) {
      live.__hover = fresh.__hover; live.__active = fresh.__active;
      if (!live.__styleBound) {
        live.__styleBound = true;
        var base = function () { return live.getAttribute('style') || ''; };
        var on = function (extra) { if (extra) { live.__baseStyle = base(); live.setAttribute('style', live.__baseStyle + ';' + extra); } };
        var off = function () { if (live.__baseStyle != null) { live.setAttribute('style', live.__baseStyle); live.__baseStyle = null; } };
        live.addEventListener('mouseenter', function () { on(live.__hover); });
        live.addEventListener('mouseleave', off);
        live.addEventListener('mousedown', function () { on(live.__active); });
        live.addEventListener('mouseup', off);
      }
    }
  }

  function patchElement(live, fresh) {
    var i, a;
    for (i = 0; i < fresh.attributes.length; i++) {
      a = fresh.attributes[i];
      if (live.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value);
    }
    for (i = live.attributes.length - 1; i >= 0; i--) {
      a = live.attributes[i];
      if (!fresh.hasAttribute(a.name)) live.removeAttribute(a.name);
    }
    bindExtras(live, fresh);
    patchChildren(live, Array.prototype.slice.call(fresh.childNodes));
  }

  function patchChildren(parent, freshKids) {
    var live = Array.prototype.slice.call(parent.childNodes);
    for (var i = 0; i < freshKids.length; i++) {
      var f = freshKids[i], l = live[i];
      if (!l) { parent.appendChild(f); continue; }
      if (l.nodeType !== f.nodeType || (f.nodeType === 1 && l.tagName !== f.tagName)) { parent.replaceChild(f, l); continue; }
      if (f.nodeType === 3) { if (l.nodeValue !== f.nodeValue) l.nodeValue = f.nodeValue; continue; }
      patchElement(l, f);
    }
    for (var j = live.length - 1; j >= freshKids.length; j--) parent.removeChild(live[j]);
  }

  /* ---------- boot ---------- */
  var template = null, container = null;

  function showError(err) {
    var box = document.getElementById('dc-error') || (function () {
      var d = document.createElement('div');
      d.id = 'dc-error';
      d.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7A1B14;color:#fff;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:12px 16px;white-space:pre-wrap;max-height:40vh;overflow:auto');
      document.body.appendChild(d);
      return d;
    })();
    box.textContent = 'Prototype runtime error\n\n' + (err && err.stack ? err.stack : String(err));
  }

  function render() {
    if (!instance || !template) return;
    try {
      var vals = instance.renderVals() || {};
      var fresh = [];
      buildChildren(template, [vals], fresh);
      patchChildren(container, fresh);
    } catch (err) { showError(err); throw err; }
  }

  function boot() {
    try {
      var host = document.querySelector('x-dc');
      if (!host) return;

      var helmet = host.querySelector('helmet');
      if (helmet) {
        while (helmet.firstChild) document.head.appendChild(helmet.firstChild);
        helmet.parentNode.removeChild(helmet);
      }

      // stash the markup as the template, then reuse <x-dc> as the live container
      template = document.createElement('div');
      while (host.firstChild) template.appendChild(host.firstChild);
      container = host;

      var scriptEl = document.querySelector('script[data-dc-script]');
      if (!scriptEl) return;

      var props = {};
      var decl = scriptEl.getAttribute('data-props');
      if (decl) {
        try {
          var parsed = JSON.parse(decl);
          for (var key in parsed) {
            if (key.charAt(0) === '$') continue;
            if (parsed[key] && 'default' in parsed[key]) props[key] = parsed[key]['default'];
          }
        } catch (e) { /* props are optional */ }
      }
      // let the URL override a declared prop, e.g. ?startSignedIn=1
      new URLSearchParams(location.search).forEach(function (v, k) {
        if (k in props) props[k] = (v === '' || v === '1' || v === 'true') ? true : (v === '0' || v === 'false') ? false : v;
      });

      var Component = new Function('DCLogic', 'React', scriptEl.textContent + '\n;return Component;')(DCLogic, window.React);
      instance = new Component(props);
      if (!instance.state) instance.state = {};
      if (instance.componentDidMount) instance.componentDidMount();
      instance._mounted = true;
      window.__dc = instance;   // handy for poking at state in the console
      render();
    } catch (err) { showError(err); throw err; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
