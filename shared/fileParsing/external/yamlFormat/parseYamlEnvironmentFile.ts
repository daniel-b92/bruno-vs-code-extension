import {
    isMap,
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
    severity: "ERR" | "WARN";
}

interface CommonParsingArgs {
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}

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

    const maybeVariablesSequence = getYamlSequenceByKey({
        map: topLevelMap,
        key: EnvironmentTopLevelKey.Variables,
        docHelper,
        fullDocumentRange,
        isTopLevelMap: true,
    });

    if ("error" in maybeVariablesSequence) {
        return maybeVariablesSequence.error;
    }

    return {
        name: maybeNameField.value,
        variables: maybeVariablesSequence.sequence,
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
                  severity: "ERR" as "ERR",
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
                  severity: "ERR" as "ERR",
              },
          };
}

function getYamlSequenceByKey(
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
                  severity: "ERR" as "ERR",
              },
          };
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
              severity: "ERR" as "ERR",
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
