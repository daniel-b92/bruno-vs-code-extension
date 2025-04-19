import { Diagnostic, DiagnosticSeverity } from "vscode";
import { DictionaryBlock, RequestFileBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { castBlockToDictionaryBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/castBlockToDictionaryBlock";
import { MetaBlockKey } from "../../../../../shared/fileSystem/testFileParsing/definitions/metaBlockKeyEnum";
import { getMissingKeysForDictionaryBlock } from "../../util/getMissingKeysForDictionaryBlock";

export function checkNoKeysAreMissingInMetaBlock(
    metaBlock: RequestFileBlock
): Diagnostic | DiagnosticCode {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return DiagnosticCode.KeysMissingInMetaBlock;
    }

    const missingKeys = getMissingKeysForDictionaryBlock(
        castedMetaBlock,
        Object.values(MetaBlockKey)
    );

    if (missingKeys.length > 0) {
        return getDiagnostic(castedMetaBlock, missingKeys);
    } else {
        return DiagnosticCode.KeysMissingInMetaBlock;
    }
}

function getDiagnostic(metaBlock: DictionaryBlock, missingFields: string[]) {
    return {
        message:
            missingFields.length == 1
                ? `Mandatory key '${missingFields[0]}' is missing.`
                : `Mandatory keys '${missingFields.join("', '")}' are missing.`,
        range: metaBlock.contentRange,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.KeysMissingInMetaBlock,
    };
}
