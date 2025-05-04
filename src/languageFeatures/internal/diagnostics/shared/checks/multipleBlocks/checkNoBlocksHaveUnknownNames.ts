import { DiagnosticSeverity, Range, Uri } from "vscode";
import {
    RequestFileBlock,
    RequestFileBlockName,
} from "../../../../../../shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkNoBlocksHaveUnknownNames(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | undefined {
    const validNames = Object.values(RequestFileBlockName) as string[];

    const blocksWithUnknownNames = getSortedBlocksByPosition(
        blocks.filter(({ name }) => !validNames.includes(name))
    );

    if (blocksWithUnknownNames.length > 0) {
        return getDiagnostic(documentUri, blocksWithUnknownNames);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBlocksWithUnknownNames: RequestFileBlock[]
): DiagnosticWithCode {
    return {
        message: `Blocks with invalid names are defined. Valid names for blocks: ${JSON.stringify(
            Object.values(RequestFileBlockName).sort(),
            null,
            2
        )}`,
        range: getRange(sortedBlocksWithUnknownNames),
        relatedInformation: sortedBlocksWithUnknownNames.map(
            ({ name, nameRange }) => ({
                message: `Block with invalid name '${name}'`,
                location: { uri: documentUri, range: nameRange },
            })
        ),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getRange(blocksWithUnknownNames: RequestFileBlock[]): Range {
    return new Range(
        blocksWithUnknownNames[0].nameRange.start,
        blocksWithUnknownNames[blocksWithUnknownNames.length - 1].nameRange.end
    );
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.BlocksWithUnknownNamesDefined;
}
