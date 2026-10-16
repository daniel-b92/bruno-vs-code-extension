import { readFileSync } from "fs";
import { resolve } from "path";

export interface ContributedGrammar {
    scopeName: string;
    /** Absolute path of the grammar file. */
    path: string;
    injectTo?: string[];
    embeddedLanguages?: Record<string, string>;
}

const extensionFolder = resolve(__dirname, "..", "..");

/** The grammars that the extension contributes via `contributes.grammars` in its `package.json`. */
export function getContributedGrammars(): ContributedGrammar[] {
    const { contributes } = JSON.parse(
        readFileSync(resolve(extensionFolder, "package.json"), "utf8"),
    ) as {
        contributes: {
            grammars: (Omit<ContributedGrammar, "path"> & { path: string })[];
        };
    };

    return contributes.grammars.map((grammar) => ({
        ...grammar,
        path: resolve(extensionFolder, grammar.path),
    }));
}
