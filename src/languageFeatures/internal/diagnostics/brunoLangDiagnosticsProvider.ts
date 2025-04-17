import { DiagnosticCollection, Uri } from "vscode";
import { checkMetaBlockStartsInFirstLine } from "./providers/checksForSingleBlocks/checkMetaBlockStartsInFirstLine";
import {
    CollectionItemProvider,
    parseTestFile,
    RequestFileBlock,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { checkOccurencesOfMandatoryBlocks } from "./providers/checksForMultipleBlocks/checkOccurencesOfMandatoryBlocks";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "./providers/checksForMultipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "./providers/checksForMultipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneAuthBlockExists } from "./providers/checksForMultipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAtMostOneBodyBlockExists } from "./providers/checksForMultipleBlocks/checkAtMostOneBodyBlockExists";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./providers/checksForRelatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";
import { RelatedRequestsDiagnosticsHelper } from "./util/relatedRequestsDiagnosticsHelper";

export class BrunoLangDiagnosticsProvider {
    constructor(
        private diagnosticCollection: DiagnosticCollection,
        private itemProvider: CollectionItemProvider
    ) {
        this.relatedRequestsHelper = new RelatedRequestsDiagnosticsHelper(
            diagnosticCollection
        );
    }

    private relatedRequestsHelper: RelatedRequestsDiagnosticsHelper;

    public dispose() {}

    public provideDiagnostics(documentUri: Uri, documentText: string) {
        const document = new TextDocumentHelper(documentText);
        const { blocks, textOutsideOfBlocks } = parseTestFile(document);

        checkOccurencesOfMandatoryBlocks(
            documentUri,
            document,
            blocks,
            this.diagnosticCollection
        );

        checkThatNoBlocksAreDefinedMultipleTimes(
            documentUri,
            blocks,
            this.diagnosticCollection
        );
        checkThatNoTextExistsOutsideOfBlocks(
            documentUri,
            textOutsideOfBlocks,
            this.diagnosticCollection
        );
        checkAtMostOneAuthBlockExists(
            documentUri,
            blocks,
            this.diagnosticCollection
        );
        checkAtMostOneBodyBlockExists(
            documentUri,
            blocks,
            this.diagnosticCollection
        );

        const metaBlocks = blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlocks.length == 1) {
            this.provideSingleBlockSpecificDiagnostics(
                document,
                metaBlocks[0],
                documentUri,
                this.diagnosticCollection
            );

            this.provideRelatedRequestsDiagnostics(
                this.itemProvider,
                metaBlocks[0],
                documentUri,
                this.relatedRequestsHelper
            );
        }
    }

    private provideSingleBlockSpecificDiagnostics(
        document: TextDocumentHelper,
        metaBlock: RequestFileBlock,
        documentUri: Uri,
        collection: DiagnosticCollection
    ) {
        checkMetaBlockStartsInFirstLine(
            document,
            metaBlock,
            documentUri,
            collection
        );
    }

    private provideRelatedRequestsDiagnostics(
        itemProvider: CollectionItemProvider,
        metaBlock: RequestFileBlock,
        documentUri: Uri,
        relatedRequestsHelper: RelatedRequestsDiagnosticsHelper
    ) {
        const { code, toAdd } = checkSequenceInMetaBlockIsUniqueWithinFolder(
            itemProvider,
            metaBlock,
            documentUri
        );

        if (toAdd) {
            relatedRequestsHelper.addDiagnostic(
                {
                    files: toAdd.affectedFiles,
                    diagnosticCode: code,
                },
                documentUri.fsPath,
                toAdd.diagnosticCurrentFile
            );
        } else {
            relatedRequestsHelper.removeDiagnostic(documentUri.fsPath, code);
        }
    }
}
