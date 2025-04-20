import { DiagnosticSeverity, Uri } from "vscode";
import { DictionaryBlockField, RequestFileBlock } from "../../../../../shared";
import {
    getPossibleMethodBlocks,
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
): DiagnosticWithCode | NonBlockSpecificDiagnosticCode {
    const methodBlockField = getBodyTypeFromMethodBlockField(blocks);
    const bodyTypeNameFromBodyBlock = getBodyTypeFromBodyBlockName(blocks);

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
            bodyTypeNameFromBodyBlock.bodyBlock
        );
    } else if (
        methodBlockField &&
        bodyTypeNameFromBodyBlock &&
        methodBlockField.value != bodyTypeNameFromBodyBlock.value
    ) {
        return getDiagnostic(
            documentUri,
            methodBlockField,
            bodyTypeNameFromBodyBlock.bodyBlock
        );
    } else {
        return getCode();
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

function getBodyTypeFromMethodBlockField(allBlocks: RequestFileBlock[]) {
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

    const bodyField = getFieldFromDictionaryBlock(
        castedMethodBlock,
        MethodBlockKey.Body
    );

    return bodyField ?? undefined;
}

function getBodyTypeFromBodyBlockName(allBlocks: RequestFileBlock[]) {
    const existingBodyBlocks = allBlocks.filter(({ name }) =>
        isBodyBlock(name)
    );

    return existingBodyBlocks.length == 1
        ? {
              bodyBlock: existingBodyBlocks[0],
              value: getBodyTypeFromBlockName(existingBodyBlocks[0].name),
          }
        : undefined;
}

function getBodyBlockTypeForNoDefinedBodyBlock() {
    return "none";
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.BodyBlockNotMatchingTypeFromMethodBlock;
}
