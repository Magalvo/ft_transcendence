// Downloads the MediaPipe face landmarker model into public/mediapipe/ so the
// app serves it from its own origin, and checks it against a pinned SHA-256.
//
//   node scripts/fetch-face-model.mjs             # fails if it can't get a valid model
//   node scripts/fetch-face-model.mjs --optional  # warns instead (used by predev)
//
// An existing file with the right digest is kept, so this runs offline once
// the model is there. The Dockerfile runs it before `npm run build`; the build
// itself never downloads anything.
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
export const FACE_MODEL_SHA256 =
  "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";

const MODEL_FILE = fileURLToPath(
  new URL("../public/mediapipe/face_landmarker.task", import.meta.url),
);

export function verifySha256(buffer, expectedHex) {
  const actual = createHash("sha256").update(buffer).digest("hex");
  return actual === String(expectedHex).toLowerCase();
}

async function hasValidModel() {
  try {
    return verifySha256(await readFile(MODEL_FILE), FACE_MODEL_SHA256);
  } catch {
    return false;
  }
}

async function fetchFaceModel() {
  if (await hasValidModel()) {
    console.log(`[face-model] ${MODEL_FILE} is up to date.`);
    return;
  }

  console.log(`[face-model] Downloading ${FACE_MODEL_URL}`);
  const response = await fetch(FACE_MODEL_URL);
  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (!verifySha256(data, FACE_MODEL_SHA256)) {
    throw new Error("checksum mismatch; refusing to use the downloaded model");
  }

  await mkdir(dirname(MODEL_FILE), { recursive: true });
  const tmpFile = `${MODEL_FILE}.download`;
  await writeFile(tmpFile, data);
  await rename(tmpFile, MODEL_FILE);
  console.log(`[face-model] Saved ${MODEL_FILE}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const optional = process.argv.includes("--optional");
  fetchFaceModel().catch((error) => {
    console.error(`[face-model] ${error.message}`);
    if (optional) {
      console.warn("[face-model] Face tracking will fail until the model is fetched.");
    } else {
      process.exitCode = 1;
    }
  });
}
