import { Node, Project, SyntaxKind, type CallExpression, type Expression, type ObjectLiteralExpression } from "ts-morph";
import type { EndpointDef, EndpointKind } from "./types.js";
import { templateToPathPattern, unquote } from "./paths.js";

function capitalize(name: string): string {
  return name.length === 0 ? name : name[0]!.toUpperCase() + name.slice(1);
}

function hookNamesFor(name: string, kind: EndpointKind): string[] {
  const capitalized = capitalize(name);
  if (kind === "mutation") {
    return [`use${capitalized}Mutation`];
  }
  return [`use${capitalized}Query`, `useLazy${capitalized}Query`];
}

/** Unwraps `(expr)` -> `expr`, e.g. the parens around an arrow function's `({...})` body. */
function unwrapParens(node: Node | undefined): Node | undefined {
  let current = node;
  while (current && Node.isParenthesizedExpression(current)) {
    current = current.getExpression();
  }
  return current;
}

/** Resolves an arrow/function expression's returned expression, whether block- or expression-bodied. */
function getReturnedExpression(fn: Node): Expression | undefined {
  if (!Node.isArrowFunction(fn) && !Node.isFunctionExpression(fn)) {
    return undefined;
  }
  const body = fn.getBody();
  if (Node.isBlock(body)) {
    for (const statement of body.getStatements()) {
      if (Node.isReturnStatement(statement)) {
        return unwrapParens(statement.getExpression()) as Expression | undefined;
      }
    }
    return undefined;
  }
  return unwrapParens(body) as Expression;
}

/** Extracts a URL string/template literal's raw (unquoted, un-normalized) text. */
function literalUrlText(expr: Node): string | undefined {
  if (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr) || Node.isTemplateExpression(expr)) {
    return unquote(expr.getText());
  }
  return undefined;
}

/** Extracts {method, url} from the object passed to `query:` in an endpoint definition. */
function extractMethodAndUrl(queryProp: Node): { method: string; url: string } | undefined {
  if (!Node.isArrowFunction(queryProp) && !Node.isFunctionExpression(queryProp)) {
    return undefined;
  }
  const returned = getReturnedExpression(queryProp);
  if (!returned) {
    return undefined;
  }

  const directUrl = literalUrlText(returned);
  if (directUrl !== undefined) {
    return { method: "GET", url: directUrl };
  }

  if (Node.isObjectLiteralExpression(returned)) {
    const urlProp = returned.getProperty("url");
    const urlInitializer = Node.isPropertyAssignment(urlProp) ? urlProp.getInitializer() : undefined;
    const url = urlInitializer ? literalUrlText(urlInitializer) : undefined;
    if (url === undefined) {
      return undefined;
    }

    const methodProp = returned.getProperty("method");
    const methodInitializer = Node.isPropertyAssignment(methodProp) ? methodProp.getInitializer() : undefined;
    const method = methodInitializer ? unquote(methodInitializer.getText()).toUpperCase() : "GET";
    return { method, url };
  }

  return undefined;
}

/** True when `call`'s generic args are exactly `<Key>ApiResponse`/`<Key>ApiArg` -- the real @rtk-query/codegen-openapi convention. See DECISIONS.md. */
function isCodegenShaped(call: CallExpression, name: string): boolean {
  const typeArgs = call.getTypeArguments();
  if (typeArgs.length < 2) {
    return false;
  }
  const capitalized = capitalize(name);
  return typeArgs[0]!.getText() === `${capitalized}ApiResponse` && typeArgs[1]!.getText() === `${capitalized}ApiArg`;
}

/** Finds the `endpoints: (builder) => ({...})` object literal in a createApi/injectEndpoints options argument. */
function getEndpointsObjectLiteral(optionsArg: Node): ObjectLiteralExpression | undefined {
  if (!Node.isObjectLiteralExpression(optionsArg)) {
    return undefined;
  }
  const endpointsProp = optionsArg.getProperty("endpoints");
  if (!Node.isPropertyAssignment(endpointsProp)) {
    return undefined;
  }
  const fn = endpointsProp.getInitializer();
  if (!fn) {
    return undefined;
  }
  const returned = getReturnedExpression(fn);
  return returned && Node.isObjectLiteralExpression(returned) ? returned : undefined;
}

function isEndpointsFactoryCall(call: CallExpression): boolean {
  const callee = call.getExpression();
  if (Node.isIdentifier(callee) && callee.getText() === "createApi") {
    return true;
  }
  if (Node.isPropertyAccessExpression(callee) && callee.getName() === "injectEndpoints") {
    return true;
  }
  return false;
}

/**
 * Pass A: finds every `createApi(...)`/`.injectEndpoints(...)` call and extracts each
 * `builder.query`/`builder.mutation` entry as an EndpointDef. Deliberately doesn't try to
 * resolve *which* variable/module the resulting api object is assigned to or re-exported
 * from -- Pass B matches hook calls by name globally (see DECISIONS.md), so none of that
 * bookkeeping is needed.
 */
export function discoverEndpoints(project: Project): EndpointDef[] {
  const endpoints: EndpointDef[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes(".stories.")) {
      continue;
    }

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (!isEndpointsFactoryCall(call)) {
        continue;
      }
      const [optionsArg] = call.getArguments();
      if (!optionsArg) {
        continue;
      }
      const endpointsObject = getEndpointsObjectLiteral(optionsArg);
      if (!endpointsObject) {
        continue;
      }

      for (const prop of endpointsObject.getProperties()) {
        if (!Node.isPropertyAssignment(prop)) {
          continue;
        }
        const name = prop.getName();
        const initializer = prop.getInitializer();
        if (!initializer || !Node.isCallExpression(initializer)) {
          continue;
        }
        const initializerCallee = initializer.getExpression();
        if (!Node.isPropertyAccessExpression(initializerCallee)) {
          continue;
        }
        const kind: EndpointKind | undefined = initializerCallee.getName() === "query" ? "query" : initializerCallee.getName() === "mutation" ? "mutation" : undefined;
        if (!kind) {
          continue;
        }

        const [configArg] = initializer.getArguments();
        const queryProp = configArg && Node.isObjectLiteralExpression(configArg) ? configArg.getProperty("query") : undefined;
        const queryInitializer = Node.isPropertyAssignment(queryProp) ? queryProp.getInitializer() : undefined;
        const methodAndUrl = queryInitializer ? extractMethodAndUrl(queryInitializer) : undefined;
        if (!methodAndUrl) {
          continue;
        }

        const codegen = isCodegenShaped(initializer, name);

        endpoints.push({
          name,
          kind,
          method: methodAndUrl.method,
          path: templateToPathPattern(methodAndUrl.url),
          ...(codegen ? { operationId: name } : {}),
          source: codegen ? "codegen" : "hand-written",
          file: sourceFile.getFilePath(),
          line: prop.getStartLineNumber(),
          hookNames: hookNamesFor(name, kind),
        });
      }
    }
  }

  return endpoints;
}
