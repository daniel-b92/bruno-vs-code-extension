import {
    DictionaryBlockSimpleField,
    getAllMethodBlocks,
    getActiveFieldFromMethodBlock,
    getMethodBlockBodyFieldValueForBodyName,
    MethodBlockBody,
    Block,
    RequestFileBlockName,
    MethodBlockKey,
    isBodyBlock,
    getBodyTypeFromBlockName,
    isDictionaryBlockSimpleField,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkBodyBlockTypeFromMethodBlockExists(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const methodBlocks = getAllMethodBlocks(blocks);
    const bodyBlocks = blocks.filter(({ name }) => isBodyBlock(name));

    if (methodBlocks.length != 1 || bodyBlocks.length > 1) {
        return undefined;
    }

    const methodBlockField = getActiveFieldFromMethodBlock(
        methodBlocks[0],
        MethodBlockKey.Body,
    );

    if (!methodBlockField || !isDictionaryBlockSimpleField(methodBlockField)) {
        return undefined;
    }

    if (
        bodyBlocks.length == 0 &&
        methodBlockField.value != getBodyBlockTypeForNoDefinedBodyBlock()
    ) {
        return getDiagnosticInCaseOfMissingBodyBlock(methodBlockField);
    } else if (bodyBlocks.length == 0) {
        return undefined;
    }

    const bodyBlock = bodyBlocks[0];

    if (methodBlockField.value == getBodyBlockTypeForNoDefinedBodyBlock()) {
        return getDiagnosticInCaseOfNonExpectedBodyBlock(
            filePath,
            methodBlockField,
            bodyBlock,
        );
    } else if (
        (Object.values(RequestFileBlockName) as string[]).includes(
            bodyBlock.name,
        )
    ) {
        const expectedMethodBlockFieldValue =
            getMethodBlockBodyFieldValueForBodyName(
                bodyBlock.name as RequestFileBlockName,
            );

        return methodBlockField.value != expectedMethodBlockFieldValue
            ? getDiagnostic(
                  filePath,
                  methodBlockField,
                  bodyBlock,
                  expectedMethodBlockFieldValue,
              )
            : undefined;
    } else {
        return undefined;
    }
}

function getDiagnostic(
    filePath: string,
    methodBlockField: DictionaryBlockSimpleField,
    bodyBlock: Block,
    expectedMethodBlockFieldValue: MethodBlockBody,
): DiagnosticWithCode {
    return {
        message: `Does not match name of body block. Expected value: '${expectedMethodBlockFieldValue}'.`,
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined body type in body block: '${getBodyTypeFromBlockName(
                    bodyBlock.name,
                )}'`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range: bodyBlock.nameRange,
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfMissingBodyBlock(
    methodBlockField: DictionaryBlockSimpleField,
): DiagnosticWithCode {
    return {
        message:
            "Missing body block despite definition of body type in method block.",
        range: methodBlockField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfNonExpectedBodyBlock(
    filePath: string,
    methodBlockField: DictionaryBlockSimpleField,
    bodyBlock: Block,
): DiagnosticWithCode {
    return {
        message: `A body block is defined although the body type in the method block is '${methodBlockField.value}'.`,
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined body type in body block: '${getBodyTypeFromBlockName(
                    bodyBlock.name,
                )}'`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range: bodyBlock.nameRange,
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getBodyBlockTypeForNoDefinedBodyBlock() {
    return "none";
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.BodyBlockNotMatchingTypeFromMethodBlock;
}
