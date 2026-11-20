import { embeddedLanguages } from "./embeddedLanguages";
import {
    createInjectionGrammar,
    GeneratedGrammar,
    getBlockScalarRule,
    getEmbeddedLanguageBlockScalarRule,
} from "./yamlRuleBuilders";
import { markdownContentRule, sectionScopes } from "./yamlSectionsInjection";

export const yamlScriptsInjection: GeneratedGrammar = {
    fileName: "yaml-scripts.injection.json",
    create: () =>
        createInjectionGrammar({
            scopeName: "source.bruno.yaml-scripts.injection",
            comment:
                "Highlights script code (block scalars) within the scripts sections of Bruno yaml files as Javascript.",
            injectionSelector: `L:${sectionScopes.scripts} -meta.embedded`,
            rules: {
                code: getEmbeddedLanguageBlockScalarRule(
                    "code",
                    embeddedLanguages.javascript,
                ),
            },
        }),
};

export const yamlDocsInjection: GeneratedGrammar = {
    fileName: "yaml-docs.injection.json",
    create: () =>
        createInjectionGrammar({
            scopeName: "source.bruno.yaml-docs.injection",
            comment:
                "Highlights the content of docs (block scalars) within the docs sections of Bruno yaml files as Markdown.",
            injectionSelector: `L:${sectionScopes.docs} -meta.embedded`,
            rules: {
                content: getBlockScalarRule("content", {
                    patterns: [{ include: markdownContentRule }],
                }),
            },
        }),
};

export const yamlAppInjection: GeneratedGrammar = {
    fileName: "yaml-app.injection.json",
    create: () =>
        createInjectionGrammar({
            scopeName: "source.bruno.yaml-app.injection",
            comment:
                "Highlights the code (block scalar) within the 'app' section of Bruno yaml request files as HTML.",
            injectionSelector: `L:${sectionScopes.app} -meta.embedded`,
            rules: {
                code: getEmbeddedLanguageBlockScalarRule(
                    "code",
                    embeddedLanguages.html,
                ),
            },
        }),
};
