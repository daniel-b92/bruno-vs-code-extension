import { DiagnosticSeverity, Uri } from "vscode";
import { Block, mapToVsCodeRange } from "../../../../../../../shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getRangeContainingBlocksSortedByPosition } from "../../util/getRangeContainingBlocksSortedByPosition";

export function checkNoBlocksHaveUnknownNames(
    documentUri: Uri,
    blocks: Block[],
    validNames: string[],
): DiagnosticWithCode | undefined {
    const blocksWithUnknownNames = getSortedBlocksByPosition(
        blocks.filter(({ name }) => !validNames.includes(name)),
    );

    if (blocksWithUnknownNames.length > 0) {
        return getDiagnostic(documentUri, blocksWithUnknownNames, validNames);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBlocksWithUnknownNames: Block[],
    validNames: string[],
): DiagnosticWithCode {
    return {
        message: `Blocks with invalid names are defined. Valid names for blocks: ${JSON.stringify(
            validNames.sort(),
            null,
            2,
        )}`,
        range: mapToVsCodeRange(
            getRangeContainingBlocksSortedByPosition(
                sortedBlocksWithUnknownNames,
            ),
        ),
        relatedInformation: sortedBlocksWithUnknownNames.map(
            ({ name, nameRange }) => ({
                message: `Block with invalid name '${name}'`,
                location: {
                    uri: documentUri,
                    range: mapToVsCodeRange(nameRange),
                },
            }),
        ),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.BlocksWithUnknownNamesDefined;
}
