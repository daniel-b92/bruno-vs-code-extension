import { YAMLError } from "yaml";
import {
    Position,
    Range,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../..";

export function mapErrors(
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
        const spansMultipleLines = startPosition.line != endPosition.line;
        const messageToUse =
            // Avoid printing line and character infos in message, if the range is only within a single line.
            !spansMultipleLines && message.includes("at line ")
                ? message.substring(0, message.indexOf("at line "))
                : message;

        return {
            message: messageToUse,
            range: new Range(startPosition, endPosition),
            code: YamlParsingErrorCode.Other,
        };
    });
}
