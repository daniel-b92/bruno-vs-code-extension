import { DiagnosticSeverity, Uri } from "vscode";
import {
    castBlockToDictionaryBlock,
    DictionaryBlockField,
    getAllMethodBlocks,
    getAuthTypeFromBlockName,
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
): DiagnosticWithCode | undefined {
    const methodBlocks = getAllMethodBlocks(blocks);
    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (methodBlocks.length != 1 || authBlocks.length > 1) {
        return undefined;
    }

    const methodBlockField = getAuthTypeFromMethodBlock(methodBlocks[0]);
    const authTypeFromAuthBlock =
        authBlocks.length > 0
            ? getAuthTypeFromAuthBlock(authBlocks[0])
            : undefined;

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
        return undefined;
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

function getAuthTypeFromMethodBlock(methodBlock: RequestFileBlock) {
    const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);

    if (!castedMethodBlock) {
        return undefined;
    }

    const authField = getFieldFromDictionaryBlock(
        castedMethodBlock,
        MethodBlockKey.Auth
    );

    return authField ?? undefined;
}

function getAuthTypeFromAuthBlock(authBlock: RequestFileBlock) {
    return {
        authBlock,
        value: getAuthTypeFromBlockName(authBlock.name),
    };
}

function getAuthTypesForNoDefinedAuthBlock() {
    return ["none", "inherit"];
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.AuthBlockNotMatchingTypeFromMethodBlock;
}
