// Copies the MediaPipe wasm runtime from node_modules into public/mediapipe/wasm
// so the app serves it from its own origin. Runs before `vite` and `vite build`
// (predev/prebuild); the copy always matches the installed JS bundle.
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACKAGE_DIR = fileURLToPath(
  new URL("../node_modules/@mediapipe/tasks-vision/", import.meta.url),
);
const PUBLIC_WASM_DIR = fileURLToPath(new URL("../public/mediapipe/wasm/", import.meta.url));

// Replaces destDir with the files from sourceDir plus a version.json, which
// the tests use to catch a stale copy.
export async function copyMediapipeWasm(sourceDir, destDir, version) {
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });
  for (const file of await readdir(sourceDir)) {
    await copyFile(join(sourceDir, file), join(destDir, file));
  }
  await writeFile(join(destDir, "version.json"), `${JSON.stringify({ version })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { version } = JSON.parse(await readFile(join(PACKAGE_DIR, "package.json"), "utf8"));
  await copyMediapipeWasm(join(PACKAGE_DIR, "wasm"), PUBLIC_WASM_DIR, version);
  console.log(`[mediapipe] Copied wasm ${version} to ${PUBLIC_WASM_DIR}`);
}
