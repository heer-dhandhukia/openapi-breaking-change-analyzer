import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { buildFeIndex } from "./index.js";

// These cover RTK Query usage shapes that demo-frontend/MANIFEST.md deliberately don't
// exercise (useLazyXQuery, api.endpoints.x.initiate/select, an any-typed response). Rather
// than extend the committed demo-frontend fixture (MANIFEST.md is meant to stay stable --
// "later golden tests will rely on this"), these use small in-memory virtual source files.
// See DECISIONS.md.

function makeProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { strict: true, jsx: 4 /* react-jsx */ },
  });
}

// `@reduxjs/toolkit` isn't resolvable in this in-memory project, so createApi's real
// (unresolved-import) return type is `any` -- which would make every hook's `data` look
// any-typed regardless of the endpoint's own declared generics, defeating the point of the
// any-vs-concrete test below. So the hooks are hand-typed separately from the `createApi`
// call: Pass A only needs the structural `createApi(...)`/`builder.query<T, A>(...)` shape
// (unaffected by this), while Pass B's `data.getType().isAny()` check resolves against
// these explicit declarations instead.
const API_SOURCE = `
  import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

  export const api = createApi({
    reducerPath: "api",
    baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
    endpoints: (builder) => ({
      getWidget: builder.query<{ widget: { name: string } }, string>({
        query: (id) => \`/widgets/\${id}\`,
      }),
      getMystery: builder.query<any, void>({
        query: () => "/mystery",
      }),
    }),
  });

  export declare function useGetWidgetQuery(): { data?: { widget: { name: string } }; isLoading: boolean };
  export declare function useLazyGetWidgetQuery(): [(arg: string) => void, { data?: { widget: { name: string } }; isLoading: boolean }];
  export declare function useGetMysteryQuery(): { data?: any; isLoading: boolean };
`;

describe("fe-index: useLazyXQuery tuple shape", () => {
  it("finds the trigger call (mutation-arg) and traces `data` off the second tuple element (exact)", () => {
    const project = makeProject();
    project.createSourceFile("/api.ts", API_SOURCE);
    project.createSourceFile(
      "/Widget.tsx",
      `
        import { useLazyGetWidgetQuery } from "./api";

        export function Widget() {
          const [triggerGetWidget, { data }] = useLazyGetWidgetQuery();
          triggerGetWidget("123");
          return data?.widget.name;
        }
      `,
    );

    const index = buildFeIndex(project);
    const node = index.endpoints.find((n) => n.endpoint.name === "getWidget");
    expect(node).toBeDefined();
    const sites = node!.sites;

    expect(sites).toContainEqual(expect.objectContaining({ kind: "hook-call", symbol: "useLazyGetWidgetQuery", confidence: "exact" }));
    expect(sites).toContainEqual(expect.objectContaining({ kind: "mutation-arg", symbol: "triggerGetWidget", confidence: "exact" }));
    expect(sites).toContainEqual(expect.objectContaining({ kind: "field-access", symbol: "data.widget.name", confidence: "exact" }));
  });
});

describe("fe-index: api.endpoints.x.initiate/select structural access", () => {
  it("recognizes both accessors as hook-call sites tied to the right endpoint", () => {
    const project = makeProject();
    project.createSourceFile("/api.ts", API_SOURCE);
    project.createSourceFile(
      "/usage.ts",
      `
        import { api } from "./api";

        export function loadWidget(dispatch: (action: unknown) => void) {
          dispatch(api.endpoints.getWidget.initiate("123"));
          const selectWidget = api.endpoints.getWidget.select("123");
          return selectWidget;
        }
      `,
    );

    const index = buildFeIndex(project);
    const node = index.endpoints.find((n) => n.endpoint.name === "getWidget");
    expect(node).toBeDefined();
    const sites = node!.sites;

    expect(sites).toContainEqual(expect.objectContaining({ kind: "hook-call", symbol: "api.endpoints.getWidget.initiate", confidence: "exact" }));
    expect(sites).toContainEqual(expect.objectContaining({ kind: "hook-call", symbol: "api.endpoints.getWidget.select", confidence: "exact" }));
  });
});

describe("fe-index: any-typed response", () => {
  it("marks field access through an any-typed `data` as 'possible', never skipped", () => {
    const project = makeProject();
    project.createSourceFile("/api.ts", API_SOURCE);
    project.createSourceFile(
      "/Mystery.tsx",
      `
        import { useGetMysteryQuery } from "./api";

        export function Mystery() {
          const { data } = useGetMysteryQuery();
          return data.whatever.nested.field;
        }
      `,
    );

    const index = buildFeIndex(project);
    const node = index.endpoints.find((n) => n.endpoint.name === "getMystery");
    expect(node).toBeDefined();
    const sites = node!.sites;

    expect(sites).toContainEqual(expect.objectContaining({ kind: "hook-call", symbol: "useGetMysteryQuery", confidence: "exact" }));
    const fieldSite = sites.find((s) => s.kind === "field-access");
    expect(fieldSite).toBeDefined();
    expect(fieldSite?.confidence).toBe("possible");
  });
});
