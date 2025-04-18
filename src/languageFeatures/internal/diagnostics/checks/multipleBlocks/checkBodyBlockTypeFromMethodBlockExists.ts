import { Diagnostic, DiagnosticSeverity, Uri } from "vscode";
import { DictionaryBlock, RequestFileBlock } from "../../../../../shared";
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
    const bodyTypeAccordingToMethodBlock =
        getBodyTypeFromMethodBlockField(blocks);
    const bodyTypeNameFromBodyBlock = getBodyTypeFromBodyBlockName(blocks);

    // ToDo: handle case where no body is defined in method block (value: 'none')

    if (
        bodyTypeAccordingToMethodBlock &&
        bodyTypeNameFromBodyBlock &&
        bodyTypeAccordingToMethodBlock.value != bodyTypeNameFromBodyBlock.value
    ) {
        return getDiagnostic(
            documentUri,
            bodyTypeAccordingToMethodBlock.methodBlock,
            bodyTypeNameFromBodyBlock.bodyBlock
        );
    } else {
        return DiagnosticCode.BodyBlockNotMatchingTypeFromMethodBlock;
    }
}

function getDiagnostic(
    documentUri: Uri,
    methodBlock: DictionaryBlock,
    bodyBlock: RequestFileBlock
): Diagnostic {
    const methodBlockField = getBodyFieldFromMethodBlock(methodBlock);

    return {
        message:
            "Body block type does not match defined type from method block.",
        range: bodyBlock.nameRange,
        relatedInformation: methodBlockField
            ? [
                  {
                      message: `Defined body type in method block: '${methodBlockField.value}'`,
                      location: {
                          uri: documentUri,
                          range: methodBlockField.valueRange,
                      },
                  },
              ]
            : undefined,

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

    return bodyField != undefined
        ? {
              methodBlock: castedMethodBlock,
              value: bodyField.value,
          }
        : undefined;
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
