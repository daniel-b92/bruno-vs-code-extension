import { readFileSync } from "fs";
import { resolve } from "path";
import {
    INITIAL,
    IOnigLib,
    IRawGrammar,
    parseRawGrammar,
    Registry,
    StateStack,
} from "vscode-textmate";
import { loadWASM, OnigScanner, OnigString } from "vscode-oniguruma";

export interface Token {
    text: string;
    scopes: string[];
}

/**
 * Tokenizes the given Yaml content with the YAML grammar of VS Code and all injection grammars of this extension.
 * Embedded languages (Javascript, JSON, ...) are replaced by stub grammars (see {@link getStubGrammar}).
 * The GraphQL grammar of this extension is used as is.
 *
 * @returns The non-whitespace tokens for each line.
 */
export async function tokenizeYaml(content: string): Promise<Token[][]> {
    const grammar = await getRegistry().loadGrammar("source.yaml");
    if (!grammar) {
        throw new Error("Could not load the YAML grammar.");
    }

    let stack: StateStack = INITIAL;

    return content.split("\n").map((line) => {
        const { tokens, ruleStack } = grammar.tokenizeLine(line, stack);
        stack = ruleStack;

        return tokens
            .map(({ startIndex, endIndex, scopes }) => ({
                text: line.substring(startIndex, endIndex),
                scopes,
            }))
            .filter(({ text }) => text.trim().length > 0);
    });
}

/**
 * Determines the language of each non-whitespace token from its innermost `meta.embedded.block.<language>` scope
 * (or `yaml`, if it does not have one).
 *
 * @returns For each line, the distinct languages of its tokens joined by `,` (an empty string for blank lines).
 */
export async function getLanguagesPerLine(content: string) {
    return (await tokenizeYaml(content)).map((tokens) =>
        [...new Set(tokens.map(({ scopes }) => getLanguage(scopes)))].join(","),
    );
}

/** Stub grammars only highlight double-quoted strings, so that an unclosed string can be used for testing leaks into following lines. */
export const stubStringScope = "string.quoted.stub";

const embeddedScopePrefix = "meta.embedded.block.";

const syntaxesFolder = resolve(__dirname, "..");
const yamlGrammarsFolder = resolve(__dirname, "grammars");

const grammarPaths: Record<string, string> = {
    "source.yaml": resolve(yamlGrammarsFolder, "yaml.tmLanguage.json"),
    "source.yaml.1.2": resolve(yamlGrammarsFolder, "yaml-1.2.tmLanguage.json"),
    "source.yaml.embedded": resolve(
        yamlGrammarsFolder,
        "yaml-embedded.tmLanguage.json",
    ),
    "source.graphql.bru": resolve(syntaxesFolder, "graphql.json"),
};

const injectionGrammarFileNames = [
    "injection.json",
    "yaml-document.injection.json",
    "yaml-sections.injection.json",
    "yaml-scripts.injection.json",
    "yaml-bodies.injection.json",
    "yaml-docs.injection.json",
    "yaml-app.injection.json",
];

const stubbedGrammarScopes = [
    "source.js",
    "source.json",
    "text.xml",
    "text.html.basic",
    "text.html.markdown",
    "source.sparql",
];

let registry: Registry | undefined;

function getRegistry() {
    if (!registry) {
        const injectionScopes = injectionGrammarFileNames.map((fileName) => {
            const path = resolve(syntaxesFolder, fileName);
            const { scopeName } = JSON.parse(readFileSync(path, "utf8")) as {
                scopeName: string;
            };
            grammarPaths[scopeName] = path;
            return scopeName;
        });

        registry = new Registry({
            onigLib: loadOnigLib(),
            loadGrammar: async (scopeName) => {
                if (stubbedGrammarScopes.includes(scopeName)) {
                    return getStubGrammar(scopeName);
                }
                const path = grammarPaths[scopeName];
                return path
                    ? parseRawGrammar(readFileSync(path, "utf8"), path)
                    : null;
            },
            getInjections: (scopeName) =>
                scopeName == "source.yaml" ? injectionScopes : [],
        });
    }

    return registry;
}

async function loadOnigLib(): Promise<IOnigLib> {
    const wasm = readFileSync(
        require.resolve("vscode-oniguruma/release/onig.wasm"),
    );
    await loadWASM(
        wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
    );

    return {
        createOnigScanner: (patterns) => new OnigScanner(patterns),
        createOnigString: (content) => new OnigString(content),
    };
}

function getStubGrammar(scopeName: string): IRawGrammar {
    return parseRawGrammar(
        JSON.stringify({
            scopeName,
            patterns: [{ begin: '"', end: '"', name: stubStringScope }],
        }),
        `${scopeName}.json`,
    );
}

function getLanguage(scopes: string[]) {
    const embeddedScope = scopes.findLast((scope) =>
        scope.startsWith(embeddedScopePrefix),
    );
    return embeddedScope
        ? embeddedScope.substring(embeddedScopePrefix.length)
        : "yaml";
}
