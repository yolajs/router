import babel from "rollup-plugin-babel";
import { uglify } from "rollup-plugin-uglify";
import replace from "rollup-plugin-replace";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import typescript from "rollup-plugin-typescript";

const config = {
  input: "src/index.tsx",
  output: {
    name: "SwitchRouter",
    globals: {
      react: "React",
      "react-dom": "ReactDOM"
    }
  },
  external: ["react", "react-dom"],
  plugins: [
    babel({
      exclude: "node_modules/**",
      extensions: [".js", ".ts", ".tsx"]
    }),
    resolve(),
    commonjs({
      include: /node_modules/
    }),
    replace({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
    })
  ]
};

if (process.env.NODE_ENV === "production") {
  config.plugins.push(
    uglify({
      compress: {
        conditionals: false,
        sequences: false,
        loops: false,
        join_vars: false,
        collapse_vars: false,
        pure_funcs: ["Object.defineProperty"]
      }
    })
  );
  config.plugins.push(
    uglify({
      compress: {
        collapse_vars: true,
        evaluate: true,
        unsafe: true,
        loops: false,
        keep_fargs: false,
        pure_getters: true,
        unused: true,
        dead_code: true
      }
    })
  );
}

export default config;
