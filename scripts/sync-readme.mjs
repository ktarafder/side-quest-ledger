import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function syncReadme(readme, formalModel, threatModel) {
  function section(markdown, title) {
    const heading = `## ${title}\n`;
    if (markdown.split(heading).length !== 2) throw new Error(`Expected one source section: ${title}`);
    const rest = markdown.slice(markdown.indexOf(heading) + heading.length);
    const end = rest.search(/^## /m);
    return (end < 0 ? rest : rest.slice(0, end)).trim();
  }
  function block(markdown, key, content) {
    const begin = `<!-- BEGIN GENERATED:${key} -->`;
    const end = `<!-- END GENERATED:${key} -->`;
    if (markdown.split(begin).length !== 2 || markdown.split(end).length !== 2) {
      throw new Error(`Expected one complete README marker pair: ${key}`);
    }
    const start = markdown.indexOf(begin);
    const finish = markdown.indexOf(end);
    if (finish < start) throw new Error(`Reversed README markers: ${key}`);
    return markdown.slice(0, start) + `${begin}\n\n${content}\n\n${end}` + markdown.slice(finish + end.length);
  }
  const scope = section(formalModel, "1. Scope and system boundary");
  if (!/```mermaid\n[\s\S]*?\n```/.test(scope)) throw new Error("Formal scope is missing its Mermaid boundary diagram");
  const boundaries = section(threatModel, "4. Trust boundaries and attack surface");
  const diagram = boundaries.match(/```mermaid\n[\s\S]*?\n```/);
  if (!diagram) throw new Error("Threat model is missing its trust-boundary diagram");
  let result = block(readme, "SCOPE", `## Scope and system boundary\n\nGenerated from the [formal model](docs/FORMAL_MODEL.md#1-scope-and-system-boundary).\n\n${scope}`);
  return block(result, "THREATS", `## Security boundaries\n\nGenerated from the [threat model](docs/THREAT_MODEL.md#4-trust-boundaries-and-attack-surface). This diagram shows the boundaries where client input, admission credentials, database access, and publication authority must be controlled.\n\n${diagram[0]}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check")) throw new Error("Usage: node scripts/sync-readme.mjs [--check]");
  const root = new URL("../", import.meta.url);
  const read = (path) => readFileSync(new URL(path, root), "utf8");
  const current = read("README.md");
  const generated = syncReadme(current, read("docs/FORMAL_MODEL.md"), read("docs/THREAT_MODEL.md"));
  if (args.includes("--check")) {
    if (current !== generated) {
      console.error("README scope or diagrams are stale. Run pnpm docs:sync and commit README.md.");
      process.exitCode = 1;
    } else console.log("README scope and diagrams match their canonical sources.");
  } else if (current !== generated) {
    writeFileSync(new URL("README.md", root), generated);
    console.log("Updated README scope and diagrams.");
  } else console.log("README scope and diagrams are already current.");
}
