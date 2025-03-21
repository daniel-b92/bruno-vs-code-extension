import {
    Diagnostic,
    DiagnosticCollection,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
    Uri,
} from "vscode";
import { addDiagnosticForDocument } from "../util/addDiagnosticForDocument";
import { RequestFileBlock } from "../../../../shared/fileSystem/testFileParsing/definitions/interfaces";
import { DiagnosticCode } from "../diagnosticCodeEnum";
import { RequestFileBlockName } from "../../../../shared/fileSystem/testFileParsing/definitions/requestFileBlockNameEnum";
import { removeDiagnosticsForDocument } from "../util/removeDiagnosticsForDocument";

export function checkThatNoBlocksAreDefinedMultipleTimes(
    documentUri: Uri,
    blocks: RequestFileBlock[],
    diagnostics: DiagnosticCollection
) {
    // Always remove diagnostic before trying to add it, to handle cases where changes are made in the document that cause more duplicate blocks than before.
    // Otherwise ,the 'addDiagnosticForDocument' would just skip re-adding it since it already has been added.
    removeDiagnosticsForDocument(
        documentUri,
        diagnostics,
        DiagnosticCode.MultipleDefinitionsForSameBlocks
    );

    if (blocks.length == 0) {
        return;
    }

    const duplicates = findDuplicateBlocks(blocks);

    if (duplicates.length > 0) {
        const allDuplicateBlocks: RequestFileBlock[] = [];

        for (const { blocks } of duplicates) {
            allDuplicateBlocks.push(...blocks);
        }
        allDuplicateBlocks.sort(
            (
                {
                    nameRange: {
                        start: { line: line1 },
                    },
                },
                {
                    nameRange: {
                        start: { line: line2 },
                    },
                }
            ) => line1 - line2
        );

        const range = new Range(
            allDuplicateBlocks[0].nameRange.start,
            allDuplicateBlocks[allDuplicateBlocks.length - 1].contentRange.end
        );

        const multipleDefinitionsForSameBlocksDiagnostic: Diagnostic = {
            message: `Multiple blocks with the same name are defined. ${`Blocks with multiple definitions: '${duplicates
                .map(({ name }) => name)
                .join("', '")}'`}`,
            range,
            relatedInformation: duplicates.reduce((prev, { name, blocks }) => {
                const toReturn = prev.slice();

                // ToDo: Avoid sorting array positions a second time and instead find a way to combine with the sorting above
                blocks
                    .slice()
                    .sort(
                        (a, b) =>
                            a.nameRange.start.line - b.nameRange.start.line
                    )
                    .forEach(({ nameRange }, index) =>
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
        addDiagnosticForDocument(
            documentUri,
            diagnostics,
            multipleDefinitionsForSameBlocksDiagnostic
        );
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
