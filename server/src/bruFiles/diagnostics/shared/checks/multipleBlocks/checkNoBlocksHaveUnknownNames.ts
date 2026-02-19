import { Block } from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getRangeContainingBlocksSortedByPosition } from "../../util/getRangeContainingBlocksSortedByPosition";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkNoBlocksHaveUnknownNames(
    filePath: string,
    blocks: Block[],
    validNames: string[],
): DiagnosticWithCode | undefined {
    const blocksWithUnknownNames = getSortedBlocksByPosition(
        blocks.filter(({ name }) => !validNames.includes(name)),
    );

    if (blocksWithUnknownNames.length > 0) {
        return getDiagnostic(filePath, blocksWithUnknownNames, validNames);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    filePath: string,
    sortedBlocksWithUnknownNames: Block[],
    validNames: string[],
): DiagnosticWithCode {
    return {
        message: `Blocks with invalid names are defined. Valid names for blocks: ${JSON.stringify(
            validNames.sort(),
            null,
            2,
        )}`,
        range: getRangeContainingBlocksSortedByPosition(
            sortedBlocksWithUnknownNames,
        ),
        relatedInformation: sortedBlocksWithUnknownNames.map(
            ({ name, nameRange }) => ({
                message: `Block with invalid name '${name}'`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range: nameRange,
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
