import {
    isAlias,
    isCollection,
    isDocument,
    isMap,
    isNode,
    isScalar,
    isSeq,
    LineCounter,
    parseDocument,
    YAMLError,
    YAMLMap,
    Range as YamlRange,
    YAMLSeq,
} from "yaml";
import { Position, Range, TextDocumentHelper } from "../../..";

enum EnvironmentTopLevelKey {
    Name = "name",
    Variables = "variables",
}

export interface YamlParsingError {
    message: string;
    range: Range;
}

interface CommonParsingArgs {
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}

// enum VariableType {
//     Number = "number",
//     Boolean = "boolean",
//     Object = "object",
// }

// interface Variable {
//     name: string;
//     value?: string | { type: VariableType; data: unknown };
//     description?: string;
//     secret: boolean;
//     disabled: boolean;
// }

export function parseYamlEnvironmentFile(docHelper: TextDocumentHelper) {
    const document = parseDocument(docHelper.getText(), {
        lineCounter: new LineCounter(),
    });
    const fullDocumentRange = docHelper.getTextRange();

    if (document.errors.length > 0) {
        console.log("Got technical parsing errors.");
        return mapErrors(document.errors, fullDocumentRange);
    }

    const maybeTopLevelMap = getTopLevelMapIfExists({
        node: document.contents,
        fullDocumentRange,
        docHelper,
    });
    if ("error" in maybeTopLevelMap) {
        console.log("Got errors for top level map typeguard.");
        return maybeTopLevelMap.error;
    }
    const { map: topLevelMap } = maybeTopLevelMap;

    const maybeNameField = getScalarFieldStringValueFromMap({
        map: topLevelMap,
        key: EnvironmentTopLevelKey.Name,
        docHelper,
        fullDocumentRange,
        isTopLevelMap: true,
    });

    if ("error" in maybeNameField) {
        return maybeNameField.error;
    }

    const maybeVariablesSequence = getYamlSequenceByKeyFromMap({
        map: topLevelMap,
        key: EnvironmentTopLevelKey.Variables,
        docHelper,
        fullDocumentRange,
        isTopLevelMap: true,
    });

    if ("error" in maybeVariablesSequence) {
        return maybeVariablesSequence.error;
    }

    const { items: variableItems, errors } = getYamlMapsFromSequence({
        docHelper,
        fullDocumentRange,
        sequence: maybeVariablesSequence.sequence,
    });

    return {
        name: maybeNameField.value,
        variables: variableItems,
        errors,
    };
}

function getTopLevelMapIfExists({
    node,
    fullDocumentRange,
}: CommonParsingArgs & { node: unknown }):
    { map: YAMLMap<unknown, unknown> } | { error: YamlParsingError } {
    return isMap(node)
        ? { map: node }
        : {
              error: {
                  message: `A top level Yaml map is required`,
                  range: fullDocumentRange,
              },
          };
}

function getScalarFieldStringValueFromMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): { value: string } | { error: YamlParsingError } {
    const { map, key, fullDocumentRange, docHelper, isTopLevelMap } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { error: existenceError };
    }

    const field = map.get(key);
    return typeof field == "string"
        ? { value: field }
        : {
              error: {
                  message: `Field '${key}' should be a string.`,
                  range: isTopLevelMap
                      ? fullDocumentRange
                      : ((map.range
                            ? fromYamlRange(map.range, docHelper)
                            : fullDocumentRange) ?? fullDocumentRange),
              },
          };
}

function getYamlSequenceByKeyFromMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): { sequence: YAMLSeq<unknown> } | { error: YamlParsingError } {
    const { map: parentMap, key, fullDocumentRange, docHelper } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { error: existenceError };
    }

    const field = parentMap.get(key);
    return isSeq(field)
        ? { sequence: field }
        : {
              error: {
                  message: `Field '${key}' should be a Yaml sequence. Got ${JSON.stringify(field)}`,
                  range:
                      (parentMap.range
                          ? fromYamlRange(parentMap.range, docHelper)
                          : fullDocumentRange) ?? fullDocumentRange,
              },
          };
}

function getYamlMapsFromSequence(
    args: CommonParsingArgs & {
        sequence: YAMLSeq<unknown>;
    },
): { items: YAMLMap<unknown, unknown>[]; errors: YamlParsingError[] } {
    const { sequence, fullDocumentRange, docHelper } = args;

    const items: YAMLMap<unknown, unknown>[] = [];
    const errors: YamlParsingError[] = [];

    for (const item of sequence.items) {
        if (isMap(item)) {
            items.push(item);
            continue;
        }
        const range =
            isScalar(item) ||
            isSeq(item) ||
            isCollection(item) ||
            isAlias(item) ||
            isDocument(item) ||
            isNode(item)
                ? item.range
                : sequence.range;

        errors.push({
            message: "Sequence items should be Yaml maps",
            range:
                (range ? fromYamlRange(range, docHelper) : fullDocumentRange) ??
                fullDocumentRange,
        });
    }

    return { items, errors };
}

function validateKeyExistsInMap(
    args: CommonParsingArgs & {
        map: YAMLMap<unknown, unknown>;
        key: string;
        isTopLevelMap: boolean;
    },
): YamlParsingError | undefined {
    const { map, key, isTopLevelMap, fullDocumentRange, docHelper } = args;
    return map.has(key)
        ? undefined
        : {
              message: `Mandatory key '${key}' is missing in Yaml map.`,
              range: isTopLevelMap
                  ? fullDocumentRange
                  : ((map.range
                        ? fromYamlRange(map.range, docHelper)
                        : fullDocumentRange) ?? fullDocumentRange),
          };
}

function fromYamlRange(
    { "0": startOffset, "2": endOffset }: YamlRange,
    docHelper: TextDocumentHelper,
): Range | undefined {
    const startPosition = docHelper.getPositionForOffset(
        new Position(0, 0),
        startOffset,
    );
    const endPosition = docHelper.getPositionForOffset(
        new Position(0, 0),
        endOffset,
    );

    return startPosition && endPosition
        ? new Range(startPosition, endPosition)
        : undefined;
}

function mapErrors(
    errors: YAMLError[],
    fullContentRange: Range,
): YamlParsingError[] {
    return errors.map(({ message, linePos }) => {
        const startPosition =
            linePos == undefined
                ? fullContentRange.start
                : new Position(linePos[0].line - 1, linePos[0].col - 1);
        const endPosition =
            linePos == undefined
                ? fullContentRange.end
                : linePos[1]
                  ? new Position(linePos[1].line - 1, linePos[1].col - 1)
                  : startPosition;

        return {
            message,
            range: new Range(startPosition, endPosition),
            severity: "ERR",
        };
    });
}
