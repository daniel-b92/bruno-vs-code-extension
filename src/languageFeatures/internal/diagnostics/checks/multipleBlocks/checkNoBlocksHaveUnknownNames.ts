import { Diagnostic, DiagnosticSeverity, Range, Uri } from "vscode";
import { RequestFileBlock, RequestFileBlockName } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getSortedBlocksOrFieldsByPosition } from "../../util/getSortedBlocksOrFieldsByPosition";

export function checkNoBlocksHaveUnknownNames(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): Diagnostic | DiagnosticCode {
    const validNames = Object.values(RequestFileBlockName) as string[];

    const blocksWithUnknownNames = getSortedBlocksOrFieldsByPosition(
        blocks.filter(({ name }) => !validNames.includes(name))
    );

    if (blocksWithUnknownNames.length > 0) {
        return getDiagnostic(documentUri, blocksWithUnknownNames);
    } else {
        return DiagnosticCode.BlocksWithUnknownNamesDefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBlocksWithUnknownNames: RequestFileBlock[]
): Diagnostic {
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
        code: DiagnosticCode.BlocksWithUnknownNamesDefined,
    };
}

function getRange(blocksWithUnknownNames: RequestFileBlock[]): Range {
    return new Range(
        blocksWithUnknownNames[0].nameRange.start,
        blocksWithUnknownNames[blocksWithUnknownNames.length - 1].nameRange.end
    );
}
