import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import ts from "typescript";

const repoRoot = resolve(import.meta.dirname, "..");
const scanRoots = [
  resolve(repoRoot, "apps/api/src/modules/tenant"),
  resolve(repoRoot, "apps/api/src/modules/pos"),
  resolve(repoRoot, "apps/api/src/modules/mobile"),
  resolve(repoRoot, "apps/api/src/modules/auth"),
  resolve(repoRoot, "apps/api/src/modules/media"),
  resolve(repoRoot, "apps/api/src/modules/notifications"),
];
const operationNames = new Set(["delete", "insert", "select", "update"]);
const reportAll = process.argv.includes("--report-all");
const ignoredFilePatterns = [
  /\.smoke\.ts$/,
  /\.integration\.ts$/,
  /\.routes\.ts$/,
];

function listTypeScriptFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return path.endsWith(".ts") &&
      !ignoredFilePatterns.some((pattern) => pattern.test(path))
      ? [path]
      : [];
  });
}

function findEnclosingStatement(node) {
  let current = node;

  while (current.parent && !ts.isStatement(current.parent)) {
    current = current.parent;
  }

  return current.parent && ts.isStatement(current.parent)
    ? current.parent
    : current;
}

function getOperation(node, sourceFile) {
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression)
  ) {
    return null;
  }

  const operation = node.expression.name.text;
  if (!operationNames.has(operation)) {
    return null;
  }

  const receiver = node.expression.expression.getText(sourceFile);
  if (!/^(?:db|tx|this\.db)$/.test(receiver)) {
    return null;
  }

  const statement = findEnclosingStatement(node);
  const statementText = statement.getText(sourceFile);
  const tableMatch =
    operation === "select"
      ? statementText.match(/\.from\(\s*([A-Za-z_$][\w$]*)\s*\)/)
      : node.arguments[0]?.getText(sourceFile);

  return {
    operation,
    table: Array.isArray(tableMatch)
      ? tableMatch[1]
      : (tableMatch ?? "unknown"),
    statement,
    statementText,
  };
}

const findings = [];

for (const filePath of scanRoots.flatMap(listTypeScriptFiles)) {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  function visit(node) {
    const operation = getOperation(node, sourceFile);
    const auditContext = operation
      ? sourceText.slice(
          Math.max(0, operation.statement.getStart(sourceFile) - 120),
          operation.statement.getEnd(),
        )
      : "";

    if (
      operation &&
      !/tenant(?:Id|_id)/i.test(operation.statementText) &&
      !/tenant-scope:\s*system/i.test(auditContext)
    ) {
      const location = sourceFile.getLineAndCharacterOfPosition(
        operation.statement.getStart(sourceFile),
      );
      findings.push({
        file: relative(repoRoot, filePath),
        line: location.line + 1,
        operation: operation.operation,
        table: operation.table,
        statement: operation.statementText.replace(/\s+/g, " ").slice(0, 240),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const blockingFindings = findings.filter((finding) =>
  ["delete", "update"].includes(finding.operation),
);

for (const finding of reportAll ? findings : blockingFindings) {
  console.log(
    `${finding.file}:${finding.line} ${finding.operation}(${finding.table}) ${finding.statement}`,
  );
}

console.log(
  `Tenant-scope audit: ${blockingFindings.length} unsafe mutations; ${findings.length} operations require RLS or helper-filter review.`,
);

if (blockingFindings.length > 0) {
  process.exitCode = 1;
}
