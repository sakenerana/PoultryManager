import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, "src", "generated", "appVersion.ts");

let version = "1.0.0";
let build = 0;

if (fs.existsSync(sourcePath)) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const versionMatch = source.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  const buildMatch = source.match(/APP_BUILD_NUMBER\s*=\s*(\d+)/);

  if (versionMatch) version = versionMatch[1];
  if (buildMatch) build = Number(buildMatch[1]) || 0;
}

const nextBuild = build + 1;
const nextVersion = `${version.split("+")[0]}+build.${nextBuild}`;

fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
fs.writeFileSync(
  sourcePath,
  `export const APP_VERSION = "${nextVersion}";\nexport const APP_BUILD_NUMBER = ${nextBuild};\n`,
  "utf8"
);

console.log(`Build version updated to ${nextVersion}`);
