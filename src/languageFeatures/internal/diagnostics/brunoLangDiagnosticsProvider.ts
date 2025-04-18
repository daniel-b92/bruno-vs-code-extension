import { Diagnostic, DiagnosticCollection, Uri } from "vscode";
import { checkMetaBlockStartsInFirstLine } from "./checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import {
    CollectionItemProvider,
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
import { RelatedRequestsDiagnosticsHelper } from "./util/relatedRequestsDiagnosticsHelper";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { DiagnosticCode } from "./diagnosticCodeEnum";
import { checkBodyBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkBodyBlockTypeFromMethodBlockExists";
import { checkAuthBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkAuthBlockTypeFromMethodBlockExists";

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
        ]);

        const metaBlocks = blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlocks.length == 1) {
            this.handleResults(documentUri, [
                checkMetaBlockStartsInFirstLine(document, metaBlocks[0]),
            ]);

            for (const results of this.provideRelatedRequestsDiagnosticsForMetaBlock(
                this.itemProvider,
                metaBlocks[0],
                documentUri,
                this.relatedRequestsHelper
            )) {
                this.handleResults(results.uri, [results.result]);
            }
        }
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
