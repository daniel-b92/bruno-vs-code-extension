import {
    Block,
    doesDictionaryBlockSupportDescriptions,
    doesDictionaryBlockSupportMultilineValues,
    doesDictionaryBlockSupportTypeAnnotations,
    isBlockDictionaryBlock,
    isDictionaryBlockDescription,
    isDictionaryBlockField,
    isDictionaryBlockTypeAnnotation,
    PlainTextWithinBlock,
    Range,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedPlainTextLinesByPosition } from "../../util/getSortedPlainTextLinesByPosition";
import { URI } from "vscode-uri";

export function checkDictionaryBlocksHaveDictionaryStructure(
    filePath: string,
    blocksToCheck: Block[],
): DiagnosticWithCode[] | undefined {
    const sortedBlocksWithoutCorrectStructure = getSortedBlocksByPosition(
        blocksToCheck.filter((block) => !isBlockDictionaryBlock(block)),
    );

    if (sortedBlocksWithoutCorrectStructure.length == 0) {
        return undefined;
    }

    const invalidBlocksSorted = sortedBlocksWithoutCorrectStructure
        .map((block) => ({
            blockName: block.name,
            invalidLines: getLinesWithInvalidStructure(block) ?? [],
        }))
        .filter(({ invalidLines }) => invalidLines.length > 0);

    return invalidBlocksSorted.length > 0
        ? getDiagnostic(filePath, invalidBlocksSorted)
        : undefined;
}

function getDiagnostic(
    filePath: string,
    sortedBlocksWithIncorrectStructure: {
        blockName: string;
        invalidLines: PlainTextWithinBlock[];
    }[],
): DiagnosticWithCode[] {
    return sortedBlocksWithIncorrectStructure.map(
        ({ blockName, invalidLines }) => {
            const sortedInvalidLines =
                getSortedPlainTextLinesByPosition(invalidLines);
            const range = new Range(
                sortedInvalidLines[0].range.start,
                sortedInvalidLines[sortedInvalidLines.length - 1].range.end,
            );

            return {
                message: getMessageForBlock(blockName),
                range,
                code: NonBlockSpecificDiagnosticCode.DictionaryBlocksNotStructuredCorrectly,
                relatedInformation:
                    sortedInvalidLines.length <= 1
                        ? undefined
                        : sortedInvalidLines.map(({ range }) => ({
                              message: `Invalid line in block '${blockName}'`,
                              location: {
                                  uri: URI.file(filePath).toString(),
                                  range,
                              },
                          })),
            };
        },
    );

    function getMessageForBlock(blockName: string) {
        const lineBreak = "\n";
        const commonMessageStart = `Dictionary block does not have the correct structure. A valid dictionary block with a single field matches the following pattern:
<blockName> {
  key1: value1
}
- For some blocks, array fields matching the following pattern are allowed as well
maybeArrayKey: [
  arrVal1
]`;

        const supportsDescriptions =
            doesDictionaryBlockSupportDescriptions(blockName);
        const supportsMultiLineValues =
            doesDictionaryBlockSupportMultilineValues(blockName);
        const supportsTypeAnnotations =
            doesDictionaryBlockSupportTypeAnnotations(blockName);
        return [commonMessageStart]
            .concat(
                supportsDescriptions
                    ? `- For this block, at most one description per field is allowed matching the pattern
@description('<Description_Text>') or${lineBreak}@description('''${lineBreak}  <Description_Text>${lineBreak}''')`
                    : [],
                supportsMultiLineValues
                    ? `For this block, additionally fields with multiline values are allowed matching the following pattern
key2: '''${lineBreak}  line1${lineBreak}  line2${lineBreak}  '''`
                    : [],
                supportsTypeAnnotations
                    ? `For this block, at most one of the following type annotations per field is allowed:
- @number${lineBreak}- @object${lineBreak}- @boolean`
                    : [],
            )
            .join(lineBreak);
    }
}

function getLinesWithInvalidStructure(block: Block) {
    return Array.isArray(block.content)
        ? (block.content.filter(
              (field) =>
                  !isDictionaryBlockField(field) &&
                  !isDictionaryBlockDescription(field) &&
                  !isDictionaryBlockTypeAnnotation(field),
          ) as PlainTextWithinBlock[])
        : undefined;
}
