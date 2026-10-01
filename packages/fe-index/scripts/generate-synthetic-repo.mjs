// Generates a synthetic frontend repo on disk to measure fe-index's indexing performance
// against something closer to a real repo's file count than the small demo-frontend
// fixture. Not committed -- output goes to a gitignored directory. Run:
//   node scripts/generate-synthetic-repo.mjs [outDir] [fileCount]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] ?? path.join(here, "..", ".synthetic-repo"));
const fileCount = Number(process.argv[3] ?? 500);
const endpointCount = 20;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, "src", "components"), { recursive: true });

writeFileSync(
  path.join(outDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        isolatedModules: true,
        noEmit: true,
      },
      include: ["src"],
    },
    null,
    2,
  ),
);

function capitalize(name) {
  return name[0].toUpperCase() + name.slice(1);
}

const endpointNames = Array.from({ length: endpointCount }, (_, i) => `getItem${i}`);
const endpointDefs = endpointNames
  .map(
    (name) => `    ${name}: builder.query<{ item: { id: string; label: string; count: number } }, string>({
      query: (id) => \`/items/${name}/\${id}\`,
    }),`,
  )
  .join("\n");
const hookExports = endpointNames.map((name) => `use${capitalize(name)}Query`).join(", ");

writeFileSync(
  path.join(outDir, "src", "api.ts"),
  `import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
${endpointDefs}
  }),
});

export const { ${hookExports} } = api;
`,
);

for (let i = 0; i < fileCount; i++) {
  const endpointName = endpointNames[i % endpointCount];
  const hookName = `use${capitalize(endpointName)}Query`;
  const componentName = `Component${String(i).padStart(4, "0")}`;
  writeFileSync(
    path.join(outDir, "src", "components", `${componentName}.tsx`),
    `import { ${hookName} } from "../api";

export function ${componentName}({ id }: { id: string }) {
  const { data } = ${hookName}(id);
  if (!data) {
    return null;
  }
  return (
    <div>
      <span>{data.item.label}</span>
      <span>{data.item.count}</span>
    </div>
  );
}
`,
  );
}

console.log(`Generated ${fileCount} components + ${endpointCount} endpoints at ${outDir}`);
