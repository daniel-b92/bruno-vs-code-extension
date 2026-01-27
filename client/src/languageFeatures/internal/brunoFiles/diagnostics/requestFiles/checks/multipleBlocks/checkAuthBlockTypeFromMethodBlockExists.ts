import { DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlockSimpleField,
    getAllMethodBlocks,
    getAuthTypeFromBlockName,
    getFieldFromMethodBlock,
    isAuthBlock,
    MethodBlockKey,
    Block,
    mapToVsCodeRange,
    isDictionaryBlockSimpleField,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkAuthBlockTypeFromMethodBlockExists(
    documentUri: Uri,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const methodBlocks = getAllMethodBlocks(blocks);
    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (methodBlocks.length != 1 || authBlocks.length > 1) {
        return undefined;
    }

    const methodBlockField = getFieldFromMethodBlock(
        methodBlocks[0],
        MethodBlockKey.Auth,
    );
    const authTypeFromAuthBlock =
        authBlocks.length > 0
            ? getAuthTypeFromAuthBlock(authBlocks[0])
            : undefined;

    if (!methodBlockField || !isDictionaryBlockSimpleField(methodBlockField)) {
        return undefined;
    }

    if (
        !authTypeFromAuthBlock &&
        !getAuthTypesForNoDefinedAuthBlock().includes(methodBlockField.value)
    ) {
        return getDiagnosticInCaseOfMissingAuthBlock(methodBlockField);
    } else if (
        authTypeFromAuthBlock &&
        getAuthTypesForNoDefinedAuthBlock().includes(methodBlockField.value)
    ) {
        return getDiagnosticInCaseOfNonExpectedAuthBlock(
            documentUri,
            methodBlockField,
            authTypeFromAuthBlock.authBlock,
        );
    } else if (
        authTypeFromAuthBlock &&
        methodBlockField.value != authTypeFromAuthBlock.value
    ) {
        return getDiagnostic(
            documentUri,
            methodBlockField,
            authTypeFromAuthBlock.authBlock,
        );
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    methodBlockField: DictionaryBlockSimpleField,
    authBlock: Block,
): DiagnosticWithCode {
    return {
        message: "Auth type does not match name of auth block.",
        range: mapToVsCodeRange(methodBlockField.valueRange),
        relatedInformation: [
            {
                message: `Defined auth type in auth block: '${getAuthTypeFromBlockName(
                    authBlock.name,
                )}'`,
                location: {
                    uri: documentUri,
                    range: mapToVsCodeRange(authBlock.nameRange),
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfMissingAuthBlock(
    methodBlockField: DictionaryBlockSimpleField,
): DiagnosticWithCode {
    return {
        message:
            "Missing auth block despite definition of auth type in method block.",
        range: mapToVsCodeRange(methodBlockField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfNonExpectedAuthBlock(
    documentUri: Uri,
    methodBlockField: DictionaryBlockSimpleField,
    authBlock: Block,
): DiagnosticWithCode {
    return {
        message: `An auth block is defined although the auth type is '${methodBlockField.value}'.`,
        range: mapToVsCodeRange(methodBlockField.valueRange),
        relatedInformation: [
            {
                message: `Defined auth type in auth block: '${getAuthTypeFromBlockName(
                    authBlock.name,
                )}'`,
                location: {
                    uri: documentUri,
                    range: mapToVsCodeRange(authBlock.nameRange),
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getAuthTypeFromAuthBlock(authBlock: Block) {
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
