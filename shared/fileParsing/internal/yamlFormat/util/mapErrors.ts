import { YAMLError } from "yaml";
import { Position, Range, YamlParsingError } from "../../../..";

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

        return {
            message,
            range: new Range(startPosition, endPosition),
            severity: "ERR",
        };
    });
}
