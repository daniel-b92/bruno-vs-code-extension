import { DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlockField,
    getAuthTypeFromBlockName,
    isAuthBlock,
    Block,
    mapRange,
    SettingsFileSpecificBlock,
    getFieldFromDictionaryBlock,
    castBlockToDictionaryBlock,
    AuthModeBlockKey,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkAuthBlockTypeFromAuthModeBlockExists(
    documentUri: Uri,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const authModeBlocks = blocks.filter(
        ({ name }) => name == SettingsFileSpecificBlock.AuthMode,
    );
    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (authModeBlocks.length != 1 || authBlocks.length > 1) {
        return undefined;
    }

    const castedAuthModeBlock = castBlockToDictionaryBlock(authModeBlocks[0]);

    if (!castedAuthModeBlock) {
        return undefined;
    }

    const authModeField = getFieldFromDictionaryBlock(
        castedAuthModeBlock,
        AuthModeBlockKey.Mode,
    );

    const authTypeFromAuthBlock =
        authBlocks.length > 0
            ? getAuthTypeFromAuthBlock(authBlocks[0])
            : undefined;

    if (
        authModeField &&
        !authTypeFromAuthBlock &&
        !getAuthTypesForNoDefinedAuthBlock().includes(authModeField.value)
    ) {
        return getDiagnosticInCaseOfMissingAuthBlock(authModeField);
    } else if (
        authModeField &&
        authTypeFromAuthBlock &&
        getAuthTypesForNoDefinedAuthBlock().includes(authModeField.value)
    ) {
        return getDiagnosticInCaseOfNonExpectedAuthBlock(
            documentUri,
            authModeField,
            authTypeFromAuthBlock.authBlock,
        );
    } else if (
        authModeField &&
        authTypeFromAuthBlock &&
        authModeField.value != authTypeFromAuthBlock.value
    ) {
        return getDiagnostic(
            documentUri,
            authModeField,
            authTypeFromAuthBlock.authBlock,
        );
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    authModeField: DictionaryBlockField,
    authBlock: Block,
): DiagnosticWithCode {
    return {
        message: "Auth type does not match name of auth mode.",
        range: mapRange(authModeField.valueRange),
        relatedInformation: [
            {
                message: `Defined auth type in auth block: '${getAuthTypeFromBlockName(
                    authBlock.name,
                )}'`,
                location: {
                    uri: documentUri,
                    range: mapRange(authBlock.nameRange),
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfMissingAuthBlock(
    authModeField: DictionaryBlockField,
): DiagnosticWithCode {
    return {
        message: "Missing auth block for defined auth mode.",
        range: mapRange(authModeField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfNonExpectedAuthBlock(
    documentUri: Uri,
    authModeField: DictionaryBlockField,
    authBlock: Block,
): DiagnosticWithCode {
    return {
        message: `An auth block is defined although the auth mode is '${authModeField.value}'.`,
        range: mapRange(authModeField.valueRange),
        relatedInformation: [
            {
                message: `Defined auth type in auth block: '${getAuthTypeFromBlockName(
                    authBlock.name,
                )}'`,
                location: {
                    uri: documentUri,
                    range: mapRange(authBlock.nameRange),
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
