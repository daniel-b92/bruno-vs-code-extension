import { Position, Range } from "@global_shared";
import { TextEdit } from "vscode-languageserver";

export function getTextEditForDictionaryBlockSimpleValue(
    lineIndex: number,
    textInLine: string,
    value: string,
): TextEdit | undefined {
    return textInLine.includes(":")
        ? {
              newText: ` ${value}`,
              range: new Range(
                  new Position(lineIndex, textInLine.indexOf(":") + 1),
                  new Position(lineIndex, textInLine.length),
              ),
          }
        : undefined;
}
