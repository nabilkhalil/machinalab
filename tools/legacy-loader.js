// Load site/app.js (and the js/ scripts it depends on, in index.html order) in a vm
// sandbox with a stubbed DOM and localStorage, and expose its model functions.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadLegacy(appPath, storedState = null) {
  const siteDir = path.dirname(appPath);
  const deps = ['params.js', 'model.js', 'validate.js', 'export.js'].map(f => path.join(siteDir, 'js', f)).filter(fs.existsSync);
  const source = fs.readFileSync(appPath, 'utf8').replace(/render\(\);\s*$/, '');
  const stubElement = { hidden: false, textContent: '', innerHTML: '', classList: { toggle() {} } };
  const sandbox = {
    // storedState: a string (saved under the pre-Stage-4 key) or a {key: string} map.
    localStorage: {
      getItem: key => (storedState && typeof storedState === 'object') ? (storedState[key] ?? null)
        : (key === 'machinalab-v1' ? storedState : null),
      setItem() {},
    },
    addEventListener() {},
    document: { querySelector: () => stubElement, querySelectorAll: () => [], addEventListener() {} },
    window: {},
    console, Math, Number, JSON, String,
  };
  sandbox.window = sandbox; // classic browser scripts share one global object
  vm.createContext(sandbox);
  for (const dep of deps) vm.runInContext(fs.readFileSync(dep, 'utf8'), sandbox, { filename: dep });
  vm.runInContext(source + ';this.__legacy={calc,trials,scores,live,state,defaults,get check(){return check},MachinaLab};', sandbox);
  return sandbox.__legacy;
}

module.exports = { loadLegacy };
