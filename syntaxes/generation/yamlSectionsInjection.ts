import { embeddedLanguages } from "./embeddedLanguages";
import {
    createInjectionGrammar,
    GeneratedGrammar,
    getEmbeddedLanguageContent,
    getTopLevelBlockScalarRule,
    getTopLevelSectionRule,
} from "./yamlRuleBuilders";

export const yamlSectionsInjectionScope =
    "source.bruno.yaml-sections.injection";

/** Scope names for the sections, used as injection selectors by the more specific injection grammars. */
export const sectionScopes = {
    scripts: "meta.bruno.scripts-section.yaml",
    body: "meta.bruno.body-section.yaml",
    app: "meta.bruno.app-section.yaml",
    docs: "meta.bruno.docs-section.yaml",
};

/** Repository rule for Markdown content that can be included by other grammars. */
export const markdownContentRule = `${yamlSectionsInjectionScope}#markdown-content`;

export const yamlSectionsInjection: GeneratedGrammar = {
    fileName: "yaml-sections.injection.json",
    create: () =>
        createInjectionGrammar({
            scopeName: yamlSectionsInjectionScope,
            comment:
                "Marks top-level sections of Bruno yaml files that can contain embedded code blocks. The scopes added here are used as injection selectors by the more specific yaml injection grammars, so that those only apply within the expected sections and not to arbitrary yaml files. Top-level block scalars that contain code are highlighted directly here.",
            injectionSelector: "L:source.yaml",
            rules: {
                "scripts-section": getTopLevelSectionRule(
                    ["runtime", "request"],
                    { name: sectionScopes.scripts },
                ),
                "body-section": getTopLevelSectionRule(
                    ["http", "graphql", "grpc", "websocket", "examples"],
                    { name: sectionScopes.body },
                ),
                "app-section": getTopLevelSectionRule(["app"], {
                    comment: "The 'app' section of request files.",
                    name: sectionScopes.app,
                }),
                "docs-string": getTopLevelBlockScalarRule("docs", {
                    comment:
                        "Docs defined directly as a string (e.g. in request files).",
                    patterns: [{ include: "#markdown-content" }],
                }),
                "docs-section": getTopLevelSectionRule(["docs"], {
                    comment:
                        "Docs defined as a map with the fields 'content' and 'type' (e.g. in folder and collection settings files).",
                    name: sectionScopes.docs,
                }),
                "app-file-code": getTopLevelBlockScalarRule("code", {
                    comment: "Only app files have a top-level 'code' field.",
                    ...getEmbeddedLanguageContent(embeddedLanguages.html),
                }),
            },
            helperRules: {
                "markdown-content": {
                    comment:
                        "Markdown is indentation sensitive, so the indentation of the block scalar's content needs to be consumed before handing over to the markdown grammar (otherwise, everything would be an indented code block). Also used by the docs injection grammar.",
                    begin: "\\G([ \\t]+)(?=\\S)",
                    while: "\\G(?:\\1|[ \\t]*$)",
                    ...getEmbeddedLanguageContent(embeddedLanguages.markdown),
                },
            },
        }),
};
