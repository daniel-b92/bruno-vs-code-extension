import type { Options, Plugin } from "prettier";
import { format } from "prettier/standalone";
import * as babelPlugin from "prettier/plugins/babel";
import * as estreePlugin from "prettier/plugins/estree";
import * as typescriptPlugin from "prettier/plugins/typescript";
import * as yamlPlugin from "prettier/plugins/yaml";

type SupportedParser = "yaml" | "babel" | "typescript";

// The standalone build of Prettier doesn't include any parsers, so they need to be passed explicitly.
// This way, only the needed parsers get bundled instead of shipping the whole `prettier` package.
// The `estree` plugin contains the printer for JavaScript and TypeScript code.
const pluginsByParser: Record<SupportedParser, Plugin[]> = {
    yaml: [yamlPlugin],
    babel: [babelPlugin, estreePlugin as Plugin],
    typescript: [typescriptPlugin, estreePlugin as Plugin],
};

export function formatWithPrettier(
    text: string,
    options: Omit<Options, "parser" | "plugins"> & { parser: SupportedParser },
) {
    return format(text, {
        ...options,
        plugins: pluginsByParser[options.parser],
    });
}
