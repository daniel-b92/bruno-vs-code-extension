import {
    Block,
    BlockBracket,
    LineBreakType,
    Position,
    Range,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";

export function getTextEditForInsertingBlock(
    methodBlock: Block,
    newData: {
        blockName: string;
        content?: { keys: string[] };
        lineBreak: LineBreakType;
    },
): TextEdit {
    const { blockName: newBlockName, content, lineBreak } = newData;

    const blockStartLine = `${newBlockName} ${BlockBracket.OpeningBracketForDictionaryOrTextBlock}`;
    const blockEndLine = BlockBracket.ClosingBracketForDictionaryOrTextBlock;
    const afterMethodBlockPosition = new Position(
        // The content range does not include the closing block bracket.
        methodBlock.contentRange.end.line + 1,
        0,
    );
    const textEditRange = new Range(
        afterMethodBlockPosition,
        afterMethodBlockPosition,
    );

    return {
        newText: lineBreak.concat(
            blockStartLine,
            lineBreak,
            content
                ? content.keys.map((key) => `\t${key}:`).join(lineBreak)
                : "\t",
            lineBreak,
            blockEndLine,
            lineBreak,
        ),
        range: textEditRange,
    };
}
