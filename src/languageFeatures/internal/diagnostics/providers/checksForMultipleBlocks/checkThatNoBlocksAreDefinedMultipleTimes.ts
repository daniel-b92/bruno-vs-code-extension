import {
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
    Uri,
} from "vscode";
import { RequestFileBlock, RequestFileBlockName } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";

export function checkThatNoBlocksAreDefinedMultipleTimes(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): Diagnostic | DiagnosticCode | undefined {
    if (blocks.length == 0) {
        return;
    }

    const duplicates = findDuplicateBlocks(blocks);

    if (duplicates.length == 0) {
        return DiagnosticCode.MultipleDefinitionsForSameBlocks;
    } else {
        const allDuplicateBlocks: RequestFileBlock[] = [];

        for (const { blocks } of duplicates) {
            allDuplicateBlocks.push(...blocks);
        }
        const sortedDuplicates = getSortedBlocksByPosition(allDuplicateBlocks);

        const range = new Range(
            sortedDuplicates[0].nameRange.start,
            sortedDuplicates[sortedDuplicates.length - 1].contentRange.end
        );

        const multipleDefinitionsForSameBlocksDiagnostic: Diagnostic = {
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
                            location: { uri: documentUri, range: nameRange },
                        })
                );

                return toReturn;
            }, [] as DiagnosticRelatedInformation[]),
            severity: DiagnosticSeverity.Error,
            code: DiagnosticCode.MultipleDefinitionsForSameBlocks,
        };

        return multipleDefinitionsForSameBlocksDiagnostic;
    }
}

function findDuplicateBlocks(blocks: RequestFileBlock[]) {
    const duplicates: {
        name: RequestFileBlockName;
        blocks: RequestFileBlock[];
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
                    blocks: RequestFileBlock[];
                }
            ).blocks.push(block);
        }

        lastBlock = block;
    }

    return duplicates;
}
