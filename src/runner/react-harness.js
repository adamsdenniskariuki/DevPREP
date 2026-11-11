// The React exercise test harness. It runs inside the sandboxed preview iframe (and in jsdom for unit tests),
// so it is plain JavaScript with no imports: the app loads it as text and the iframe evaluates it.
// globalThis.__devprepRunReact(payload, post) evaluates React and the compiled exercise modules as CommonJS,
// runs the tests one at a time and posts { type: 'total' | 'progress' | 'result' } messages back.
;(function () {
  'use strict'
  var OUTPUT_LIMIT = 4000
  var REACT_ERRORS = {
    31: 'Objects are not valid as a React child. Render a string, number, element or array instead.',
    130: 'Element type is invalid: check the component is exported and imported with the right name.',
    185: 'Maximum update depth exceeded: a component keeps setting state in an effect or during commit.',
    301: 'Too many re-renders: state is set during render, which starts an endless loop.',
    321: 'Invalid hook call: hooks can only be called at the top level of a function component or custom hook.',
    310: 'Rendered more hooks than during the previous render: hooks must not be called conditionally.',
    300: 'Rendered fewer hooks than expected: hooks must not be called conditionally or after an early return.',
    426: 'A component suspended during a synchronous update. Wrap it in <Suspense> or update inside startTransition.',
    482: 'An unknown Component is an async function: client components cannot be async.',
  }

  function messageOf(error) {
    if (error && typeof error === 'object' && 'message' in error) {
      var text = String(error.message)
      var minified = /Minified React error #(\d+)/.exec(text)
      if (minified && REACT_ERRORS[minified[1]]) return REACT_ERRORS[minified[1]] + ' (React error #' + minified[1] + ')'
      return (error.name && error.name !== 'Error' ? error.name + ': ' : '') + text
    }
    return String(error)
  }

  function describe(value) {
    if (typeof Element !== 'undefined' && value instanceof Element) {
      var text = (value.textContent || '').replace(/\s+/g, ' ').trim()
      return '<' + value.tagName.toLowerCase() + '>' + (text ? ' "' + text.slice(0, 60) + '"' : '')
    }
    if (typeof value === 'function') return value.name ? 'function ' + value.name : 'a function'
    if (typeof value === 'string') return JSON.stringify(value)
    if (value === undefined) return 'undefined'
    try {
      var json = JSON.stringify(value)
      return json === undefined ? String(value) : json.length > 200 ? json.slice(0, 200) + '…' : json
    } catch (e) {
      return String(value)
    }
  }

  function deepEqual(a, b) {
    if (Object.is(a, b)) return true
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
    if (Array.isArray(a) !== Array.isArray(b)) return false
    var ka = Object.keys(a), kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    for (var i = 0; i < ka.length; i++) if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !deepEqual(a[ka[i]], b[ka[i]])) return false
    return true
  }

  var normalise = function (text) { return text.replace(/\s+/g, ' ').trim() }
  var matches = function (text, pattern) { return pattern instanceof RegExp ? pattern.test(text) : text === normalise(String(pattern)) }

  globalThis.__devprepRunReact = async function (payload, post) {
    var doc = globalThis.document
    var output = []
    var outputLength = 0
    var write = function (line) {
      if (outputLength > OUTPUT_LIMIT) return
      outputLength += line.length + 1
      output.push(outputLength > OUTPUT_LIMIT ? line.slice(0, Math.max(0, line.length - (outputLength - OUTPUT_LIMIT))) + '…' : line)
    }
    var format = function (args) {
      return Array.prototype.map.call(args, function (arg) { return typeof arg === 'string' ? arg : describe(arg) }).join(' ')
    }

    // Console output is captured; the network is blocked (the iframe's CSP blocks it too).
    var saved = { log: console.log, info: console.info, warn: console.warn, error: console.error, fetch: globalThis.fetch, XMLHttpRequest: globalThis.XMLHttpRequest, WebSocket: globalThis.WebSocket }
    console.log = function () { write(format(arguments)) }
    console.info = console.log
    console.warn = function () { write('warn: ' + format(arguments)) }
    console.error = function () { write('error: ' + format(arguments)) }
    var offline = function () { throw new TypeError('Network access is disabled in exercises. Pass data in through props instead.') }
    globalThis.fetch = function () { return Promise.reject(new TypeError('Network access is disabled in exercises. Pass data in through props instead.')) }
    globalThis.XMLHttpRequest = offline
    globalThis.WebSocket = offline

    // Loop guard: compiled loops call __guard(), which throws once the current test is over its time limit.
    var deadline = Infinity
    var spins = 0
    var guard = function () {
      if ((++spins & 1023) === 0 && Date.now() > deadline) throw new Error('Time limit exceeded: a loop ran for too long.')
    }

    var defs = Object.assign({}, payload.sources, payload.modules)
    var cache = {}
    var tests = []
    var roots = []
    var uncaught = []
    var testing
    function load(name) {
      var key = name.replace(/\.[jt]sx?$/, '')
      if (key === './testing') return testing
      if (cache[key]) return cache[key].exports
      if (!Object.prototype.hasOwnProperty.call(defs, key)) throw new Error("Cannot find module '" + name + "'. Exercises can import react, react-dom, react-dom/client and ./App.")
      var module = { exports: {} }
      cache[key] = module
      new Function('require', 'module', 'exports', '__guard', defs[key])(load, module, module.exports, guard)
      return module.exports
    }

    var tick = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms || 0) }) }
    var settle = async function () { await tick(0); await tick(0) }

    // The off-screen #tests root is aria-hidden for the parent page; only hiding inside it counts.
    var visible = function (element) { var hidden = element.closest('[hidden], [aria-hidden="true"]'); return !hidden || hidden.contains(mountRoot) }
    var ownText = function (element) {
      var text = ''
      element.childNodes.forEach(function (node) { if (node.nodeType === 3) text += node.textContent })
      return normalise(text)
    }
    var IMPLICIT = {
      button: 'button, input[type=button], input[type=submit], input[type=reset]',
      textbox: 'input:not([type]), input[type=text], input[type=email], input[type=search], input[type=tel], input[type=url], textarea',
      checkbox: 'input[type=checkbox]',
      radio: 'input[type=radio]',
      spinbutton: 'input[type=number]',
      combobox: 'select',
      heading: 'h1, h2, h3, h4, h5, h6',
      link: 'a[href]',
      list: 'ul, ol',
      listitem: 'li',
      img: 'img[alt]',
      form: 'form[aria-label], form[aria-labelledby]',
      dialog: 'dialog',
      navigation: 'nav',
      article: 'article',
    }
    // A label's text, without the text of controls inside it (a wrapped <select> would otherwise add its options).
    var labelContent = function (label) {
      var copy = label.cloneNode(true)
      copy.querySelectorAll('select, textarea').forEach(function (control) { control.remove() })
      return copy.textContent || ''
    }
    var labelText = function (control) {
      var text = ''
      if (control.id) doc.querySelectorAll('label[for="' + control.id + '"]').forEach(function (label) { text += labelContent(label) })
      var wrapping = control.closest('label')
      if (wrapping) text += labelContent(wrapping)
      return normalise(text)
    }
    var accessibleName = function (element) {
      var aria = element.getAttribute('aria-label')
      if (aria) return normalise(aria)
      var by = element.getAttribute('aria-labelledby')
      if (by) return normalise(by.split(/\s+/).map(function (id) { var target = doc.getElementById(id); return target ? target.textContent : '' }).join(' '))
      if (element.matches('input, textarea, select')) {
        var label = labelText(element)
        if (label) return label
        if (element.matches('input[type=button], input[type=submit], input[type=reset]')) return normalise(element.value)
        return normalise(element.getAttribute('placeholder') || '')
      }
      if (element.matches('img')) return normalise(element.getAttribute('alt') || '')
      return normalise(element.textContent || '')
    }
    var byRole = function (role, options) {
      var selector = '[role="' + role + '"]' + (IMPLICIT[role] ? ', ' + IMPLICIT[role] : '')
      return Array.prototype.filter.call(doc.body.querySelectorAll(selector), function (element) {
        if (!visible(element)) return false
        var explicit = element.getAttribute('role')
        if (explicit && explicit !== role) return false
        if (options && options.level && role === 'heading' && element.tagName !== 'H' + options.level) return false
        return !options || options.name === undefined || matches(accessibleName(element), options.name)
      })
    }
    var byText = function (text) {
      return Array.prototype.filter.call(doc.body.querySelectorAll('*'), function (element) {
        return !element.matches('script, style') && visible(element) && matches(ownText(element), text)
      })
    }
    var byLabel = function (text) {
      var found = []
      doc.body.querySelectorAll('label').forEach(function (label) {
        if (!matches(normalise(labelContent(label)), text)) return
        var control = label.htmlFor ? doc.getElementById(label.htmlFor) : label.querySelector('input, textarea, select')
        if (control && found.indexOf(control) < 0) found.push(control)
      })
      doc.body.querySelectorAll('[aria-label]').forEach(function (element) {
        if (matches(normalise(element.getAttribute('aria-label')), text) && found.indexOf(element) < 0) found.push(element)
      })
      return found
    }
    var byPlaceholder = function (text) {
      return Array.prototype.filter.call(doc.body.querySelectorAll('[placeholder]'), function (element) { return matches(element.getAttribute('placeholder'), text) })
    }
    var byTestId = function (id) { return Array.prototype.slice.call(doc.body.querySelectorAll('[data-testid="' + id + '"]')) }
    var what = {
      Text: function (text) { return 'text ' + describe(text) },
      Role: function (role, options) { return 'role "' + role + '"' + (options && options.name !== undefined ? ' named ' + describe(options.name) : '') },
      LabelText: function (text) { return 'label ' + describe(text) },
      PlaceholderText: function (text) { return 'placeholder ' + describe(text) },
      TestId: function (id) { return 'data-testid ' + describe(id) },
    }
    var finders = { Text: byText, Role: byRole, LabelText: byLabel, PlaceholderText: byPlaceholder, TestId: byTestId }
    var screen = {}
    Object.keys(finders).forEach(function (kind) {
      var find = finders[kind]
      screen['getBy' + kind] = function (a, b) {
        var found = find(a, b)
        if (found.length === 0) throw new Error('Unable to find an element with ' + what[kind](a, b) + '.')
        if (found.length > 1) throw new Error('Found ' + found.length + ' elements with ' + what[kind](a, b) + '; expected one. Use getAllBy' + kind + '.')
        return found[0]
      }
      screen['queryBy' + kind] = function (a, b) {
        var found = find(a, b)
        if (found.length > 1) throw new Error('Found ' + found.length + ' elements with ' + what[kind](a, b) + '; expected at most one.')
        return found[0] || null
      }
      screen['getAllBy' + kind] = function (a, b) {
        var found = find(a, b)
        if (found.length === 0) throw new Error('Unable to find any elements with ' + what[kind](a, b) + '.')
        return found
      }
      screen['queryAllBy' + kind] = function (a, b) { return find(a, b) }
      screen['findBy' + kind] = function (a, b) { return waitFor(function () { return screen['getBy' + kind](a, b) }) }
      screen['findAllBy' + kind] = function (a, b) { return waitFor(function () { return screen['getAllBy' + kind](a, b) }) }
    })

    var waitFor = async function (callback, options) {
      var limit = (options && options.timeout) || 1000
      var started = Date.now()
      for (;;) {
        try {
          return await callback()
        } catch (error) {
          if (Date.now() - started >= limit) throw error
        }
        await tick(20)
      }
    }

    var requireElement = function (element, action) {
      if (!element || typeof element !== 'object' || !element.dispatchEvent) throw new Error(action + ' needs an element, for example screen.getByRole(...).')
    }
    // Clicking a submit button dispatches "submit" directly, since the sandbox blocks real form submission.
    var click = async function (element) {
      requireElement(element, 'click')
      if (element.disabled) { await settle(); return }
      var submit = null
      var after = function (event) {
        var form = element.form || (element.closest && element.closest('form'))
        var isSubmit = form && (element.matches('button:not([type]), button[type=submit], input[type=submit]'))
        if (isSubmit && !event.defaultPrevented) submit = form
        if (isSubmit) event.preventDefault()
      }
      globalThis.addEventListener('click', after)
      try {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      } finally {
        globalThis.removeEventListener('click', after)
      }
      if (submit) {
        var event = typeof SubmitEvent === 'function' ? new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: element }) : new Event('submit', { bubbles: true, cancelable: true })
        submit.dispatchEvent(event)
      }
      await settle()
    }
    var setValue = function (element, value) {
      var proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
    }
    var type = async function (element, text) {
      requireElement(element, 'type')
      if (element.disabled || element.readOnly) { await settle(); return }
      element.focus()
      for (var i = 0; i < text.length; i++) {
        setValue(element, element.value + text[i])
        element.dispatchEvent(new Event('input', { bubbles: true }))
        await tick(0)
      }
      await settle()
    }
    var clear = async function (element) {
      requireElement(element, 'clear')
      setValue(element, '')
      element.dispatchEvent(new Event('input', { bubbles: true }))
      await settle()
    }
    var selectOption = async function (element, value) {
      requireElement(element, 'selectOption')
      setValue(element, value)
      element.dispatchEvent(new Event('change', { bubbles: true }))
      await settle()
    }
    var keyDown = async function (element, key) {
      requireElement(element, 'keyDown')
      element.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true }))
      await settle()
    }
    var submit = async function (form) {
      requireElement(form, 'submit')
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await settle()
    }

    var mountRoot = doc.getElementById('tests') || doc.body
    var flushSync
    var render = async function (ui) {
      var container = doc.createElement('div')
      mountRoot.appendChild(container)
      var root = load('react-dom/client').createRoot(container, {
        onUncaughtError: function (error) { uncaught.push(messageOf(error)) },
        onCaughtError: function () {},
        onRecoverableError: function () {},
      })
      roots.push({ root: root, container: container })
      flushSync(function () { root.render(ui) })
      await settle()
      return {
        container: container,
        rerender: async function (next) { flushSync(function () { root.render(next) }); await settle() },
        unmount: async function () { root.unmount(); await settle() },
      }
    }
    var cleanup = function () {
      roots.splice(0).forEach(function (entry) {
        try { entry.root.unmount() } catch (e) { /* already unmounted */ }
        entry.container.remove()
      })
    }

    var spy = function (impl) {
      var mock = function () {
        mock.calls.push(Array.prototype.slice.call(arguments))
        return impl ? impl.apply(this, arguments) : undefined
      }
      mock.calls = []
      return mock
    }

    var expect = function (actual) {
      var make = function (negate) {
        var check = function (pass, text) {
          if (pass === negate) throw new Error('Expected ' + describe(actual) + (negate ? ' not ' : ' ') + text)
        }
        var element = function (name) { if (!actual || !actual.nodeType) throw new Error(name + ' needs an element, but got ' + describe(actual) + '.') }
        var calls = function (name) { if (typeof actual !== 'function' || !Array.isArray(actual.calls)) throw new Error(name + ' needs a spy made with fn().') }
        return {
          toBe: function (expected) { check(Object.is(actual, expected), 'to be ' + describe(expected) + '.') },
          toEqual: function (expected) { check(deepEqual(actual, expected), 'to equal ' + describe(expected) + '.') },
          toBeTruthy: function () { check(!!actual, 'to be truthy.') },
          toBeFalsy: function () { check(!actual, 'to be falsy.') },
          toBeNull: function () { check(actual === null, 'to be null.') },
          toBeUndefined: function () { check(actual === undefined, 'to be undefined.') },
          toBeGreaterThan: function (n) { check(actual > n, 'to be greater than ' + n + '.') },
          toHaveLength: function (n) { check(actual != null && actual.length === n, 'to have length ' + n + ' (it has ' + (actual == null ? 'none' : actual.length) + ').') },
          toContain: function (item) { check(actual != null && actual.indexOf(item) >= 0, 'to contain ' + describe(item) + '.') },
          toMatch: function (pattern) { check(typeof actual === 'string' && (pattern instanceof RegExp ? pattern.test(actual) : actual.indexOf(pattern) >= 0), 'to match ' + String(pattern) + '.') },
          toBeInTheDocument: function () { check(!!actual && doc.body.contains(actual), 'to be in the document.') },
          toHaveTextContent: function (text) {
            element('toHaveTextContent')
            var content = normalise(actual.textContent || '')
            check(text instanceof RegExp ? text.test(content) : content.indexOf(normalise(String(text))) >= 0, 'to have text ' + describe(text) + ' (it has ' + describe(content) + ').')
          },
          toHaveValue: function (value) { element('toHaveValue'); check(actual.value === String(value), 'to have value ' + describe(String(value)) + ' (it has ' + describe(actual.value) + ').') },
          toBeChecked: function () { element('toBeChecked'); check(!!actual.checked, 'to be checked.') },
          toBeDisabled: function () { element('toBeDisabled'); check(!!actual.disabled, 'to be disabled.') },
          toHaveAttribute: function (name, value) {
            element('toHaveAttribute')
            check(actual.hasAttribute(name) && (value === undefined || actual.getAttribute(name) === String(value)), 'to have attribute ' + name + (value === undefined ? '' : '="' + value + '"') + '.')
          },
          toHaveFocus: function () { element('toHaveFocus'); check(doc.activeElement === actual, 'to have focus.') },
          toHaveBeenCalled: function () { calls('toHaveBeenCalled'); check(actual.calls.length > 0, 'to have been called.') },
          toHaveBeenCalledTimes: function (n) { calls('toHaveBeenCalledTimes'); check(actual.calls.length === n, 'to have been called ' + n + ' times (it was called ' + actual.calls.length + ').') },
          toHaveBeenCalledWith: function () {
            calls('toHaveBeenCalledWith')
            var args = Array.prototype.slice.call(arguments)
            check(actual.calls.some(function (call) { return deepEqual(call, args) }), 'to have been called with ' + describe(args) + ' (calls: ' + describe(actual.calls) + ').')
          },
        }
      }
      var matchers = make(false)
      matchers.not = make(true)
      return matchers
    }

    testing = {
      test: function (name, fn) { tests.push({ name: String(name), fn: fn }) },
      expect: expect,
      render: render,
      screen: screen,
      click: click,
      type: type,
      clear: clear,
      selectOption: selectOption,
      keyDown: keyDown,
      submit: submit,
      waitFor: waitFor,
      tick: async function (ms) { await tick(ms); await settle() },
      fn: spy,
    }
    testing.it = testing.test

    var onError = function (event) { uncaught.push(messageOf(event.error || event.message)); if (event.preventDefault) event.preventDefault() }
    var onRejection = function (event) { uncaught.push(messageOf(event.reason)); if (event.preventDefault) event.preventDefault() }
    globalThis.addEventListener('error', onError)
    globalThis.addEventListener('unhandledrejection', onRejection)
    var restore = function () {
      globalThis.removeEventListener('error', onError)
      globalThis.removeEventListener('unhandledrejection', onRejection)
      console.log = saved.log; console.info = saved.info; console.warn = saved.warn; console.error = saved.error
      globalThis.fetch = saved.fetch; globalThis.XMLHttpRequest = saved.XMLHttpRequest; globalThis.WebSocket = saved.WebSocket
    }

    var app
    try {
      flushSync = load('react-dom').flushSync
      deadline = Date.now() + payload.testTimeoutMs
      app = load('./App')
      load('./App.test')
    } catch (error) {
      restore()
      post({ type: 'result', result: { kind: 'error', error: messageOf(error), output: output.join('\n') } })
      return
    }
    post({ type: 'total', total: tests.length })
    var outcomes = []
    for (var index = 0; index < tests.length; index++) {
      var current = tests[index]
      var started = Date.now()
      var error
      var timer
      uncaught = []
      deadline = started + payload.testTimeoutMs
      try {
        await Promise.race([
          Promise.resolve().then(current.fn),
          new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error('Timed out after ' + payload.testTimeoutMs / 1000 + ' s. Is something waiting for an update that never comes?')) }, payload.testTimeoutMs) }),
        ])
        error = undefined
      } catch (failure) {
        error = messageOf(failure)
      }
      clearTimeout(timer)
      deadline = Infinity
      cleanup()
      if (uncaught.length) error = error ? error + '\nWhile rendering: ' + uncaught[0] : uncaught[0]
      outcomes.push(Object.assign({ name: 'App.test.tsx::' + current.name, file: 'App.test.tsx', pass: !error, ms: Date.now() - started }, error ? { error: error } : {}))
      post({ type: 'progress', done: index + 1 })
    }
    // Live preview: the default export, if it needs no props.
    var preview = payload.preview && doc.getElementById('preview')
    if (preview && typeof app.default === 'function') {
      try {
        var root = load('react-dom/client').createRoot(preview, { onUncaughtError: function (failure) { write('preview error: ' + messageOf(failure)) }, onCaughtError: function () {} })
        flushSync(function () { root.render(load('react').createElement(app.default)) })
        // The sandbox has no allow-forms, so a submit button click would do nothing: dispatch "submit" ourselves.
        preview.addEventListener('click', function (event) {
          var button = event.target && event.target.closest && event.target.closest('button:not([type]), button[type=submit], input[type=submit]')
          var form = button && (button.form || button.closest('form'))
          if (!form || event.defaultPrevented || button.disabled) return
          event.preventDefault()
          form.dispatchEvent(typeof SubmitEvent === 'function' ? new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button }) : new Event('submit', { bubbles: true, cancelable: true }))
        })
      } catch (failure) {
        write('preview error: ' + messageOf(failure))
      }
    }
    restore()
    post({ type: 'result', result: { kind: 'done', outcomes: outcomes, output: output.join('\n') } })
  }
})()
