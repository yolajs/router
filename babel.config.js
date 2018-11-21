const BABEL_ENV = process.env.BABEL_ENV;
const building = BABEL_ENV != undefined && BABEL_ENV !== "cjs";

module.exports = {
  presets: [
    [
      "@babel/env",
      {
        loose: true,
        modules: building ? false : "commonjs",
        targets: {
          browsers: ["last 2 versions", "IE >= 11"]
        }
      }
    ],
    "@babel/react",
    "@babel/preset-typescript"
  ],
  plugins: ["@babel/proposal-object-rest-spread"]
};
