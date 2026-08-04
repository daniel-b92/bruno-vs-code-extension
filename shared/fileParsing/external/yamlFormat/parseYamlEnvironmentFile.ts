import {
    Alias,
    Document,
    isMap,
    isScalar,
    LineCounter,
    ParsedNode,
    parseDocument,
    Scalar,
    YAMLError,
    YAMLMap,
    YAMLSeq,
} from "yaml";
import { Position, Range, TextDocumentHelper } from "../../..";

enum EnvironmentTopLevelKey {
    Name = "name",
    Variables = "variables",
}

enum YamlNodeTypes {
    Pair = 1,
    Sequence = 2,
}

type ParsedDocument =
    | Document.Parsed<Alias.Parsed, true>
    | Document.Parsed<Scalar.Parsed, true>
    | Document.Parsed<YAMLMap.Parsed<ParsedNode, ParsedNode | null>, true>
    | Document.Parsed<YAMLSeq.Parsed<ParsedNode>, true>;

export interface YamlParsingError {
    message: string;
    range: Range;
    severity: "ERR" | "WARN";
}

export function parseYamlEnvironmentFile(docHelper: TextDocumentHelper) {
    const document = parseDocument(docHelper.getText(), {
        lineCounter: new LineCounter(),
    });

    if (document.errors.length > 0) {
        console.log("Got technical parsing errors.");
        return mapErrors(document.errors, docHelper.getTextRange());
    }

    const mandatoryTopLevelFieldErrors =
        checkMandatoryTopLevelFieldsExistAndHaveCorrectStructure(
            document,
            [
                {
                    key: EnvironmentTopLevelKey.Name,
                    structure: YamlNodeTypes.Pair,
                },
                {
                    key: EnvironmentTopLevelKey.Variables,
                    structure: YamlNodeTypes.Sequence,
                },
            ],
            docHelper.getTextRange(),
        );

    if (mandatoryTopLevelFieldErrors.length > 0) {
        console.log("Got mandatory field errors.");
        return mandatoryTopLevelFieldErrors;
    }

    return document.contents;
}

function checkMandatoryTopLevelFieldsExistAndHaveCorrectStructure(
    document: ParsedDocument,
    expected: {
        key: string;
        structure: YamlNodeTypes;
    }[],
    fullDocumentRange: Range,
): YamlParsingError[] {
    return expected
        .map(({ key, structure }) =>
            !document.has(key) ||
            !runTypeguardCheckForStructure(document.get(key), structure)
                ? undefined
                : {
                      message: `Key '${key}' is either missing or corrsponding does not have the correct structure`,
                      range: fullDocumentRange,
                      severity: "ERR" as "ERR",
                  },
        )
        .filter((val) => val != undefined);
}

function runTypeguardCheckForStructure(
    node: unknown,
    structure: YamlNodeTypes,
) {
    switch (structure) {
        case YamlNodeTypes.Pair:
            return isScalar(node);
        case YamlNodeTypes.Sequence:
            return isMap(node);
    }
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
