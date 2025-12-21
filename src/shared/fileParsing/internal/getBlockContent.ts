import {
    ArrayBlockField,
    CodeBlockContent,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../languageUtils/interfaces";
import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import { BlockType, parseCodeBlock, Position, Range } from "../..";
import { parseJsonBlock } from "./parseJsonBlock";
import { parsePlainTextBlock } from "./parsePlainTextBlock";
import { parseDictionaryBlock } from "./parseDictionaryBlock";
import { parseArrayBlock } from "./parseArrayBlock";
import { SyntaxKind } from "typescript";

export const getBlockContent = (
    document: TextDocumentHelper,
    startingPosition: Position,
    blockType: BlockType,
):
    | {
          content:
              | string
              | (
                    | DictionaryBlockSimpleField
                    | DictionaryBlockArrayField
                    | PlainTextWithinBlock
                )[]
              | (ArrayBlockField | PlainTextWithinBlock)[]
              | CodeBlockContent;
          contentRange: Range;
      }
    | undefined => {
    // the block content is exclusive of the block's opening bracket line
    const firstContentLine = startingPosition.line + 1;

    switch (blockType) {
        case BlockType.Array:
            return parseArrayBlock(document, firstContentLine);
        case BlockType.Dictionary:
            return parseDictionaryBlock(document, firstContentLine);
        case BlockType.Code:
            return parseCodeBlock(document, firstContentLine, SyntaxKind.Block);
        case BlockType.Json:
            return parseJsonBlock(document, firstContentLine);
        case BlockType.PlainText:
            return parsePlainTextBlock(document, firstContentLine);
        default:
            throw new Error(
                `Cannot parse block with unknown type '${blockType}'. Known block types are ${JSON.stringify(
                    Object.entries(BlockType),
                    null,
                    2,
                )}`,
            );
    }
};
