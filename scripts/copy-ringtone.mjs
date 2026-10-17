import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "sounds", "ringtone.mp3");
const target = join(root, "public", "audio", "ringtone.mp3");

let head = "";
try {
  head = readFileSync(source).subarray(0, 80).toString("utf8");
} catch {
  console.error("sounds/ringtone.mp3 is missing. Pull Git Large File Storage (LFS) before the build.");
  process.exit(1);
}

// LFS leaves a short pointer in the checkout until git lfs pull.
// Copying that pointer would make the header play silence.
if (head.startsWith("version https://git-lfs.github.com/spec/")) {
  console.error("sounds/ringtone.mp3 is a Git LFS pointer. Run git lfs pull before the build.");
  process.exit(1);
}

if (statSync(source).size < 1000) {
  console.error("sounds/ringtone.mp3 is too small to be the ringtone.");
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
