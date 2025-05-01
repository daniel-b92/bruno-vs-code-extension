import { DiagnosticSeverity, Range, Uri } from "vscode";
import {
    DictionaryBlockField,
    MetaBlockKey,
    RequestFileBlock,
    RequestFileBlockName,
    RequestType,
} from "../../../../../shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getFieldFromMetaBlock } from "../../../../../shared/languageUtils/metaBlock/getFieldFromMetaBlock";

export function checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | undefined {
    const graphQlSpecificBlockName = RequestFileBlockName.GraphQlBodyVars;

    const metaBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Meta
    );

    if (metaBlocks.length != 1) {
        return undefined;
    }

    const requestTypeField = getFieldFromMetaBlock(
        metaBlocks[0],
        MetaBlockKey.Type
    );

    if (!requestTypeField || requestTypeField.value == RequestType.Graphql) {
        return undefined;
    }

    const invalidBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => name == graphQlSpecificBlockName)
    );

    if (invalidBlocks.length > 0) {
        return getDiagnostic(documentUri, invalidBlocks, requestTypeField);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedInvalidBlocks: RequestFileBlock[],
    requestTypeField: DictionaryBlockField
): DiagnosticWithCode {
    return {
        message: `GraphQL specific blocks defined without using request type '${RequestType.Graphql}'.`,
        range: getRange(sortedInvalidBlocks),
        relatedInformation: [
            {
                message: `Defined request type: '${requestTypeField.value}'`,
                location: {
                    uri: documentUri,
                    range: requestTypeField.valueRange,
                },
            },
        ].concat(
            sortedInvalidBlocks.length > 1
                ? sortedInvalidBlocks.map(({ name, nameRange }) => ({
                      message: `Block with GraphQl specific name '${name}'`,
                      location: { uri: documentUri, range: nameRange },
                  }))
                : []
        ),
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.GraphQlBlocksDefinedForNonGraphQlRequestType,
    };
}

function getRange(blocksWithUnknownNames: RequestFileBlock[]): Range {
    return new Range(
        blocksWithUnknownNames[0].nameRange.start,
        blocksWithUnknownNames[blocksWithUnknownNames.length - 1].nameRange.end
    );
}
