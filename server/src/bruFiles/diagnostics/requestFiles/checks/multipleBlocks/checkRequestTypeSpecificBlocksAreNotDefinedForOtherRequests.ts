import {
    DictionaryBlockSimpleField,
    MetaBlockKey,
    Block,
    RequestFileBlockName,
    RequestType,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../../shared/util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

export function checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests(
    filePath: string,
    blocks: Block[],
    specificData: {
        requestType: RequestType;
        specificBlockNames: string[];
        /** Human readable name of the request type, e.g. `GraphQL`. */
        requestTypeLabel: string;
        diagnosticCode: NonBlockSpecificDiagnosticCode;
    },
): DiagnosticWithCode | undefined {
    const { requestType, specificBlockNames } = specificData;
    const metaBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Meta,
    );

    if (metaBlocks.length != 1) {
        return undefined;
    }

    const requestTypeField =
        getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
            blocks,
            RequestFileBlockName.Meta,
            MetaBlockKey.Type,
        );

    if (!requestTypeField || requestTypeField.value == requestType) {
        return undefined;
    }

    const invalidBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => specificBlockNames.includes(name)),
    );

    return invalidBlocks.length > 0
        ? getDiagnostic(filePath, invalidBlocks, requestTypeField, specificData)
        : undefined;
}

function getDiagnostic(
    filePath: string,
    sortedInvalidBlocks: Block[],
    requestTypeField: DictionaryBlockSimpleField,
    {
        requestType,
        requestTypeLabel,
        diagnosticCode,
    }: {
        requestType: RequestType;
        requestTypeLabel: string;
        diagnosticCode: NonBlockSpecificDiagnosticCode;
    },
): DiagnosticWithCode {
    return {
        message: `${requestTypeLabel} specific blocks defined without using request type '${requestType}'.`,
        range: requestTypeField.valueRange,
        relatedInformation: sortedInvalidBlocks.map(({ name, nameRange }) => ({
            message: `Block with ${requestTypeLabel} specific name '${name}'`,
            location: { uri: URI.file(filePath).toString(), range: nameRange },
        })),
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}
