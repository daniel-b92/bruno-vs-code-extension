export interface GrammarRule {
    comment?: string;
    name?: string;
    contentName?: string;
    begin?: string;
    while?: string;
    beginCaptures?: Record<string, { name: string }>;
    patterns?: GrammarRule[];
    include?: string;
}

export interface InjectionGrammar {
    $schema: string;
    scopeName: string;
    comment: string;
    injectionSelector: string;
    patterns: GrammarRule[];
    repository: Record<string, GrammarRule>;
}

export const grammarSchemaUrl =
    "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json";

/**
 * Matches the indentation of a map key within the built-in yaml grammar (which consumes the indentation itself),
 * incl. the `- ` of sequence items. Copied from the yaml grammar's `block-mapping`.
 * Captures the optional sequence item space in group 1 and the indentation in group 2.
 */
const indentation = "(?=((?<=[-?:]) )?+)\\G([ \\t]*+)";
const blockScalarIndicator = "(\\|)([1-9]?[-+]?|[-+][1-9])";

const mapKeyScope =
    "meta.map.key.yaml string.unquoted.plain.yaml entity.name.tag.yaml";
const mapValueSeparatorScope = "punctuation.separator.map.value.yaml";

/**
 * A literal block scalar (`<key>: |`) whose content is highlighted with the given patterns.
 */
export function getBlockScalarRule(
    key: string,
    content: Pick<GrammarRule, "contentName" | "patterns" | "comment">,
): GrammarRule {
    const { comment, contentName, patterns } = content;

    return {
        ...(comment ? { comment } : {}),
        begin: `${indentation}(${key})[ \\t]*(:)[ \\t]+${blockScalarIndicator}[ \\t]*$`,
        while: "\\G(?:\\1\\2(?=[ \\t])|[ \\t]*$)",
        beginCaptures: {
            "3": { name: mapKeyScope },
            "4": { name: mapValueSeparatorScope },
            "5": { name: "keyword.control.flow.block-scalar.literal.yaml" },
            "6": { name: "storage.modifier.chomping-indicator.yaml" },
        },
        ...(contentName ? { contentName } : {}),
        ...(patterns ? { patterns } : {}),
    };
}

/**
 * A literal block scalar (`<key>: |`) whose content is highlighted with the grammar of the given language.
 */
export function getEmbeddedLanguageBlockScalarRule(
    key: string,
    language: EmbeddedLanguage,
): GrammarRule {
    return getBlockScalarRule(key, getEmbeddedLanguageContent(language));
}

/**
 * A region that starts with the line `<key>: <value>` and continues over the sibling lines (i.e. lines with the same indentation).
 */
export function getSiblingFieldsRegionRule(
    key: string,
    value: string,
    rule: Pick<GrammarRule, "name" | "patterns" | "comment">,
): GrammarRule {
    const { comment, name, patterns } = rule;

    return {
        ...(comment ? { comment } : {}),
        ...(name ? { name } : {}),
        begin: `${indentation}(${key})[ \\t]*(:)[ \\t]+(${value})[ \\t]*$`,
        while: "\\G(?:\\1\\2|[ \\t]*$)",
        beginCaptures: {
            "3": { name: mapKeyScope },
            "4": { name: mapValueSeparatorScope },
            "5": { name: "string.unquoted.plain.out.yaml" },
        },
        ...(patterns ? { patterns } : {}),
    };
}

export interface EmbeddedLanguage {
    /** The suffix of the scope `meta.embedded.block.<suffix>`. */
    scopeSuffix: string;
    grammarScope: string;
}

export function getEmbeddedLanguageContent({
    scopeSuffix,
    grammarScope,
}: EmbeddedLanguage): Pick<GrammarRule, "contentName" | "patterns"> {
    return {
        contentName: `meta.embedded.block.${scopeSuffix}`,
        patterns: [{ include: grammarScope }],
    };
}
