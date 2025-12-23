import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import {
    BlockType,
    parseCodeBlock,
    Position,
    Range,
    ArrayBlockField,
    CodeBlockContent,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
    BrunoVariableReference,
} from "../..";
import { parseJsonBlock } from "./parseJsonBlock";
import { parsePlainTextBlock } from "./parsePlainTextBlock";
import { parseDictionaryBlock } from "./parseDictionaryBlock";
import { parseArrayBlock } from "./parseArrayBlock";
import { SyntaxKind } from "typescript";
import { getBrunoVariableReferencesInNonCodeBlock } from "./getBrunoVariableReferencesInNonCodeBlock";

export const getBlockContent = (
    document: TextDocumentHelper,
    startingPosition: Position,
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
              | (ArrayBlockField | PlainTextWithinBlock)[]
              | CodeBlockContent;
          contentRange: Range;
          variableRerences?: BrunoVariableReference[];
      }
    | undefined => {
    // the block content is exclusive of the block's opening bracket line
    const firstContentLine = startingPosition.line + 1;

    switch (blockType) {
        case BlockType.Array:
            // Array blocks do not have variable references (currently they are only used within environment files afaik).
            return parseArrayBlock(document, firstContentLine);
        case BlockType.Dictionary:
            const dictionaryBlockWithoutParsedVars = parseDictionaryBlock(
                document,
                firstContentLine,
            );
            return dictionaryBlockWithoutParsedVars && searchVariableReferences
                ? {
                      ...dictionaryBlockWithoutParsedVars,
                      variableRerences:
                          getBrunoVariableReferencesInNonCodeBlock(
                              document,
                              dictionaryBlockWithoutParsedVars.contentRange,
                          ),
                  }
                : dictionaryBlockWithoutParsedVars;
        case BlockType.Code:
            return parseCodeBlock(document, firstContentLine, SyntaxKind.Block);
        case BlockType.Json:
            const jsonBlockWithoutParsedVars = parseJsonBlock(
                document,
                firstContentLine,
            );
            return jsonBlockWithoutParsedVars
                ? {
                      ...jsonBlockWithoutParsedVars,
                      variableRerences:
                          getBrunoVariableReferencesInNonCodeBlock(
                              document,
                              jsonBlockWithoutParsedVars.contentRange,
                          ),
                  }
                : jsonBlockWithoutParsedVars;
        case BlockType.PlainText:
            const plainTextBlockWithoutParsedVars = parsePlainTextBlock(
                document,
                firstContentLine,
            );
            return plainTextBlockWithoutParsedVars
                ? {
                      ...plainTextBlockWithoutParsedVars,
                      variableRerences:
                          getBrunoVariableReferencesInNonCodeBlock(
                              document,
                              plainTextBlockWithoutParsedVars.contentRange,
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
};
