import {
    DictionaryBlockSimpleField,
    getAuthTypeFromBlockName,
    isAuthBlock,
    Block,
    SettingsFileSpecificBlock,
    getActiveFieldFromDictionaryBlock,
    isBlockDictionaryBlock,
    AuthModeBlockKey,
    isDictionaryBlockSimpleField,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkAuthBlockTypeFromAuthModeBlockExists(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const authModeBlocks = blocks.filter(
        ({ name }) => name == SettingsFileSpecificBlock.AuthMode,
    );
    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (authModeBlocks.length != 1 || authBlocks.length > 1) {
        return undefined;
    }

    const authModeBlock = authModeBlocks[0];

    if (!isBlockDictionaryBlock(authModeBlock)) {
        return undefined;
    }

    const authModeField = getActiveFieldFromDictionaryBlock(
        authModeBlock,
        AuthModeBlockKey.Mode,
    );

    const authTypeFromAuthBlock =
        authBlocks.length > 0
            ? getAuthTypeFromAuthBlock(authBlocks[0])
            : undefined;

    if (
        authModeField &&
        isDictionaryBlockSimpleField(authModeField) &&
        !authTypeFromAuthBlock &&
        !getAuthTypesForNoDefinedAuthBlock().includes(authModeField.value)
    ) {
        return getDiagnosticInCaseOfMissingAuthBlock(authModeField);
    } else if (
        authModeField &&
        isDictionaryBlockSimpleField(authModeField) &&
        authTypeFromAuthBlock &&
        getAuthTypesForNoDefinedAuthBlock().includes(authModeField.value)
    ) {
        return getDiagnosticInCaseOfNonExpectedAuthBlock(
            filePath,
            authModeField,
            authTypeFromAuthBlock.authBlock,
        );
    } else if (
        authModeField &&
        isDictionaryBlockSimpleField(authModeField) &&
        authTypeFromAuthBlock &&
        authModeField.value != authTypeFromAuthBlock.value
    ) {
        return getDiagnostic(
            filePath,
            authModeField,
            authTypeFromAuthBlock.authBlock,
        );
    } else {
        return undefined;
    }
}

function getDiagnostic(
    filePath: string,
    authModeField: DictionaryBlockSimpleField,
    authBlock: Block,
): DiagnosticWithCode {
    return {
        message: "Auth type does not match name of auth mode.",
        range: authModeField.valueRange,
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
    authModeField: DictionaryBlockSimpleField,
): DiagnosticWithCode {
    return {
        message: "Missing auth block for defined auth mode.",
        range: authModeField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfNonExpectedAuthBlock(
    filePath: string,
    authModeField: DictionaryBlockSimpleField,
    authBlock: Block,
): DiagnosticWithCode {
    return {
        message: `An auth block is defined although the auth mode is '${authModeField.value}'.`,
        range: authModeField.valueRange,
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
    return NonBlockSpecificDiagnosticCode.AuthBlockNotMatchingAuthModeBlock;
}
