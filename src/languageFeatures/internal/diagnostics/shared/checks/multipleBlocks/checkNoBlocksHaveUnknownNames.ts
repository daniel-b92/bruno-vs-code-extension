import { DiagnosticSeverity, Range, Uri } from "vscode";
import { Block, mapPosition, mapRange } from "../../../../../../shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkNoBlocksHaveUnknownNames(
    documentUri: Uri,
    blocks: Block[],
    validNames: string[]
): DiagnosticWithCode | undefined {
    const blocksWithUnknownNames = getSortedBlocksByPosition(
        blocks.filter(({ name }) => !validNames.includes(name))
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
    validNames: string[]
): DiagnosticWithCode {
    return {
        message: `Blocks with invalid names are defined. Valid names for blocks: ${JSON.stringify(
            validNames.sort(),
            null,
            2
        )}`,
        range: getRange(sortedBlocksWithUnknownNames),
        relatedInformation: sortedBlocksWithUnknownNames.map(
            ({ name, nameRange }) => ({
                message: `Block with invalid name '${name}'`,
                location: { uri: documentUri, range: mapRange(nameRange) },
            })
        ),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getRange(blocksWithUnknownNames: Block[]): Range {
    return new Range(
        mapPosition(blocksWithUnknownNames[0].nameRange.start),
        mapPosition(
            blocksWithUnknownNames[blocksWithUnknownNames.length - 1].nameRange
                .end
        )
    );
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.BlocksWithUnknownNamesDefined;
}
