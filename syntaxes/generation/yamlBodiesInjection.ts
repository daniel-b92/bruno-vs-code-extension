import { embeddedLanguages } from "./embeddedLanguages";
import {
    createInjectionGrammar,
    EmbeddedLanguage,
    GeneratedGrammar,
    getBlockScalarRule,
    getEmbeddedLanguageBlockScalarRule,
    getEmbeddedLanguageContent,
    getSiblingFieldsRegionRule,
    GrammarRule,
} from "./yamlRuleBuilders";
import { sectionScopes } from "./yamlSectionsInjection";

/** Body types (values of the `type` field) whose `data` field is highlighted with the grammar of the respective language. */
const highlightedBodyTypes = ["json", "xml", "sparql", "html"] as const;

const typedBodyScope = "meta.bruno.typed-body.yaml";

export const yamlBodiesInjection: GeneratedGrammar = {
    fileName: "yaml-bodies.injection.json",
    create: () =>
        createInjectionGrammar({
            scopeName: "source.bruno.yaml-bodies.injection",
            comment:
                "Highlights request bodies (block scalars) within the body sections of Bruno yaml files according to their language. For bodies whose language is determined by a sibling 'type' field, the language is taken from the 'type' field if it is defined before the 'data' field. Otherwise, it is guessed from the first line of the 'data' content, since TextMate grammars cannot look ahead to following lines.",
            injectionSelector: `L:${sectionScopes.body} -meta.embedded -${typedBodyScope}`,
            rules: {
                ...Object.fromEntries(
                    highlightedBodyTypes.map((type) => [
                        `${type}-body`,
                        getTypedBodyRule(type, embeddedLanguages[type]),
                    ]),
                ),
                "text-body": getTypedBodyRule("text", undefined, {
                    comment:
                        "Bodies with type 'text' are not highlighted. This region only prevents the language of their 'data' field from being guessed by '#untyped-data'.",
                }),
                "untyped-data": getUntypedDataRule(),
                "graphql-query": getEmbeddedLanguageBlockScalarRule(
                    "query",
                    embeddedLanguages.graphql,
                ),
                "graphql-variables": getEmbeddedLanguageBlockScalarRule(
                    "variables",
                    embeddedLanguages.json,
                ),
                "grpc-message": getEmbeddedLanguageBlockScalarRule(
                    "message",
                    embeddedLanguages.json,
                ),
            },
            helperRules: {
                "yaml-mapping-content": getYamlMappingContentRule(),
            },
        }),
};

function getTypedBodyRule(
    type: string,
    language: EmbeddedLanguage | undefined,
    additionalProps?: Pick<GrammarRule, "comment">,
): GrammarRule {
    return getSiblingFieldsRegionRule("type", type, {
        ...additionalProps,
        name: typedBodyScope,
        patterns: [
            ...(language
                ? [getEmbeddedLanguageBlockScalarRule("data", language)]
                : []),
            { include: "#yaml-mapping-content" },
        ],
    });
}

function getUntypedDataRule(): GrammarRule {
    return getBlockScalarRule("data", {
        comment:
            "A 'data' block scalar without a preceding 'type' field (e.g. because the 'type' field is defined after it). The language is guessed from the first non-empty line of the content.",
        patterns: [
            getGuessedLanguageRule("[{\\[]", embeddedLanguages.json),
            getGuessedLanguageRule(
                "(?i)<(?:!doctype[ \\t]+html|html)\\b",
                embeddedLanguages.html,
            ),
            getGuessedLanguageRule("<", embeddedLanguages.xml),
            getGuessedLanguageRule(
                "(?i)(?:prefix|base|select|construct|describe|ask)\\b",
                embeddedLanguages.sparql,
            ),
            {
                comment:
                    "Any other content is not highlighted. Prevents the following lines from being used for guessing the language.",
                begin: "\\G[ \\t]*(?=\\S)",
                while: "\\G",
                contentName: "string.unquoted.block.yaml",
            },
        ],
    });
}

/**
 * Highlights the remaining block scalar content with the given language, if the first non-empty line starts with the given pattern.
 */
function getGuessedLanguageRule(
    firstLineStart: string,
    language: EmbeddedLanguage,
): GrammarRule {
    return {
        begin: `\\G[ \\t]*(?=${firstLineStart})`,
        while: "\\G",
        ...getEmbeddedLanguageContent(language),
    };
}

function getYamlMappingContentRule(): GrammarRule {
    return {
        comment:
            "The same patterns that the built-in yaml grammar uses within block mappings, for tokenizing the sibling fields of a body's 'type' field.",
        patterns: [
            "source.yaml.1.2#block-map-key-double",
            "source.yaml#block-map-key-single",
            "source.yaml.1.2#block-map-key-plain",
            "source.yaml.1.2#block-map-key-explicit",
            "source.yaml.1.2#block-map-value",
            "source.yaml.1.2#flow-mapping",
            "source.yaml.1.2#flow-sequence",
            "source.yaml.1.2#presentation-detail",
        ].map((include) => ({ include })),
    };
}
