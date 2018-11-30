const fs = require("fs");
const execSync = require("child_process").execSync;
const prettyBytes = require("pretty-bytes");
const gzipSize = require("gzip-size");

const exec = (command, extraEnv) =>
  execSync(command, {
    stdio: "inherit",
    env: Object.assign({}, process.env, extraEnv)
  });

console.log("\nBuilding ES modules ...");
exec(
  'babel src -d es --ignore **/*.test.js,**/*.test.tsx --extensions ".ts,.tsx"',
  {
    BABEL_ENV: "es"
  }
);

console.log("Building CommonJS modules ...");
exec(
  'babel src -d . --ignore **/*.test.js,**/*.test.tsx --extensions ".ts,.tsx"',
  {
    BABEL_ENV: "cjs"
  }
);

console.log("\nBuilding UMD ...");
exec("rollup -c -f umd -o umd/yolajs-router.js", {
  BABEL_ENV: "umd",
  NODE_ENV: "development"
});

console.log("\nBuilding UMD min.js ...");
exec("rollup -c -f umd -o umd/yolajs-router.min.js", {
  BABEL_ENV: "umd",
  NODE_ENV: "production"
});

console.log("\nBuilding declaration file index.d.ts ...");
exec("tsc", {
  NODE_ENV: "production"
});

const size = gzipSize.sync(fs.readFileSync("umd/yolajs-router.min.js"));
console.log("\ngzipped, the UMD build is %s", prettyBytes(size));
