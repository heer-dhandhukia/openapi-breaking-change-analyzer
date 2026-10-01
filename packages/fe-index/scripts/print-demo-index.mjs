import path from "node:path";
import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { buildFeIndex } from "../dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const tsConfigFilePath = path.join(here, "..", "..", "..", "fixtures", "demo-frontend", "tsconfig.json");

const project = new Project({ tsConfigFilePath });
const index = buildFeIndex(project);

console.log(JSON.stringify(index, null, 2));
