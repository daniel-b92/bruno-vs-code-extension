import {
    isPair,
    isScalar,
    isSeq,
    LineCounter,
    parseDocument,
    Scalar,
    visit,
} from "yaml";
import {
    BrunoFileType,
    Position,
    Range,
    TextDocumentHelper,
    YamlExpectedKeyInfo,
    YamlMapDescriptor,
    YamlParsingOptions,
} from "../../..";
import { parseRequestFile } from "./parseRequestFile";
import { parseFolderSettingsFile } from "./parseFolderSettingsFile";
import { parseCollectionSettingsFile } from "./parseCollectionSettingsFile";
import { parseYamlEnvironmentFile } from "./parseYamlEnvironmentFile";
import { parseAppFile } from "./parseAppFile";
import { getYamlIndentationStep } from "./getYamlIndentationStep";

/**
 * Where the cursor is within a Yaml file.
 * The `path` always consists of the keys leading to the respective position (sequence indices are dropped).
 */
export type YamlCursorContext =
    | {
          kind: "key";
          /** The map the cursor is in. Does not contain the key that is currently being typed. */
          descriptor: YamlMapDescriptor;
          /** The word being typed (or an empty range at the cursor). */
          replaceRange: Range;
          /**
           * The character index that the key needs to have within its line (after a leading `- `, if there is one).
           * May differ from the current position of the key, if the line has to be re-indented (see `reindentationRange`).
           */
          indentation: number;
          /**
           * The leading whitespace of the line, if it has to be replaced by `indentation` spaces.
           * This is the case, if the key is not positioned at a valid indentation for any map (e.g. because the cursor is too far in or out).
           */
          reindentationRange?: Range;
          /** The keys of the maps containing the cursor, e.g. `["http"]`. Empty for the top level. */
          path: string[];
      }
    | {
          kind: "value";
          /** The map containing the key that the value belongs to. */
          descriptor: YamlMapDescriptor;
          keyInfo?: YamlExpectedKeyInfo;
          /** The (partial) value being typed (or an empty range at the cursor). */
          replaceRange: Range;
          /** Whether the value directly follows the colon of the key, so that a separating space needs to be inserted before it. */
          isMissingSpaceAfterColon: boolean;
          /** Includes the key that the value belongs to, e.g. `["info", "seq"]`. */
          path: string[];
      }
    | {
          /** A `- ` item of a sequence that is not a sequence of maps (e.g. `info.tags`). */
          kind: "sequenceValue";
          replaceRange: Range;
          /** The keys leading to the sequence, e.g. `["info", "tags"]`. */
          path: string[];
          /** The scalar items that the sequence already contains (apart from the one being typed). */
          existingValues: string[];
      };

const PLACEHOLDER_KEY = "__bruAsCodeCompletion__";
const KEY_POSITION_REGEX = /^\s*(-\s+)?((?:\w[\w-]*)?)$/;
const VALUE_POSITION_REGEX = /^\s*(?:-\s+)?([\w-]+):(\s*)(\S*)$/;
const KEY_WITHOUT_VALUE_REGEX = /^(\s*(?:-\s+)?)[\w-]+:\s*(#.*)?$/;

/**
 * Finds out which Yaml map (and which part of it) the cursor belongs to.
 * Works with incomplete files (e.g. a half-typed key), because the cursor line gets patched into a syntactically valid key.
 *
 * @returns `undefined`, if the cursor is not in a position where a key or a value can be completed.
 */
export function getYamlCursorContext({
    docHelper,
    fileType,
    position,
}: {
    docHelper: TextDocumentHelper;
    fileType: BrunoFileType;
    position: Position;
}): YamlCursorContext | undefined {
    const { line, character } = position;
    if (line >= docHelper.getLineCount()) {
        return undefined;
    }

    const lineContent = docHelper.getLineByIndex(line);
    const textBeforeCursor = lineContent.substring(0, character);
    const textAfterCursor = lineContent.substring(character);

    const keyMatch = KEY_POSITION_REGEX.exec(textBeforeCursor);
    if (keyMatch && textAfterCursor.trim() == "") {
        return getContextForKeyPosition({
            docHelper,
            fileType,
            position,
            hasSequenceItemPrefix: keyMatch[1] != undefined,
            typedWord: keyMatch[2],
        });
    }

    const valueMatch = VALUE_POSITION_REGEX.exec(textBeforeCursor);
    return valueMatch
        ? getContextForValuePosition({
              docHelper,
              fileType,
              position,
              key: valueMatch[1],
              isMissingSpaceAfterColon: valueMatch[2] == "",
              typedWord: valueMatch[3],
          })
        : undefined;
}

/**
 * Determines the descriptors of maps that do not exist yet, but would be created by an insertion at the key position of the given context.
 * This allows finding out the expected keys of nested maps (or of the items of sequences of maps), before inserting them.
 * All maps are determined with a single parse of the document.
 *
 * @param probeCount The number of maps whose descriptors are to be determined.
 * @param getInsertedText Returns the text to insert (starting at the column of the key, with absolute indentation in subsequent lines).
 * For every map whose descriptor is to be determined, it needs to contain the respective probe key as the only key of the map.
 * @returns The descriptor for each probe key (in the same order), or `undefined` for probe keys that could not be found in any map.
 */
export function getYamlDescriptorsForInsertedMaps({
    docHelper,
    fileType,
    context: { replaceRange, indentation, reindentationRange },
    probeCount,
    getInsertedText,
}: {
    docHelper: TextDocumentHelper;
    fileType: BrunoFileType;
    context: Extract<YamlCursorContext, { kind: "key" }>;
    probeCount: number;
    getInsertedText: (probeKeys: string[]) => string;
}): (YamlMapDescriptor | undefined)[] {
    const { line, character } = replaceRange.start;
    const linePrefix = reindentationRange
        ? " ".repeat(indentation)
        : docHelper.getLineByIndex(line).substring(0, character);
    const probeKeys = Array.from(
        { length: probeCount },
        (_, index) => `${PLACEHOLDER_KEY}${index}`,
    );

    const descriptors = getDescriptorsForText(
        getTextWithReplacedLine(
            docHelper,
            line,
            `${linePrefix}${getInsertedText(probeKeys)}`,
        ),
        fileType,
    );

    return probeKeys.map((probeKey) => {
        const descriptor = descriptors.find(({ definedKeys }) =>
            definedKeys.some(({ key }) => key == probeKey),
        );

        return descriptor
            ? {
                  ...descriptor,
                  definedKeys: descriptor.definedKeys.filter(
                      ({ key }) => !probeKeys.includes(key),
                  ),
              }
            : undefined;
    });
}

function getContextForKeyPosition({
    docHelper,
    fileType,
    position: { line, character },
    hasSequenceItemPrefix,
    typedWord,
}: {
    docHelper: TextDocumentHelper;
    fileType: BrunoFileType;
    position: Position;
    hasSequenceItemPrefix: boolean;
    typedWord: string;
}): YamlCursorContext | undefined {
    const keyStart = character - typedWord.length;
    const args = {
        docHelper,
        fileType,
        line,
        typedWord,
        replaceRange: new Range(
            new Position(line, keyStart),
            new Position(line, character),
        ),
    };

    if (hasSequenceItemPrefix) {
        return getContextForKeyWithLinePrefix({
            ...args,
            linePrefix: docHelper.getLineByIndex(line).substring(0, keyStart),
        });
    }

    const lineContent = docHelper.getLineByIndex(line);
    // The patched key could end the block scalar (e.g. for a blank line left of its indentation), so the unpatched text needs to be checked as well.
    if (
        isInBlockScalar(docHelper.getText(), new Position(line, keyStart)) ||
        isInBlockScalar(
            getTextWithReplacedLine(
                docHelper,
                line,
                `${lineContent.substring(0, keyStart)}${typedWord || PLACEHOLDER_KEY}:`,
            ),
            new Position(line, keyStart),
        )
    ) {
        // The line is part of a multiline string (e.g. a script), so it must not be re-indented.
        return undefined;
    }

    for (const column of getCandidateColumnsForKey(args, keyStart)) {
        const context = getContextForKeyWithLinePrefix({
            ...args,
            linePrefix: " ".repeat(column),
        });

        if (context?.kind == "key") {
            return column == keyStart
                ? context
                : {
                      ...context,
                      reindentationRange: new Range(
                          new Position(line, 0),
                          new Position(line, keyStart),
                      ),
                  };
        }
    }

    return undefined;
}

/**
 * Determines the context for a key, if the given line starts with `linePrefix`, followed by the key.
 * For a `- ` item that is not part of a sequence of maps, a `sequenceValue` context is returned.
 */
function getContextForKeyWithLinePrefix({
    docHelper,
    fileType,
    line,
    linePrefix,
    typedWord,
    replaceRange,
}: {
    docHelper: TextDocumentHelper;
    fileType: BrunoFileType;
    line: number;
    linePrefix: string;
    typedWord: string;
    replaceRange: Range;
}): YamlCursorContext | undefined {
    const key = typedWord || PLACEHOLDER_KEY;
    const patchedText = getTextWithReplacedLine(
        docHelper,
        line,
        `${linePrefix}${key}:`,
    );

    const descriptors = getDescriptorsForText(patchedText, fileType);
    const pair = getPairAtLine(patchedText, line, key);
    const descriptor = findDescriptor(descriptors, line, key);

    if (descriptor && pair) {
        const { keyRange } = descriptor.definedKeys.find((defined) =>
            isKeyAtLine(defined, line, key),
        )!;
        const otherKeys = descriptor.definedKeys.filter(
            (defined) => !isKeyAtLine(defined, line, key),
        );

        if (
            otherKeys.some(
                ({ keyRange: { start } }) =>
                    start.character != keyRange.start.character,
            )
        ) {
            // The parser is error tolerant and may assign a key at an invalid indentation to a map (e.g. a key
            // at the indentation of the items of a preceding sequence is assigned to the map containing the sequence).
            return undefined;
        }

        return {
            kind: "key",
            descriptor: { ...descriptor, definedKeys: otherKeys },
            replaceRange,
            indentation: keyRange.start.character,
            path: pair.containingKeys,
        };
    }

    return linePrefix.trimStart().startsWith("-") && pair?.isSequenceItem
        ? {
              kind: "sequenceValue",
              replaceRange,
              path: pair.containingKeys,
              existingValues: pair.siblingScalars,
          }
        : undefined;
}

/**
 * Returns the columns at which a key in the given line could belong to a map, ordered by how well they fit the given column.
 * The candidates are the columns of the keys within the document and the column of a new nested map below a key without a value.
 * The best fit is the largest candidate that is not further in than the given column (like Yaml would interpret a dedented line).
 * If there is none, the closest candidate further in is used.
 */
function getCandidateColumnsForKey(
    {
        docHelper,
        fileType,
        line,
    }: { docHelper: TextDocumentHelper; fileType: BrunoFileType; line: number },
    column: number,
) {
    const candidates = getDescriptorsForText(
        getTextWithReplacedLine(docHelper, line, ""),
        fileType,
    )
        .flatMap(({ definedKeys }) => definedKeys)
        .map(({ keyRange: { start } }) => ({
            column: start.character,
            minColumn: start.character,
        }));

    const parentKeyColumn = getColumnOfPreviousKeyWithoutValue(docHelper, line);
    if (parentKeyColumn != undefined) {
        // Any position further in than the parent key would make the key part of a nested map.
        candidates.push({
            column: parentKeyColumn + getYamlIndentationStep(docHelper),
            minColumn: parentKeyColumn + 1,
        });
    }

    const fittingCandidates = candidates
        .filter(({ minColumn }) => minColumn <= column)
        .sort((a, b) => b.minColumn - a.minColumn);
    const candidatesFurtherIn = candidates
        .filter(({ minColumn }) => minColumn > column)
        .sort((a, b) => a.minColumn - b.minColumn);

    return [
        ...new Set(
            fittingCandidates
                .concat(candidatesFurtherIn)
                .map(({ column }) => column)
                // The document may not contain any keys yet (e.g. if it is empty), so the position of the cursor itself is the last resort.
                .concat(column),
        ),
    ];
}

/** Returns the column of the key in the last non-empty line before the given one, if that key has no value in the same line. */
function getColumnOfPreviousKeyWithoutValue(
    docHelper: TextDocumentHelper,
    line: number,
) {
    const previousLine = docHelper
        .getAllLines()
        .slice(0, line)
        .reverse()
        .find(
            ({ content }) =>
                content.trim() != "" && !content.trimStart().startsWith("#"),
        );
    const match = previousLine
        ? KEY_WITHOUT_VALUE_REGEX.exec(previousLine.content)
        : null;

    return match ? match[1].length : undefined;
}

/** Whether the given position is part of the content of a block scalar (e.g. a script defined via `code: |-`). */
function isInBlockScalar(text: string, position: Position) {
    const offset = new TextDocumentHelper(text).getOffsetForPosition(position);
    let result = false;

    visit(parseDocument(text), {
        Scalar(_, { type, range }) {
            if (
                (type == Scalar.BLOCK_LITERAL || type == Scalar.BLOCK_FOLDED) &&
                range &&
                range[0] < offset &&
                offset < range[1]
            ) {
                result = true;
                return visit.BREAK;
            }
            return undefined;
        },
    });

    return result;
}

function getTextWithReplacedLine(
    docHelper: TextDocumentHelper,
    line: number,
    newContent: string,
) {
    return docHelper.getFullTextWithReplacement(
        {
            lineIndex: line,
            startCharIndex: 0,
            endCharIndex: docHelper.getLineByIndex(line).length,
        },
        newContent,
    );
}

function getContextForValuePosition({
    docHelper,
    fileType,
    position: { line, character },
    key,
    isMissingSpaceAfterColon,
    typedWord,
}: {
    docHelper: TextDocumentHelper;
    fileType: BrunoFileType;
    position: Position;
    key: string;
    isMissingSpaceAfterColon: boolean;
    typedWord: string;
}): YamlCursorContext | undefined {
    const text = docHelper.getText();
    const descriptor = findDescriptor(
        getDescriptorsForText(text, fileType),
        line,
        key,
    );
    const pair = getPairAtLine(text, line, key);
    if (!descriptor || !pair) {
        return undefined;
    }

    return {
        kind: "value",
        descriptor,
        keyInfo: descriptor.expectedKeys.find(
            ({ key: expectedKey }) => expectedKey == key,
        ),
        // The rest of the line gets replaced as well, so that no remainder of a previous value is left.
        // Trailing whitespace before the cursor (e.g. the space after the colon) must not be part of the range.
        replaceRange: new Range(
            new Position(line, character - typedWord.length),
            new Position(line, getEndOfValue(docHelper, line, character)),
        ),
        isMissingSpaceAfterColon,
        path: [...pair.containingKeys, key],
    };
}

/** Returns the end of the value in the given line, which excludes trailing whitespace and a trailing comment. */
function getEndOfValue(
    docHelper: TextDocumentHelper,
    line: number,
    cursorCharacter: number,
) {
    const lineContent = docHelper.getLineByIndex(line);
    const commentStart = lineContent.substring(cursorCharacter).search(/\s+#/);
    const valueEnd =
        commentStart >= 0
            ? cursorCharacter + commentStart
            : lineContent.trimEnd().length;

    return Math.max(cursorCharacter, valueEnd);
}

function getDescriptorsForText(text: string, fileType: BrunoFileType) {
    const mapDescriptors: YamlMapDescriptor[] = [];
    const options: YamlParsingOptions = {
        mapDescriptors,
        continueOnSyntaxErrors: true,
    };
    const docHelper = new TextDocumentHelper(text);

    switch (fileType) {
        case BrunoFileType.RequestFile:
            parseRequestFile(docHelper, options);
            break;
        case BrunoFileType.FolderSettingsFile:
            parseFolderSettingsFile(docHelper, options);
            break;
        case BrunoFileType.CollectionSettingsFile:
            parseCollectionSettingsFile(docHelper, options);
            break;
        case BrunoFileType.EnvironmentFile:
            parseYamlEnvironmentFile(docHelper, options);
            break;
        case BrunoFileType.AppFile:
            parseAppFile(docHelper, options);
            break;
    }

    return mapDescriptors;
}

function findDescriptor(
    descriptors: YamlMapDescriptor[],
    line: number,
    key: string,
) {
    return descriptors.find(({ definedKeys }) =>
        definedKeys.some((defined) => isKeyAtLine(defined, line, key)),
    );
}

function isKeyAtLine(
    defined: YamlMapDescriptor["definedKeys"][number],
    line: number,
    key: string,
) {
    return defined.key == key && defined.keyRange.start.line == line;
}

/** Finds the key `key` that starts in the given line within the Yaml document. */
function getPairAtLine(text: string, line: number, key: string) {
    const lineCounter = new LineCounter();
    const document = parseDocument(text, { lineCounter });
    let result:
        | {
              containingKeys: string[];
              isSequenceItem: boolean;
              siblingScalars: string[];
          }
        | undefined;

    visit(document, {
        Pair(_, pair, ancestors) {
            if (
                !isScalar(pair.key) ||
                pair.key.value != key ||
                !pair.key.range ||
                lineCounter.linePos(pair.key.range[0]).line - 1 != line
            ) {
                return undefined;
            }

            const sequence = ancestors[ancestors.length - 2];
            result = {
                containingKeys: ancestors
                    .filter(isPair)
                    .map(({ key }) => String(isScalar(key) ? key.value : key)),
                // The parent of the pair is the map, whose parent is the sequence (if the map is a sequence item).
                isSequenceItem: isSeq(sequence),
                siblingScalars: isSeq(sequence)
                    ? sequence.items
                          .filter(isScalar)
                          .map(({ value }) => String(value))
                    : [],
            };
            return visit.BREAK;
        },
    });

    return result;
}
