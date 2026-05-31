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

export type ParsedBlockContent =
    | string
    | (
          | DictionaryBlockSimpleField
          | DictionaryBlockArrayField
          | PlainTextWithinBlock
      )[]
    | (ArrayBlockField | PlainTextWithinBlock)[];

export function getBlockContent(
    document: TextDocumentHelper,
    block: {
        contentRange: Range;
        type: BlockType;
        name: string;
    },
    searchVariableReferences = false,
):
    | {
          content: ParsedBlockContent;
          contentRange: Range;
          variableRerences?: BrunoVariableReference[];
      }
    | undefined {
    const {
        contentRange: blockContentRange,
        type: blockType,
        name: blockName,
    } = block;

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
                          {
                              ...dictionaryBlockWithoutParsedVars,
                              name: blockName,
                          },
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
                          {
                              ...plainTextBlockWithoutParsedVars,
                              name: blockName,
                          },
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
    parsedBlock: {
        content: ParsedBlockContent;
        contentRange: Range;
        name: string;
    },
) {
    return blockType == BlockType.Code
        ? getBrunoVariableReferencesInCodeBlock(documentHelper, contentRange)
        : getBrunoVariableReferencesInNonCodeBlock(
              documentHelper,
              contentRange,
              parsedBlock,
          );
}
