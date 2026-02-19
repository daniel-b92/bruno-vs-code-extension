import {
    DictionaryBlockSimpleField,
    getFieldFromMetaBlock,
    MetaBlockKey,
    Block,
    RequestFileBlockName,
    RequestType,
    isDictionaryBlockSimpleField,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../../shared/util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

export function checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const graphQlSpecificBlockNames = [
        RequestFileBlockName.GraphQlBody,
        RequestFileBlockName.GraphQlBodyVars,
    ];

    const metaBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Meta,
    );

    if (metaBlocks.length != 1) {
        return undefined;
    }

    const requestTypeField = getFieldFromMetaBlock(
        metaBlocks[0],
        MetaBlockKey.Type,
    );

    if (
        !requestTypeField ||
        !isDictionaryBlockSimpleField(requestTypeField) ||
        requestTypeField.value == RequestType.Graphql
    ) {
        return undefined;
    }

    const invalidBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) =>
            (graphQlSpecificBlockNames as string[]).includes(name),
        ),
    );

    if (invalidBlocks.length > 0) {
        return getDiagnostic(filePath, invalidBlocks, requestTypeField);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    filePath: string,
    sortedInvalidBlocks: Block[],
    requestTypeField: DictionaryBlockSimpleField,
): DiagnosticWithCode {
    return {
        message: `GraphQL specific blocks defined without using request type '${RequestType.Graphql}'.`,
        range: requestTypeField.valueRange,
        relatedInformation: sortedInvalidBlocks.map(({ name, nameRange }) => ({
            message: `Block with GraphQl specific name '${name}'`,
            location: { uri: URI.file(filePath).toString(), range: nameRange },
        })),
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.GraphQlBlocksDefinedForNonGraphQlRequestType,
    };
}
