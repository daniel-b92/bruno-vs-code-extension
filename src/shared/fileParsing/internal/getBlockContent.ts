import {
    ArrayBlockField,
    DictionaryBlockField,
    PlainTextWithinBlock,
} from "../external/interfaces";
import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import { parseCodeBlock, Position, Range } from "../..";
import { BlockType } from "./util/BlockTypeEnum";
import { parseJsonBlock } from "./parseJsonBlock";
import { parsePlainTextBlock } from "./parsePlainTextBlock";
import { parseDictionaryBlock } from "./parseDictionaryBlock";
import { parseArrayBlock } from "./parseArrayBlock";

export const getBlockContent = (
    document: TextDocumentHelper,
    startingPosition: Position,
    blockType: BlockType,
):
    | {
          content:
              | string
              | (DictionaryBlockField | PlainTextWithinBlock)[]
              | (ArrayBlockField | PlainTextWithinBlock)[];
          contentRange: Range;
      }
    | undefined => {
    // the block content is exclusive of the block's opening bracket line
    const firsContentLine = startingPosition.line + 1;

    switch (blockType) {
        case BlockType.Array:
            return parseArrayBlock(document, firsContentLine);
        case BlockType.Dictionary:
            return parseDictionaryBlock(document, firsContentLine);
        case BlockType.Code:
            return parseCodeBlock(document, firsContentLine);
        case BlockType.Json:
            return parseJsonBlock(document, firsContentLine);
        case BlockType.PlainText:
            return parsePlainTextBlock(document, firsContentLine);
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
