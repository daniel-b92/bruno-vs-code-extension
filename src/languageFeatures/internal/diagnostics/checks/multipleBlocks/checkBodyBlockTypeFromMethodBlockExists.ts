import { DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlockField,
    getAllMethodBlocks,
    getMethodBlockBodyFieldValueForBodyName,
    MethodBlockBody,
    RequestFileBlock,
    RequestFileBlockName,
} from "../../../../../shared";
import {
    castBlockToDictionaryBlock,
    MethodBlockKey,
    isBodyBlock,
    getBodyTypeFromBlockName,
} from "../../../../../shared";
import { getFieldFromDictionaryBlock } from "../../util/getFieldFromDictionaryBlock";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkBodyBlockTypeFromMethodBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | undefined {
    const methodBlocks = getAllMethodBlocks(blocks);
    const bodyBlocks = blocks.filter(({ name }) => isBodyBlock(name));

    if (methodBlocks.length != 1 || bodyBlocks.length > 1) {
        return undefined;
    }

    const methodBlockField = getBodyTypeFromMethodBlockField(methodBlocks[0]);

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
    bodyBlock: RequestFileBlock,
    expectedMethodBlockFieldValue: MethodBlockBody
): DiagnosticWithCode {
    return {
        message: `Does not match name of body block. Expected value: '${expectedMethodBlockFieldValue}'.`,
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined body type in body block: '${getBodyTypeFromBlockName(
                    bodyBlock.name
                )}'`,
                location: {
                    uri: documentUri,
                    range: bodyBlock.nameRange,
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
        range: methodBlockField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getDiagnosticInCaseOfNonExpectedBodyBlock(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    bodyBlock: RequestFileBlock
): DiagnosticWithCode {
    return {
        message: `A body block is defined although the body type in the method block is '${methodBlockField.value}'.`,
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined body type in body block: '${getBodyTypeFromBlockName(
                    bodyBlock.name
                )}'`,
                location: {
                    uri: documentUri,
                    range: bodyBlock.nameRange,
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getBodyTypeFromMethodBlockField(methodBlock: RequestFileBlock) {
    const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);

    if (!castedMethodBlock) {
        return undefined;
    }

    const bodyField = getFieldFromDictionaryBlock(
        castedMethodBlock,
        MethodBlockKey.Body
    );

    return bodyField ?? undefined;
}

function getBodyBlockTypeForNoDefinedBodyBlock() {
    return "none";
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.BodyBlockNotMatchingTypeFromMethodBlock;
}
