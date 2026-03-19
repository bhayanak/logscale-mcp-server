const esbuild = require("esbuild");
const path = require("path");

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const extensionBuild = {
  entryPoints: [path.resolve(__dirname, "src/extension.ts")],
  bundle: true,
  outfile: path.resolve(__dirname, "dist/extension.js"),
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
};

/** @type {import('esbuild').BuildOptions} */
const serverBuild = {
  entryPoints: [path.resolve(__dirname, "../server/src/index.ts")],
  bundle: true,
  outfile: path.resolve(__dirname, "dist/server.js"),
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
};

async function main() {
  if (isWatch) {
    const extCtx = await esbuild.context(extensionBuild);
    const srvCtx = await esbuild.context(serverBuild);
    await Promise.all([extCtx.watch(), srvCtx.watch()]);
    console.log("Watching for changes...");
  } else {
    await Promise.all([esbuild.build(extensionBuild), esbuild.build(serverBuild)]);
    console.log("Build complete: dist/extension.js + dist/server.js");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
