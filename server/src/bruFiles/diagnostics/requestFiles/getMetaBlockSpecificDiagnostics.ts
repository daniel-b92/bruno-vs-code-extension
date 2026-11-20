import {
    TextDocumentHelper,
    Block,
    MetaBlockKey,
    RequestType,
    isDictionaryBlockSimpleField,
    DictionaryBlock,
    BrunoFileType,
    getActiveFieldFromDictionaryBlock,
} from "@global_shared";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { getCommonMetaBlockDiagnostics } from "../shared/checks/singleBlocks/getCommonMetaBlockDiagnostics";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";
import { checkSequenceDoesNotClashWithAppFiles } from "../shared/checks/singleBlocks/checkSequenceDoesNotClashWithAppFiles";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";
import { TypedCollectionItemProvider } from "../../../shared";

export function getMetaBlockSpecificDiagnostics(data: {
    itemProvider: TypedCollectionItemProvider;
    relatedFilesHelper: RelatedFilesDiagnosticsHelper;
    filePath: string;
    documentHelper: TextDocumentHelper;
    metaBlock: DictionaryBlock;
}): (DiagnosticWithCode | undefined)[] {
    const {
        documentHelper,
        filePath,
        itemProvider,
        metaBlock,
        relatedFilesHelper,
    } = data;
    const typeField = getActiveFieldFromDictionaryBlock(
        metaBlock,
        MetaBlockKey.Type,
    );

    const diagnostics = [
        ...getCommonMetaBlockDiagnostics({
            filePath,
            fileType: BrunoFileType.RequestFile,
            documentHelper,
            metaBlock,
        }),
        typeField && isDictionaryBlockSimpleField(typeField)
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  typeField,
                  Object.values(RequestType),
                  RelevantWithinMetaBlockDiagnosticCode.RequestTypeNotValid,
              )
            : undefined,
    ];

    diagnostics.push(
        checkSequenceDoesNotClashWithAppFiles({
            metaBlock,
            filePath,
            fileType: BrunoFileType.RequestFile,
            itemProvider,
        }),
    );

    for (const results of provideRelatedFilesDiagnosticsForMetaBlock({
        itemProvider,
        metaBlock,
        filePath,
        relatedFilesHelper,
        docHelper: documentHelper,
    })) {
        diagnostics.push(results.result);
    }

    return diagnostics;
}

function provideRelatedFilesDiagnosticsForMetaBlock(data: {
    metaBlock: Block;
    filePath: string;
    itemProvider: TypedCollectionItemProvider;
    docHelper: TextDocumentHelper;
    relatedFilesHelper: RelatedFilesDiagnosticsHelper;
}): {
    filePath: string;
    result: DiagnosticWithCode;
}[] {
    const { filePath, relatedFilesHelper: relatedRequestsHelper } = data;
    const { code, toAdd } = checkSequenceInMetaBlockIsUniqueWithinFolder(data);

    if (toAdd) {
        relatedRequestsHelper.registerDiagnostic({
            files: toAdd.affectedFiles,
            diagnosticCode: code,
        });

        return [{ filePath, result: toAdd.diagnosticCurrentFile }];
    } else {
        relatedRequestsHelper.unregisterDiagnostic(filePath, code);
        return [];
    }
}
