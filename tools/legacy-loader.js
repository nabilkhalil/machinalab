// Load the legacy single-file app.js in a vm sandbox with a stubbed DOM and
// localStorage, without modifying it, and expose its model functions.
'use strict';
const fs = require('fs');
const vm = require('vm');

function loadLegacy(appPath) {
  const source = fs.readFileSync(appPath, 'utf8').replace(/render\(\);\s*$/, '');
  const stubElement = { hidden: false, textContent: '', innerHTML: '', classList: { toggle() {} } };
  const sandbox = {
    localStorage: { getItem: () => null, setItem() {} },
    document: { querySelector: () => stubElement, querySelectorAll: () => [], addEventListener() {} },
    window: {},
    console, Math, Number, JSON, String,
  };
  vm.createContext(sandbox);
  vm.runInContext(source + ';this.__legacy={calc,trials,scores,live,state,defaults,validation};', sandbox);
  return sandbox.__legacy;
}

module.exports = { loadLegacy };
