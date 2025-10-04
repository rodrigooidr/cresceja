const fs = require("fs");
const path = require("path");

try {
  const lockNames = ["package-lock.json", "backend/package-lock.json", "frontend/package-lock.json"];
  for (const rel of lockNames) {
    const lockPath = path.join(process.cwd(), rel);
    if (!fs.existsSync(lockPath)) continue;
    const original = fs.readFileSync(lockPath, "utf8");
    const patched = original
      .replace(/ssh:\/\/git@github.com\//g, "https://github.com/")
      .replace(/git@github.com:/g, "https://github.com/")
      .replace(/git:\/\//g, "https://");
    if (patched !== original) {
      fs.writeFileSync(lockPath, patched);
      console.log("[root:preinstall-fix] normalizado:", rel);
    }
  }
} catch (e) {
  console.warn("[root:preinstall-fix] ignorando erro:", e?.message || e);
  process.exit(0);
}
