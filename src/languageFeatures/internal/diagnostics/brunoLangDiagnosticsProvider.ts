import { Diagnostic, DiagnosticCollection, Uri } from "vscode";
import { checkMetaBlockStartsInFirstLine } from "./checks/singleBlocks/metaBlock/checkMetaBlockStartsInFirstLine";
import {
    castBlockToDictionaryBlock,
    CollectionItemProvider,
    getAllMethodBlocks,
    MetaBlockKey,
    MethodBlockKey,
    parseTestFile,
    RequestFileBlock,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { checkOccurencesOfMandatoryBlocks } from "./checks/multipleBlocks/checkOccurencesOfMandatoryBlocks";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "./checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "./checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneAuthBlockExists } from "./checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAtMostOneBodyBlockExists } from "./checks/multipleBlocks/checkAtMostOneBodyBlockExists";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";
import { RelatedRequestsDiagnosticsHelper } from "./helpers/relatedRequestsDiagnosticsHelper";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { DiagnosticCode } from "./diagnosticCodeEnum";
import { checkBodyBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkBodyBlockTypeFromMethodBlockExists";
import { checkAuthBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkAuthBlockTypeFromMethodBlockExists";
import { checkNoBlocksHaveUnknownNames } from "./checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkDictionaryBlocksHaveDictionaryStructure } from "./checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { checkSequenceInMetaBlockIsNumeric } from "./checks/singleBlocks/metaBlock/checkSequenceInMetaBlockIsNumeric";
import { checkNoUnknownKeysAreDefinedInMetaBlock } from "./checks/singleBlocks/metaBlock/checkNoUnknownKeysAreDefinedInMetaBlock";
import { checkNoDuplicateKeysAreDefinedInMetaBlock } from "./checks/singleBlocks/metaBlock/checkNoDuplicateKeysAreDefinedInMetaBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "./checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";

export class BrunoLangDiagnosticsProvider {
    constructor(
        private diagnosticCollection: DiagnosticCollection,
        private itemProvider: CollectionItemProvider
    ) {
        this.relatedRequestsHelper = new RelatedRequestsDiagnosticsHelper();
    }

    private relatedRequestsHelper: RelatedRequestsDiagnosticsHelper;

    public dispose() {}

    public provideDiagnostics(documentUri: Uri, documentText: string) {
        const document = new TextDocumentHelper(documentText);
        const { blocks, textOutsideOfBlocks } = parseTestFile(document);

        const { toAdd, toRemove } = checkOccurencesOfMandatoryBlocks(
            document,
            blocks
        );

        this.handleResults(documentUri, [
            ...toAdd,
            ...toRemove,
            checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
            checkThatNoTextExistsOutsideOfBlocks(
                documentUri,
                textOutsideOfBlocks
            ),
            checkAtMostOneAuthBlockExists(documentUri, blocks),
            checkAtMostOneBodyBlockExists(documentUri, blocks),
            checkAuthBlockTypeFromMethodBlockExists(documentUri, blocks),
            checkBodyBlockTypeFromMethodBlockExists(documentUri, blocks),
            checkNoBlocksHaveUnknownNames(documentUri, blocks),
            checkDictionaryBlocksHaveDictionaryStructure(documentUri, blocks),
        ]);

        const metaBlocks = blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlocks.length == 1) {
            this.provideMetaBlockSpecificDiagnostics(
                documentUri,
                document,
                metaBlocks[0]
            );
        }

        const methodBlocks = getAllMethodBlocks(blocks);

        if (methodBlocks.length == 1) {
            this.provideMethodBlockSpecificDiagnostics(
                documentUri,
                methodBlocks[0]
            );
        }
    }

    private provideMetaBlockSpecificDiagnostics(
        documentUri: Uri,
        documentHelper: TextDocumentHelper,
        metaBlock: RequestFileBlock
    ) {
        const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

        this.handleResults(documentUri, [
            checkSequenceInMetaBlockIsNumeric(metaBlock),
            castedMetaBlock
                ? checkNoKeysAreMissingForDictionaryBlock(
                      castedMetaBlock,
                      Object.values(MetaBlockKey),
                      DiagnosticCode.KeysMissingInMetaBlock
                  )
                : undefined,
            checkNoUnknownKeysAreDefinedInMetaBlock(metaBlock),
            checkNoDuplicateKeysAreDefinedInMetaBlock(metaBlock),
            checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
        ]);

        for (const results of this.provideRelatedRequestsDiagnosticsForMetaBlock(
            this.itemProvider,
            metaBlock,
            documentUri,
            this.relatedRequestsHelper
        )) {
            this.handleResults(results.uri, [results.result]);
        }
    }

    private provideMethodBlockSpecificDiagnostics(
        documentUri: Uri,
        methodBlock: RequestFileBlock
    ) {
        const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);

        this.handleResults(documentUri, [
            castedMethodBlock
                ? checkNoKeysAreMissingForDictionaryBlock(
                      castedMethodBlock,
                      Object.values(MethodBlockKey),
                      DiagnosticCode.KeysMissingInMethodBlock
                  )
                : undefined,
        ]);
    }

    private handleResults(
        documentUri: Uri,
        results: (Diagnostic | DiagnosticCode | undefined)[]
    ) {
        for (const result of results) {
            if (result && typeof result != "string") {
                addDiagnosticForDocument(
                    documentUri,
                    this.diagnosticCollection,
                    result
                );
            } else if (result != undefined) {
                removeDiagnosticsForDocument(
                    documentUri,
                    this.diagnosticCollection,
                    result
                );
            }
        }
    }

    private provideRelatedRequestsDiagnosticsForMetaBlock(
        itemProvider: CollectionItemProvider,
        metaBlock: RequestFileBlock,
        documentUri: Uri,
        relatedRequestsHelper: RelatedRequestsDiagnosticsHelper
    ): { uri: Uri; result: Diagnostic | DiagnosticCode }[] {
        const { code, toAdd } = checkSequenceInMetaBlockIsUniqueWithinFolder(
            itemProvider,
            metaBlock,
            documentUri
        );

        if (toAdd) {
            relatedRequestsHelper.registerDiagnostic({
                files: toAdd.affectedFiles,
                diagnosticCode: code,
            });

            return [{ uri: documentUri, result: toAdd.diagnosticCurrentFile }];
        } else {
            return relatedRequestsHelper
                .unregisterDiagnostic(documentUri.fsPath, code)
                .map(({ file, code }) => ({
                    uri: Uri.file(file),
                    result: code,
                }));
        }
    }
}
