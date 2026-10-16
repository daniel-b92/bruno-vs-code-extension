import { createInjectionGrammar, GeneratedGrammar } from "./yamlRuleBuilders";

/** Scope name for the whole content of Bruno yaml files, used as injection selector by the sections injection grammar. */
export const brunoDocumentScope = "meta.bruno.document.yaml";

/** The top-level keys that Bruno yaml files (that can contain code blocks) start with. */
const firstLineKeys = ["info", "opencollection"];

export const yamlDocumentInjection: GeneratedGrammar = {
    fileName: "yaml-document.injection.json",
    create: () =>
        createInjectionGrammar({
            scopeName: "source.bruno.yaml-document.injection",
            comment:
                "Marks yaml files as Bruno files if their first line is one of the top-level keys that Bruno yaml files start with. All other Bruno yaml injection grammars only apply within this scope, so that they do not affect arbitrary yaml files. Bruno files whose first line is a different one (e.g. a comment) are therefore only highlighted as plain yaml.",
            injectionSelector: `L:source.yaml -${brunoDocumentScope}`,
            rules: {
                "bruno-document": {
                    comment:
                        "Covers the whole document, like the root rule of the yaml grammar ('\\A' only matches at the start of the first line).",
                    name: brunoDocumentScope,
                    begin: `\\A(?=(?:${firstLineKeys.join("|")})[ \\t]*:(?:[ \\t]|$))`,
                    while: "^",
                    patterns: [{ include: "source.yaml.1.2" }],
                },
            },
        }),
};
