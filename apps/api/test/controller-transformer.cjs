const ts = require('typescript');

// Babel's legacy decorator transform leaves Nest parameter decorators intact.
// Use the installed TypeScript compiler for controllers; retain Babel/Jest mock
// hoisting for the rest of the API tests.
module.exports = {
  process(sourceText, sourcePath) {
    const result = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
        esModuleInterop: true,
        sourceMap: true,
      },
    });
    return { code: result.outputText, map: result.sourceMapText };
  },
};
