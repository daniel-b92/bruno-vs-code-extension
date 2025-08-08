import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
    Uri,
} from "vscode";
import {
    Block,
    mapPosition,
    mapRange,
    RequestFileBlockName,
} from "../../../../../../shared";
import { getSortedBlocksByPosition } from "../../../../../../shared/languageUtils/commonBlocks/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkThatNoBlocksAreDefinedMultipleTimes(
    documentUri: Uri,
    blocks: Block[]
): DiagnosticWithCode | undefined {
    if (blocks.length == 0) {
        return;
    }

    const duplicates = findDuplicateBlocks(blocks);

    if (duplicates.length == 0) {
        return undefined;
    } else {
        const allDuplicateBlocks: Block[] = [];

        for (const { blocks } of duplicates) {
            allDuplicateBlocks.push(...blocks);
        }
        const sortedDuplicates = getSortedBlocksByPosition(allDuplicateBlocks);

        const range = new Range(
            mapPosition(sortedDuplicates[0].nameRange.start),
            mapPosition(
                sortedDuplicates[sortedDuplicates.length - 1].contentRange.end
            )
        );

        const multipleDefinitionsForSameBlocksDiagnostic: DiagnosticWithCode = {
            message: `Multiple blocks with the same name are defined. ${`Blocks with multiple definitions: '${duplicates
                .map(({ name }) => name)
                .join("', '")}'`}`,
            range,
            relatedInformation: duplicates.reduce((prev, { name, blocks }) => {
                const toReturn = prev.slice();

                // ToDo: Avoid sorting array positions a second time and instead find a way to combine with the sorting above
                getSortedBlocksByPosition(blocks).forEach(
                    ({ nameRange }, index) =>
                        toReturn.push({
                            message: `Block '${name}' definition no. ${
                                index + 1
                            }`,
                            location: {
                                uri: documentUri,
                                range: mapRange(nameRange),
                            },
                        })
                );

                return toReturn;
            }, [] as DiagnosticRelatedInformation[]),
            severity: DiagnosticSeverity.Error,
            code: getCode(),
        };

        return multipleDefinitionsForSameBlocksDiagnostic;
    }
}

function findDuplicateBlocks(blocks: Block[]) {
    const duplicates: {
        name: RequestFileBlockName;
        blocks: Block[];
    }[] = [];

    const sortedBlocks = blocks
        .slice()
        .sort(({ name: name1 }, { name: name2 }) => (name1 > name2 ? 1 : -1));

    let lastBlock = sortedBlocks[0];

    for (const block of sortedBlocks.slice(1)) {
        const maybeExistingEntry = duplicates.find(
            ({ name }) => name == block.name
        );

        if (block.name == lastBlock.name && !maybeExistingEntry) {
            duplicates.push({
                name: block.name as RequestFileBlockName,
                blocks: [lastBlock, block],
            });
        } else if (block.name == lastBlock.name && maybeExistingEntry) {
            (
                duplicates.find(({ name }) => name == block.name) as {
                    name: RequestFileBlockName;
                    blocks: Block[];
                }
            ).blocks.push(block);
        }

        lastBlock = block;
    }

    return duplicates;
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.MultipleDefinitionsForSameBlocks;
}
