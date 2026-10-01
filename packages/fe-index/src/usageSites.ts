import {
  Node,
  Project,
  SyntaxKind,
  type ArrowFunction,
  type BindingElement,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type Identifier,
  type ObjectBindingPattern,
  type PropertyAccessExpression,
  type SourceFile,
} from "ts-morph";
import type { EndpointDef, FeUsageSite } from "./types.js";

type FunctionLike = ArrowFunction | FunctionExpression | FunctionDeclaration;

interface Ctx {
  endpointByHookName: Map<string, EndpointDef>;
  endpointByKey: Map<string, EndpointDef>;
  wrapperHookByName: Map<string, EndpointDef>;
  sitesByEndpoint: Map<EndpointDef, FeUsageSite[]>;
  storiesByFile: Map<string, Set<string>>; // component name -> story file paths (accumulated separately)
}

function pushSite(ctx: Ctx, endpoint: EndpointDef, site: FeUsageSite): void {
  const list = ctx.sitesByEndpoint.get(endpoint);
  if (list) {
    list.push(site);
  } else {
    ctx.sitesByEndpoint.set(endpoint, [site]);
  }
}

function siteLocation(node: Node): { file: string; line: number; column: number } {
  const start = node.getStartLineNumber();
  const pos = node.getSourceFile().getLineAndColumnAtPos(node.getStart());
  return { file: node.getSourceFile().getFilePath(), line: start, column: pos.column };
}

// --- Pass A.5: find custom hooks that just wrap a known RTK hook one level down --------

function bodyCallsKnownHook(fn: FunctionLike, ctx: Ctx): EndpointDef | undefined {
  const body = fn.getBody();
  if (!body) return undefined;
  let found: EndpointDef | undefined;
  body.forEachDescendant((node, traversal) => {
    if (Node.isCallExpression(node)) {
      const callee = node.getExpression();
      if (Node.isIdentifier(callee)) {
        const endpoint = ctx.endpointByHookName.get(callee.getText());
        if (endpoint) {
          found = endpoint;
          traversal.stop();
        }
      }
    }
  });
  return found;
}

export function discoverWrapperHooks(project: Project, endpointByHookName: Map<string, EndpointDef>): Map<string, EndpointDef> {
  const wrapperHookByName = new Map<string, EndpointDef>();

  for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes(".stories.")) continue;

    for (const fn of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
      const name = fn.getName();
      if (!name || endpointByHookName.has(name)) continue;
      const endpoint = bodyCallsKnownHook(fn, { endpointByHookName } as Ctx);
      if (endpoint) wrapperHookByName.set(name, endpoint);
    }

    for (const varDecl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const nameNode = varDecl.getNameNode();
      if (!Node.isIdentifier(nameNode)) continue;
      const name = nameNode.getText();
      if (endpointByHookName.has(name)) continue;
      const initializer = varDecl.getInitializer();
      if (!initializer || (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer))) continue;
      const endpoint = bodyCallsKnownHook(initializer, { endpointByHookName } as Ctx);
      if (endpoint) wrapperHookByName.set(name, endpoint);
    }
  }

  return wrapperHookByName;
}

// --- shared helpers ---------------------------------------------------------------------

function getEnclosingFunctionBody(node: Node): Node {
  let current: Node | undefined = node;
  while (current) {
    if (Node.isArrowFunction(current) || Node.isFunctionExpression(current) || Node.isFunctionDeclaration(current)) {
      return current.getBody() ?? current;
    }
    current = current.getParent();
  }
  return node.getSourceFile();
}

function findComponentFunction(sourceFile: SourceFile, componentName: string): FunctionLike | undefined {
  const fnDecl = sourceFile.getFunctions().find((f) => f.getName() === componentName);
  if (fnDecl) return fnDecl;

  for (const varDecl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nameNode = varDecl.getNameNode();
    if (Node.isIdentifier(nameNode) && nameNode.getText() === componentName) {
      const initializer = varDecl.getInitializer();
      if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
        return initializer;
      }
    }
  }
  return undefined;
}

function bindingElementSourceName(el: BindingElement): string {
  return el.getPropertyNameNode()?.getText() ?? el.getName();
}

// --- Pass B: field-access tracing ---------------------------------------------------------

interface TraceState {
  ctx: Ctx;
  endpoint: EndpointDef;
  confidence: "exact" | "possible";
}

function recordFieldAccess(state: TraceState, symbol: string, node: Node): void {
  pushSite(state.ctx, state.endpoint, { ...siteLocation(node), kind: "field-access", symbol, confidence: state.confidence });
}

function checkPassThroughAndRecurse(state: TraceState, chainNode: PropertyAccessExpression, fullSymbol: string): void {
  const jsxExpr = chainNode.getParent();
  if (!Node.isJsxExpression(jsxExpr)) return;
  const attr = jsxExpr.getParent();
  if (!Node.isJsxAttribute(attr)) return;
  const attrName = attr.getNameNode().getText();

  // JsxAttribute's parent is the JsxAttributes list, not the element -- go up one more.
  const opening = attr.getParent().getParent();
  if (!Node.isJsxOpeningElement(opening) && !Node.isJsxSelfClosingElement(opening)) return;
  const tagName = opening.getTagNameNode().getText();
  if (!/^[A-Z]/.test(tagName)) return; // only custom components, not intrinsic DOM tags

  const importDecl = chainNode
    .getSourceFile()
    .getImportDeclarations()
    .find((d) => d.getNamedImports().some((ni) => (ni.getAliasNode()?.getText() ?? ni.getName()) === tagName));
  if (!importDecl) return;
  const targetFile = importDecl.getModuleSpecifierSourceFile();
  if (!targetFile) return;

  const componentFn = findComponentFunction(targetFile, tagName);
  if (!componentFn) return;
  const [firstParam] = componentFn.getParameters();
  if (!firstParam) return;
  const paramNameNode = firstParam.getNameNode();
  if (!Node.isObjectBindingPattern(paramNameNode)) return;

  const bindingElement = paramNameNode.getElements().find((el) => bindingElementSourceName(el) === attrName);
  if (!bindingElement) return;

  traceScope(bindingElement.getName(), fullSymbol, componentFn.getBody() ?? componentFn, state.endpoint, confidenceFor(bindingElement, state.confidence), state.ctx);
}

function classifyIdentifierUse(state: TraceState, node: Identifier, symbolPrefix: string): void {
  const parent = node.getParent();

  if (Node.isJsxSpreadAttribute(parent) && parent.getExpression() === node) {
    recordFieldAccess({ ...state, confidence: "possible" }, symbolPrefix, node);
    return;
  }
  if ((Node.isSpreadAssignment(parent) || Node.isSpreadElement(parent)) && parent.getExpression() === node) {
    recordFieldAccess({ ...state, confidence: "possible" }, symbolPrefix, node);
    return;
  }

  if (!Node.isPropertyAccessExpression(parent) || parent.getExpression() !== node) {
    return; // bare reference (e.g. a truthiness check like `data &&`) -- nothing to record
  }

  let current: PropertyAccessExpression = parent;
  const suffix: string[] = [];
  for (;;) {
    const accessorName = current.getName();
    const afterCurrent = current.getParent();

    if ((accessorName === "map" || accessorName === "flatMap") && Node.isCallExpression(afterCurrent) && afterCurrent.getExpression() === current) {
      const preMapSymbol = [symbolPrefix, ...suffix].join(".");
      recordFieldAccess(state, preMapSymbol, current);
      const [callbackArg] = afterCurrent.getArguments();
      if (callbackArg && (Node.isArrowFunction(callbackArg) || Node.isFunctionExpression(callbackArg))) {
        const [firstParam] = callbackArg.getParameters();
        const paramNameNode = firstParam?.getNameNode();
        if (firstParam && paramNameNode && Node.isIdentifier(paramNameNode)) {
          traceScope(firstParam.getName(), `${preMapSymbol}[]`, callbackArg.getBody(), state.endpoint, state.confidence, state.ctx);
        }
      }
      return;
    }

    suffix.push(accessorName);
    const next = current.getParent();
    if (Node.isPropertyAccessExpression(next) && next.getExpression() === current) {
      current = next;
      continue;
    }
    break;
  }

  const fullSymbol = [symbolPrefix, ...suffix].join(".");
  recordFieldAccess(state, fullSymbol, current);
  checkPassThroughAndRecurse(state, current, fullSymbol);
}

function traceScope(trackedName: string, symbolPrefix: string, scope: Node, endpoint: EndpointDef, confidence: "exact" | "possible", ctx: Ctx): void {
  const state: TraceState = { ctx, endpoint, confidence };
  scope.forEachDescendant((node) => {
    if (Node.isIdentifier(node) && node.getText() === trackedName) {
      classifyIdentifierUse(state, node, symbolPrefix);
    }
  });
}

// --- Pass B: hook-call handling -----------------------------------------------------------

function traceMutationTrigger(triggerName: string, scope: Node, endpoint: EndpointDef, confidence: "exact" | "possible", ctx: Ctx): void {
  scope.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const callee = node.getExpression();
      if (Node.isIdentifier(callee) && callee.getText() === triggerName) {
        pushSite(ctx, endpoint, { ...siteLocation(node), kind: "mutation-arg", symbol: triggerName, confidence });
      }
    }
  });
}

function findDataBindingElement(pattern: ObjectBindingPattern): BindingElement | undefined {
  return pattern.getElements().find((el) => bindingElementSourceName(el) === "data");
}

/** any-typed data (e.g. an endpoint whose response type wasn't declared) can't be trusted -- downgrade to 'possible', never skip it. */
function confidenceFor(el: BindingElement, base: "exact" | "possible"): "exact" | "possible" {
  return base === "possible" || el.getType().isAny() ? "possible" : "exact";
}

function handleHookCall(call: CallExpression, endpoint: EndpointDef, isWrapper: boolean, hookNameUsed: string, ctx: Ctx): void {
  const baseConfidence: "exact" | "possible" = isWrapper ? "possible" : "exact";
  pushSite(ctx, endpoint, { ...siteLocation(call), kind: "hook-call", symbol: hookNameUsed, confidence: baseConfidence });

  const varDecl = call.getParent();
  if (!Node.isVariableDeclaration(varDecl)) return;
  const nameNode = varDecl.getNameNode();
  const scope = getEnclosingFunctionBody(call);

  if (Node.isObjectBindingPattern(nameNode)) {
    if (isWrapper) {
      // Can't trust the wrapper's return shape at all -- trace every destructured binding, always 'possible'.
      for (const el of nameNode.getElements()) {
        traceScope(el.getName(), el.getName(), scope, endpoint, "possible", ctx);
      }
      return;
    }
    const dataEl = findDataBindingElement(nameNode);
    if (dataEl) {
      traceScope(dataEl.getName(), dataEl.getName(), scope, endpoint, confidenceFor(dataEl, "exact"), ctx);
    }
    return;
  }

  if (Node.isArrayBindingPattern(nameNode)) {
    const elements = nameNode.getElements();
    const [first, second] = elements;
    if (first && Node.isBindingElement(first)) {
      const triggerName = first.getName();
      traceMutationTrigger(triggerName, scope, endpoint, baseConfidence, ctx);
    }
    if (second && Node.isBindingElement(second)) {
      const secondNameNode = second.getNameNode();
      if (Node.isObjectBindingPattern(secondNameNode)) {
        const dataEl = findDataBindingElement(secondNameNode);
        if (dataEl) {
          traceScope(dataEl.getName(), dataEl.getName(), scope, endpoint, confidenceFor(dataEl, baseConfidence), ctx);
        }
      }
    }
    return;
  }

  if (Node.isIdentifier(nameNode)) {
    traceScope(nameNode.getText(), nameNode.getText(), scope, endpoint, baseConfidence, ctx);
  }
}

// --- `api.endpoints.<key>.<accessor>(...)` structural access -----------------------------

function handleEndpointsPropertyAccess(call: CallExpression, ctx: Ctx): boolean {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return false;

  const endpointAccess = callee.getExpression();
  if (!Node.isPropertyAccessExpression(endpointAccess)) return false;

  const endpointsAccess = endpointAccess.getExpression();
  if (!Node.isPropertyAccessExpression(endpointsAccess) || endpointsAccess.getName() !== "endpoints") return false;

  const key = endpointAccess.getName();
  const endpoint = ctx.endpointByKey.get(key);
  if (!endpoint) return false;

  pushSite(ctx, endpoint, { ...siteLocation(call), kind: "hook-call", symbol: callee.getText(), confidence: "exact" });
  return true;
}

// --- stories -------------------------------------------------------------------------------

function findComponentsRenderedByStory(storyFile: SourceFile): string[] {
  return storyFile
    .getImportDeclarations()
    .flatMap((d) => d.getNamedImports().map((ni) => ni.getAliasNode()?.getText() ?? ni.getName()))
    .filter((name) => /^[A-Z]/.test(name));
}

// --- entry point -----------------------------------------------------------------------

export function findUsageSites(
  project: Project,
  endpoints: EndpointDef[],
): { sitesByEndpoint: Map<EndpointDef, FeUsageSite[]>; storiesByEndpoint: Map<EndpointDef, Set<string>> } {
  const endpointByHookName = new Map<string, EndpointDef>();
  const endpointByKey = new Map<string, EndpointDef>();
  for (const endpoint of endpoints) {
    endpointByKey.set(endpoint.name, endpoint);
    for (const hookName of endpoint.hookNames) {
      endpointByHookName.set(hookName, endpoint);
    }
  }
  const wrapperHookByName = discoverWrapperHooks(project, endpointByHookName);

  const ctx: Ctx = {
    endpointByHookName,
    endpointByKey,
    wrapperHookByName,
    sitesByEndpoint: new Map(),
    storiesByFile: new Map(),
  };

  // endpoint-def sites
  for (const endpoint of endpoints) {
    pushSite(ctx, endpoint, {
      file: endpoint.file,
      line: endpoint.line,
      column: 0,
      kind: "endpoint-def",
      symbol: endpoint.name,
      confidence: "exact",
    });
  }

  const componentToEndpoints = new Map<string, Set<EndpointDef>>();

  for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes(".stories.")) continue;

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();

      if (Node.isIdentifier(callee)) {
        const hookName = callee.getText();
        const directEndpoint = endpointByHookName.get(hookName);
        if (directEndpoint) {
          handleHookCall(call, directEndpoint, false, hookName, ctx);
          continue;
        }
        const wrapperEndpoint = wrapperHookByName.get(hookName);
        if (wrapperEndpoint) {
          handleHookCall(call, wrapperEndpoint, true, hookName, ctx);
          continue;
        }
        continue;
      }

      handleEndpointsPropertyAccess(call, ctx);
    }

    // Track which components this file defines, so stories can be attributed to endpoints
    // via "this story imports component X, which has sites from endpoint Y".
    for (const fn of sourceFile.getFunctions()) {
      const name = fn.getName();
      if (name) componentToEndpoints.set(name, componentToEndpoints.get(name) ?? new Set());
    }
  }

  // Now that all sites are collected, figure out which component each site's file
  // effectively belongs to isn't tracked directly -- instead, attribute stories by: a story
  // imports component X; X is defined in file F; F has usage sites for endpoint(s) E.
  // We approximate "defined in file F" by component name -> its own file's sites.
  const sitesByFile = new Map<string, EndpointDef[]>();
  for (const [endpoint, sites] of ctx.sitesByEndpoint) {
    for (const site of sites) {
      const list = sitesByFile.get(site.file) ?? [];
      if (!list.includes(endpoint)) list.push(endpoint);
      sitesByFile.set(site.file, list);
    }
  }

  const storiesByEndpoint = new Map<EndpointDef, Set<string>>();
  for (const sourceFile of project.getSourceFiles()) {
    if (!sourceFile.getFilePath().includes(".stories.")) continue;
    const importedComponents = findComponentsRenderedByStory(sourceFile);
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const named = importDecl.getNamedImports().map((ni) => ni.getAliasNode()?.getText() ?? ni.getName());
      if (!named.some((n) => importedComponents.includes(n))) continue;
      const targetFile = importDecl.getModuleSpecifierSourceFile();
      if (!targetFile) continue;
      const endpointsForFile = sitesByFile.get(targetFile.getFilePath()) ?? [];
      for (const endpoint of endpointsForFile) {
        const set = storiesByEndpoint.get(endpoint) ?? new Set();
        set.add(sourceFile.getFilePath());
        storiesByEndpoint.set(endpoint, set);
      }
    }
  }

  return { sitesByEndpoint: ctx.sitesByEndpoint, storiesByEndpoint };
}
