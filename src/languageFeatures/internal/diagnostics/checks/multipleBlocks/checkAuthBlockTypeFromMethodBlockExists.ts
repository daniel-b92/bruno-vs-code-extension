import { Diagnostic, DiagnosticSeverity, Uri } from "vscode";
import { DictionaryBlockField, RequestFileBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getPossibleMethodBlocks } from "../../../../../shared/fileSystem/testFileParsing/internal/getAllMethodBlocks";
import { castBlockToDictionaryBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/castBlockToDictionaryBlock";
import { MethodBlockKey } from "../../../../../shared/fileSystem/testFileParsing/definitions/methodBlockKeyEnum";
import { getFieldFromDictionaryBlock } from "../../util/getFieldFromDictionaryBlock";
import { isAuthBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/isAuthBlock";
import { getAuthTypeFromBlockName } from "../../../../../shared/fileSystem/testFileParsing/internal/getAuthTypeFromBlockName";

export function checkAuthBlockTypeFromMethodBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): Diagnostic | DiagnosticCode {
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
        return DiagnosticCode.AuthBlockNotMatchingTypeFromMethodBlock;
    }
}

function getDiagnostic(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    authBlock: RequestFileBlock
): Diagnostic {
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
        code: DiagnosticCode.AuthBlockNotMatchingTypeFromMethodBlock,
    };
}

function getDiagnosticInCaseOfMissingAuthBlock(
    methodBlockField: DictionaryBlockField
): Diagnostic {
    return {
        message:
            "Missing auth block despite definition of auth type in method block.",
        range: methodBlockField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.AuthBlockNotMatchingTypeFromMethodBlock,
    };
}

function getDiagnosticInCaseOfNonExpectedAuthBlock(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    authBlock: RequestFileBlock
): Diagnostic {
    return {
        message: `An auth block is defined although the auth type in the method block is '${methodBlockField.key}'.`,
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
        code: DiagnosticCode.AuthBlockNotMatchingTypeFromMethodBlock,
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
