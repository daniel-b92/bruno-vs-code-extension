import { Diagnostic, DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlock,
    DictionaryBlockField,
    RequestFileBlock,
} from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getPossibleMethodBlocks } from "../../../../../shared/fileSystem/testFileParsing/internal/getAllMethodBlocks";
import { castBlockToDictionaryBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/castBlockToDictionaryBlock";
import { MethodBlockFieldName } from "../../../../../shared/fileSystem/testFileParsing/definitions/methodBlockFieldNameEnum";
import { isBodyBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/isBodyBlock";
import { getBodyBlockType } from "../../../../../shared/fileSystem/testFileParsing/internal/getBodyBlockType";

export function checkBodyBlockTypeFromMethodBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): Diagnostic | DiagnosticCode {
    const methodBlockField = getBodyTypeFromMethodBlockField(blocks);
    const bodyTypeNameFromBodyBlock = getBodyTypeFromBodyBlockName(blocks);

    if (
        methodBlockField &&
        !bodyTypeNameFromBodyBlock &&
        methodBlockField.value != getBodyBlockTypeForNoDefinedBodyBlock()
    ) {
        return getDiagnosticInCaseOfMissingBodyBlock(methodBlockField);
    }

    if (
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
        return DiagnosticCode.BodyBlockNotMatchingTypeFromMethodBlock;
    }
}

function getDiagnostic(
    documentUri: Uri,
    methodBlockField: DictionaryBlockField,
    bodyBlock: RequestFileBlock
): Diagnostic {
    return {
        message:
            "Body block type does not match defined type from method block.",
        range: methodBlockField.valueRange,
        relatedInformation: [
            {
                message: `Defined body type in body block: '${getBodyBlockType(
                    bodyBlock.name
                )}'`,
                location: {
                    uri: documentUri,
                    range: bodyBlock.nameRange,
                },
            },
        ],
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.BodyBlockNotMatchingTypeFromMethodBlock,
    };
}

function getDiagnosticInCaseOfMissingBodyBlock(
    methodBlockField: DictionaryBlockField
): Diagnostic {
    return {
        message:
            "Missing body block despite definition of body type in method block.",
        range: methodBlockField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.BodyBlockNotMatchingTypeFromMethodBlock,
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

    const bodyField = getBodyFieldFromMethodBlock(castedMethodBlock);

    return bodyField ?? undefined;
}

function getBodyTypeFromBodyBlockName(allBlocks: RequestFileBlock[]) {
    const existingBodyBlocks = allBlocks.filter(({ name }) =>
        isBodyBlock(name)
    );

    return existingBodyBlocks.length == 1
        ? {
              bodyBlock: existingBodyBlocks[0],
              value: getBodyBlockType(existingBodyBlocks[0].name),
          }
        : undefined;
}

function getBodyFieldFromMethodBlock(methodBlock: DictionaryBlock) {
    const bodyFieldsInMethodBlock = methodBlock.content.filter(
        ({ name }) => name == MethodBlockFieldName.Body
    );

    return bodyFieldsInMethodBlock.length == 1
        ? bodyFieldsInMethodBlock[0]
        : undefined;
}

function getBodyBlockTypeForNoDefinedBodyBlock() {
    return "none";
}
