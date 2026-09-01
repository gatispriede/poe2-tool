// Minimal TypeScript require hook.
//
// The engine is authored in TypeScript for the React app; the CLI needs to run
// the exact same source without a build step and without adding a dependency.
// The repo already ships the `typescript` package, so we transpile on require.
// Types are erased, not checked — `npx tsc --noEmit` remains the type gate.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const cache = new Map();

function compile(module, filename) {
  let js = cache.get(filename);
  if (js === undefined) {
    const source = fs.readFileSync(filename, 'utf8');
    js = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2019,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        resolveJsonModule: true,
        jsx: ts.JsxEmit.React,
      },
      fileName: filename,
    }).outputText;
    cache.set(filename, js);
  }
  module._compile(js, filename);
}

require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

module.exports = { root: path.resolve(__dirname, '..', '..') };
