import { TextDocumentHelper } from "../../fileSystem/textDocumentHelper";
import {
    BlockType,
    Range,
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
    BrunoVariableReference,
} from "../..";
import { getBrunoVariableReferencesInNonCodeBlock } from "./variables/getBrunoVariableReferencesInNonCodeBlock";
import { getBrunoVariableReferencesInCodeBlock } from "./variables/getBrunoVariableReferencesInCodeBlock";
import { parseArrayBlock } from "./parseArrayBlock";
import { parseDictionaryBlock } from "./parseDictionaryBlock";
import { parsePlainTextBlock } from "./parsePlainTextBlock";

export function getBlockContent(
    document: TextDocumentHelper,
    blockContentRange: Range,
    blockType: BlockType,
    searchVariableReferences = false,
):
    | {
          content:
              | string
              | (
                    | DictionaryBlockSimpleField
                    | DictionaryBlockArrayField
                    | PlainTextWithinBlock
                )[]
              | (ArrayBlockField | PlainTextWithinBlock)[];
          contentRange: Range;
          variableRerences?: BrunoVariableReference[];
      }
    | undefined {
    // the block content is exclusive of the block's opening bracket line
    const firstContentLine = blockContentRange.start.line;
    const lastContentLine = blockContentRange.end.line;

    switch (blockType) {
        case BlockType.Array:
            // Array blocks do not have variable references (currently they are only used within environment files afaik).
            return parseArrayBlock(document, firstContentLine, lastContentLine);

        case BlockType.Dictionary:
            const dictionaryBlockWithoutParsedVars = parseDictionaryBlock(
                document,
                firstContentLine,
                lastContentLine,
            );
            return dictionaryBlockWithoutParsedVars && searchVariableReferences
                ? {
                      ...dictionaryBlockWithoutParsedVars,
                      variableRerences: getBrunoVariableReferences(
                          document,
                          dictionaryBlockWithoutParsedVars.contentRange,
                          blockType,
                      ),
                  }
                : dictionaryBlockWithoutParsedVars;

        case BlockType.Code:
        case BlockType.Json:
        case BlockType.PlainText:
            const plainTextBlockWithoutParsedVars = parsePlainTextBlock(
                document,
                firstContentLine,
                lastContentLine,
            );
            return plainTextBlockWithoutParsedVars && searchVariableReferences
                ? {
                      ...plainTextBlockWithoutParsedVars,
                      variableRerences: getBrunoVariableReferences(
                          document,
                          plainTextBlockWithoutParsedVars.contentRange,
                          blockType,
                      ),
                  }
                : plainTextBlockWithoutParsedVars;

        default:
            throw new Error(
                `Cannot parse block with unknown type '${blockType}'. Known block types are ${JSON.stringify(
                    Object.entries(BlockType),
                    null,
                    2,
                )}`,
            );
    }
}

function getBrunoVariableReferences(
    documentHelper: TextDocumentHelper,
    contentRange: Range,
    blockType: BlockType,
) {
    return blockType == BlockType.Code
        ? getBrunoVariableReferencesInCodeBlock(documentHelper, contentRange)
        : getBrunoVariableReferencesInNonCodeBlock(
              documentHelper,
              contentRange,
          );
}
