import {
    DictionaryBlockSimpleField,
    getAllMethodBlocks,
    getAuthTypeFromBlockName,
    getFieldFromMethodBlock,
    isAuthBlock,
    MethodBlockKey,
    Block,
    isDictionaryBlockSimpleField,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkAuthBlockTypeFromMethodBlockExists(
    filePath: string,
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
            filePath,
            methodBlockField,
            authTypeFromAuthBlock.authBlock,
        );
    } else if (
        authTypeFromAuthBlock &&
        methodBlockField.value != authTypeFromAuthBlock.value
    ) {
        return getDiagnostic(
            filePath,
            methodBlockField,
            authTypeFromAuthBlock.authBlock,
        );
    } else {
        return undefined;
    }
}

function getDiagnostic(
    filePath: string,
    methodBlockField: DictionaryBlockSimpleField,
    authBlock: Block,
): DiagnosticWithCode {
    return {
        message: "Auth type does not match name of auth block.",
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined auth type in auth block: '${getAuthTypeFromBlockName(
                    authBlock.name,
                )}'`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range: authBlock.nameRange,
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
        range: methodBlockField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfNonExpectedAuthBlock(
    filePath: string,
    methodBlockField: DictionaryBlockSimpleField,
    authBlock: Block,
): DiagnosticWithCode {
    return {
        message: `An auth block is defined although the auth type is '${methodBlockField.value}'.`,
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined auth type in auth block: '${getAuthTypeFromBlockName(
                    authBlock.name,
                )}'`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range: authBlock.nameRange,
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
