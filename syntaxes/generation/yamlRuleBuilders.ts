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

export interface GeneratedGrammar {
    fileName: string;
    create: () => InjectionGrammar;
}

export interface EmbeddedLanguage {
    /** The suffix of the scope `meta.embedded.block.<suffix>`. */
    scopeSuffix: string;
    grammarScope: string;
}

/**
 * @param rules The rules that are applied within the injection selector (in the given order).
 * @param helperRules Rules that are only added to the repository, for being included by other rules (or other grammars).
 */
export function createInjectionGrammar({
    scopeName,
    comment,
    injectionSelector,
    rules,
    helperRules,
}: {
    scopeName: string;
    comment: string;
    injectionSelector: string;
    rules: Record<string, GrammarRule>;
    helperRules?: Record<string, GrammarRule>;
}): InjectionGrammar {
    return {
        $schema:
            "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
        scopeName,
        comment: `${comment} Generated via 'npm run generate-syntaxes' (see 'syntaxes/generation/'), do not edit manually.`,
        injectionSelector,
        patterns: Object.keys(rules).map((key) => ({ include: `#${key}` })),
        repository: { ...rules, ...helperRules },
    };
}

/**
 * A top-level section (`<key>:` at column 0, for any of the given keys) that is tokenized like normal yaml
 * but additionally gets the given scope name.
 */
export function getTopLevelSectionRule(
    keys: string[],
    rule: Required<Pick<GrammarRule, "name">> & Pick<GrammarRule, "comment">,
): GrammarRule {
    const { comment, name } = rule;

    return {
        ...(comment ? { comment } : {}),
        name,
        begin: `^(${keys.join("|")})[ \\t]*(:)(?=[ \\t]|$)`,
        while: "^(?=[ \\t]|#|$)",
        beginCaptures: getMapKeyCaptures(topLevelKey.firstCaptureGroup),
        patterns: [{ include: "source.yaml.1.2#block-node" }],
    };
}

/**
 * A literal block scalar (`<key>: |`) nested within another node, whose content is highlighted with the given patterns.
 */
export function getBlockScalarRule(
    key: string,
    content: BlockScalarContent,
): GrammarRule {
    return getBlockScalarRuleForPosition(nestedKey, key, content);
}

/**
 * A top-level literal block scalar (`<key>: |` at column 0), whose content is highlighted with the given patterns.
 */
export function getTopLevelBlockScalarRule(
    key: string,
    content: BlockScalarContent,
): GrammarRule {
    return getBlockScalarRuleForPosition(topLevelKey, key, content);
}

/**
 * A literal block scalar (`<key>: |`) nested within another node, whose content is highlighted with the grammar of the given language.
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
    const { prefix, firstCaptureGroup } = nestedKey;

    return {
        ...(comment ? { comment } : {}),
        ...(name ? { name } : {}),
        begin: `${prefix}(${key})[ \\t]*(:)[ \\t]+(${value})[ \\t]*$`,
        while: "\\G(?:\\1\\2|[ \\t]*$)",
        beginCaptures: {
            ...getMapKeyCaptures(firstCaptureGroup),
            [firstCaptureGroup + 2]: {
                name: "string.unquoted.plain.out.yaml",
            },
        },
        ...(patterns ? { patterns } : {}),
    };
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

type BlockScalarContent = Pick<
    GrammarRule,
    "contentName" | "patterns" | "comment"
>;

interface KeyPosition {
    /** The pattern preceding the key. */
    prefix: string;
    /** The capture group of the key (the following groups are used for the rest of the line). */
    firstCaptureGroup: number;
    /** The `while` condition for the content lines of a block scalar. */
    blockScalarWhile: string;
}

const topLevelKey: KeyPosition = {
    prefix: "^",
    firstCaptureGroup: 1,
    blockScalarWhile: "^(?=[ \\t]|$)",
};

/**
 * Within the built-in yaml grammar, the indentation is consumed by the grammar itself, so rules starting with `^` never match.
 * The prefix matches the indentation of a map key incl. the `- ` of sequence items (copied from the yaml grammar's `block-mapping`).
 * It captures the optional sequence item space in group 1 and the indentation in group 2.
 */
const nestedKey: KeyPosition = {
    prefix: "(?=((?<=[-?:]) )?+)\\G([ \\t]*+)",
    firstCaptureGroup: 3,
    blockScalarWhile: "\\G(?:\\1\\2(?=[ \\t])|[ \\t]*$)",
};

function getBlockScalarRuleForPosition(
    { prefix, firstCaptureGroup, blockScalarWhile }: KeyPosition,
    key: string,
    { comment, contentName, patterns }: BlockScalarContent,
): GrammarRule {
    return {
        ...(comment ? { comment } : {}),
        begin: `${prefix}(${key})[ \\t]*(:)[ \\t]+(\\|)([1-9]?[-+]?|[-+][1-9])[ \\t]*$`,
        while: blockScalarWhile,
        beginCaptures: {
            ...getMapKeyCaptures(firstCaptureGroup),
            [firstCaptureGroup + 2]: {
                name: "keyword.control.flow.block-scalar.literal.yaml",
            },
            [firstCaptureGroup + 3]: {
                name: "storage.modifier.chomping-indicator.yaml",
            },
        },
        ...(contentName ? { contentName } : {}),
        ...(patterns ? { patterns } : {}),
    };
}

function getMapKeyCaptures(firstCaptureGroup: number) {
    return {
        [firstCaptureGroup]: {
            name: "meta.map.key.yaml string.unquoted.plain.yaml entity.name.tag.yaml",
        },
        [firstCaptureGroup + 1]: {
            name: "punctuation.separator.map.value.yaml",
        },
    };
}
