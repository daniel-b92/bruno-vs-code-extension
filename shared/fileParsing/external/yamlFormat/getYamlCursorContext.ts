import {
    isPair,
    isScalar,
    isSeq,
    LineCounter,
    parseDocument,
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
          /** The character index of the key within its line (after a leading `- `, if there is one). */
          indentation: number;
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
          /** Includes the key that the value belongs to, e.g. `["info", "seq"]`. */
          path: string[];
      }
    | {
          /** A `- ` item of a sequence that is not a sequence of maps (e.g. `info.tags`). */
          kind: "sequenceValue";
          replaceRange: Range;
          /** The keys leading to the sequence, e.g. `["info", "tags"]`. */
          path: string[];
      };

const PLACEHOLDER_KEY = "__bruAsCodeCompletion__";
const KEY_POSITION_REGEX = /^\s*(-\s+)?([\w-]*)$/;
const VALUE_POSITION_REGEX = /^\s*(?:-\s+)?([\w-]+):\s*(\S*)$/;

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
              typedWord: valueMatch[2],
          })
        : undefined;
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
    const key = typedWord || PLACEHOLDER_KEY;
    const patchedText = docHelper.getFullTextWithReplacement(
        {
            lineIndex: line,
            startCharIndex: character - typedWord.length,
            endCharIndex: docHelper.getLineByIndex(line).length,
        },
        `${key}:`,
    );
    const replaceRange = new Range(
        new Position(line, character - typedWord.length),
        new Position(line, character),
    );

    const descriptors = getDescriptorsForText(patchedText, fileType);
    const pair = getPairAtLine(patchedText, line, key);
    const descriptor = findDescriptor(descriptors, line, key);

    if (descriptor && pair) {
        const { keyRange } = descriptor.definedKeys.find((defined) =>
            isKeyAtLine(defined, line, key),
        )!;

        return {
            kind: "key",
            descriptor: {
                ...descriptor,
                definedKeys: descriptor.definedKeys.filter(
                    (defined) => !isKeyAtLine(defined, line, key),
                ),
            },
            replaceRange,
            indentation: keyRange.start.character,
            path: pair.containingKeys,
        };
    }

    return hasSequenceItemPrefix && pair?.isSequenceItem
        ? {
              kind: "sequenceValue",
              replaceRange,
              path: pair.containingKeys,
          }
        : undefined;
}

function getContextForValuePosition({
    docHelper,
    fileType,
    position: { line, character },
    key,
    typedWord,
}: {
    docHelper: TextDocumentHelper;
    fileType: BrunoFileType;
    position: Position;
    key: string;
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
        replaceRange: new Range(
            new Position(line, character - typedWord.length),
            new Position(line, character),
        ),
        path: [...pair.containingKeys, key],
    };
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
        { containingKeys: string[]; isSequenceItem: boolean } | undefined;

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

            result = {
                containingKeys: ancestors
                    .filter(isPair)
                    .map(({ key }) => String(isScalar(key) ? key.value : key)),
                // The parent of the pair is the map, whose parent is the sequence (if the map is a sequence item).
                isSequenceItem: isSeq(ancestors[ancestors.length - 2]),
            };
            return visit.BREAK;
        },
    });

    return result;
}
