import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const FRONTEND_ROOTS = ['apps/web', 'apps/mobile'];
const SOURCE_EXTENSION_PATTERN = /\.(?:ts|tsx)$/;

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function isAuthSignOutCall(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
    return false;
  }
  if (node.expression.name.text !== 'signOut') return false;

  const receiver = node.expression.expression;
  return ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'auth';
}

function hasExplicitScope(node) {
  const options = node.arguments[0];
  if (!options || !ts.isObjectLiteralExpression(options)) return false;

  return options.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) && propertyNameText(property.name) === 'scope',
  );
}

export function findScopeLessAuthSignOutCalls(filePath, source) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations = [];

  function visit(node) {
    if (isAuthSignOutCall(node) && !hasExplicitScope(node)) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      violations.push({
        filePath,
        line: position.line + 1,
        column: position.character + 1,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function listSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return SOURCE_EXTENSION_PATTERN.test(entry.name) ? [entryPath] : [];
  });
}

function main() {
  const violations = FRONTEND_ROOTS.flatMap((root) =>
    listSourceFiles(root).flatMap((filePath) =>
      findScopeLessAuthSignOutCalls(
        filePath.split(path.sep).join('/'),
        fs.readFileSync(filePath, 'utf8'),
      ),
    ),
  );

  if (!violations.length) {
    process.stdout.write('Auth sign-out scope guard passed.\n');
    return;
  }

  process.stderr.write('Auth sign-out scope guard failed.\n');
  for (const violation of violations) {
    process.stderr.write(
      `- ${violation.filePath}:${violation.line}:${violation.column} must pass an explicit local, global, or others scope.\n`,
    );
  }
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
