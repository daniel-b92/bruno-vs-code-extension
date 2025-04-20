import { DiagnosticSeverity, Uri } from "vscode";
import {
    castBlockToDictionaryBlock,
    DictionaryBlockField,
    getAuthTypeFromBlockName,
    getPossibleMethodBlocks,
    isAuthBlock,
    MethodBlockKey,
    RequestFileBlock,
} from "../../../../../shared";
import { getFieldFromDictionaryBlock } from "../../util/getFieldFromDictionaryBlock";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkAuthBlockTypeFromMethodBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | NonBlockSpecificDiagnosticCode {
    const methodBlockField = getAuthTypeFromMethodBlock(blocks);
    const authTypeFromAuthBlock = getAuthTypeFromAuthBlock(blocks);

    if (
        methodBlockField &&
        !authTypeFromAuthBlock &&
        !getAuthTypesForNoDefinedAuthBlock().includes(methodBlockField.value)
    ) {
        return getDiagnosticInCaseOfMissingAuthBlock(methodBlockField);
    } else if (
        methodBlockField &&
        authTypeFromAuthBlock &&
        getAuthTypesForNoDefinedAuthBlock().includes(methodBlockField.value)
    ) {
        return getDiagnosticInCaseOfNonExpectedAuthBlock(
            documentUri,
            methodBlockField,
            authTypeFromAuthBlock.authBlock
        );
    } else if (
        methodBlockField &&
        authTypeFromAuthBlock &&
        methodBlockField.value != authTypeFromAuthBlock.value
    ) {
        return getDiagnostic(
            documentUri,
            methodBlockField,
            authTypeFromAuthBlock.authBlock
        );
    } else {
        return getCode();
    }
}

function getDiagnostic(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    authBlock: RequestFileBlock
): DiagnosticWithCode {
    return {
        message: "Auth type does not match name of auth block.",
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined auth type in auth block: '${getAuthTypeFromBlockName(
                    authBlock.name
                )}'`,
                location: {
                    uri: documentUri,
                    range: authBlock.nameRange,
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfMissingAuthBlock(
    methodBlockField: DictionaryBlockField
): DiagnosticWithCode {
    return {
        message:
            "Missing auth block despite definition of auth type in method block.",
        range: methodBlockField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfNonExpectedAuthBlock(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    authBlock: RequestFileBlock
): DiagnosticWithCode {
    return {
        message: `An auth block is defined although the auth type is '${methodBlockField.value}'.`,
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined auth type in auth block: '${getAuthTypeFromBlockName(
                    authBlock.name
                )}'`,
                location: {
                    uri: documentUri,
                    range: authBlock.nameRange,
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getAuthTypeFromMethodBlock(allBlocks: RequestFileBlock[]) {
    const methodBlocks = allBlocks.filter(({ name }) =>
        (getPossibleMethodBlocks() as string[]).includes(name)
    );

    const castedMethodBlock =
        methodBlocks.length == 1
            ? castBlockToDictionaryBlock(methodBlocks[0])
            : undefined;

    if (!castedMethodBlock) {
        return undefined;
    }

    const authField = getFieldFromDictionaryBlock(
        castedMethodBlock,
        MethodBlockKey.Auth
    );

    return authField ?? undefined;
}

function getAuthTypeFromAuthBlock(allBlocks: RequestFileBlock[]) {
    const existingAuthBlocks = allBlocks.filter(({ name }) =>
        isAuthBlock(name)
    );

    return existingAuthBlocks.length == 1
        ? {
              authBlock: existingAuthBlocks[0],
              value: getAuthTypeFromBlockName(existingAuthBlocks[0].name),
          }
        : undefined;
}

function getAuthTypesForNoDefinedAuthBlock() {
    return ["none", "inherit"];
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.AuthBlockNotMatchingTypeFromMethodBlock;
}
