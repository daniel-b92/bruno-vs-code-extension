import { DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlockField,
    getAllMethodBlocks,
    RequestFileBlock,
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

    if (methodBlocks.length != 1 || bodyBlocks.length != 1) {
        return undefined;
    }

    const bodyBlock = bodyBlocks[0];
    const methodBlockField = getBodyTypeFromMethodBlockField(methodBlocks[0]);
    const bodyTypeNameFromBodyBlock = getBodyTypeFromBlockName(bodyBlock.name);

    if (
        methodBlockField &&
        !bodyTypeNameFromBodyBlock &&
        methodBlockField.value != getBodyBlockTypeForNoDefinedBodyBlock()
    ) {
        return getDiagnosticInCaseOfMissingBodyBlock(methodBlockField);
    } else if (
        methodBlockField &&
        bodyTypeNameFromBodyBlock &&
        methodBlockField.value == getBodyBlockTypeForNoDefinedBodyBlock()
    ) {
        return getDiagnosticInCaseOfNonExpectedBodyBlock(
            documentUri,
            methodBlockField,
            bodyBlock
        );
    } else if (
        methodBlockField &&
        bodyTypeNameFromBodyBlock &&
        methodBlockField.value != bodyTypeNameFromBodyBlock
    ) {
        return getDiagnostic(documentUri, methodBlockField, bodyBlock);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    bodyBlock: RequestFileBlock
): DiagnosticWithCode {
    return {
        message: "Body type does not match name of body block.",
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
        message: `A body block is defined although the body type in the method block is '${methodBlockField.key}'.`,
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
