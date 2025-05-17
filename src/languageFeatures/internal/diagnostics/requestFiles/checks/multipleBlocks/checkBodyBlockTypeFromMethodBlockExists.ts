import { DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlockField,
    getAllMethodBlocks,
    getFieldFromMethodBlock,
    getMethodBlockBodyFieldValueForBodyName,
    MethodBlockBody,
    Block,
    RequestFileBlockName,
    MethodBlockKey,
    isBodyBlock,
    getBodyTypeFromBlockName,
    mapRange,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkBodyBlockTypeFromMethodBlockExists(
    documentUri: Uri,
    blocks: Block[]
): DiagnosticWithCode | undefined {
    const methodBlocks = getAllMethodBlocks(blocks);
    const bodyBlocks = blocks.filter(({ name }) => isBodyBlock(name));

    if (methodBlocks.length != 1 || bodyBlocks.length > 1) {
        return undefined;
    }

    const methodBlockField = getFieldFromMethodBlock(
        methodBlocks[0],
        MethodBlockKey.Body
    );

    if (!methodBlockField) {
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
            documentUri,
            methodBlockField,
            bodyBlock
        );
    } else if (
        (Object.values(RequestFileBlockName) as string[]).includes(
            bodyBlock.name
        )
    ) {
        const expectedMethodBlockFieldValue =
            getMethodBlockBodyFieldValueForBodyName(
                bodyBlock.name as RequestFileBlockName
            );

        return methodBlockField.value != expectedMethodBlockFieldValue
            ? getDiagnostic(
                  documentUri,
                  methodBlockField,
                  bodyBlock,
                  expectedMethodBlockFieldValue
              )
            : undefined;
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    bodyBlock: Block,
    expectedMethodBlockFieldValue: MethodBlockBody
): DiagnosticWithCode {
    return {
        message: `Does not match name of body block. Expected value: '${expectedMethodBlockFieldValue}'.`,
        range: mapRange(methodBlockField.valueRange),
        relatedInformation: [
            {
                message: `Defined body type in body block: '${getBodyTypeFromBlockName(
                    bodyBlock.name
                )}'`,
                location: {
                    uri: documentUri,
                    range: mapRange(bodyBlock.nameRange),
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfMissingBodyBlock(
    methodBlockField: DictionaryBlockField
): DiagnosticWithCode {
    return {
        message:
            "Missing body block despite definition of body type in method block.",
        range: mapRange(methodBlockField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfNonExpectedBodyBlock(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    bodyBlock: Block
): DiagnosticWithCode {
    return {
        message: `A body block is defined although the body type in the method block is '${methodBlockField.value}'.`,
        range: mapRange(methodBlockField.valueRange),
        relatedInformation: [
            {
                message: `Defined body type in body block: '${getBodyTypeFromBlockName(
                    bodyBlock.name
                )}'`,
                location: {
                    uri: documentUri,
                    range: mapRange(bodyBlock.nameRange),
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
