import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";

const config = [
  {
    input: "packages/bin/i18n-cli.ts",
    output: [
      {
        file: "dist/main.esm.js",
        format: "es",
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
      }),
      json(),
    ],
  },
];
export default config;
