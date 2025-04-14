import { DiagnosticCollection, EventEmitter, Uri } from "vscode";
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
import { readFileSync } from "fs";

export class BrunoLangDiagnosticsProvider {
    constructor(
        private diagnosticCollection: DiagnosticCollection,
        private itemProvider: CollectionItemProvider
    ) {
        this.fetchDiagnosticsTrigger = new EventEmitter<string[]>();

        this.fetchDiagnosticsTrigger.event((files) => {
            for (const file of files) {
                this.provideDiagnostics(
                    Uri.file(file),
                    readFileSync(file).toString()
                );
            }
        });
    }

    private fetchDiagnosticsTrigger: EventEmitter<string[]>;

    public dispose() {
        this.fetchDiagnosticsTrigger.dispose();
    }

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
            this.provideMetaBlockSpecificDiagnostics(
                this.itemProvider,
                document,
                metaBlocks[0],
                documentUri,
                this.diagnosticCollection,
                this.fetchDiagnosticsTrigger
            );
        }
    }

    private provideMetaBlockSpecificDiagnostics(
        itemProvider: CollectionItemProvider,
        document: TextDocumentHelper,
        metaBlock: RequestFileBlock,
        documentUri: Uri,
        collection: DiagnosticCollection,
        fetchDiagnosticsTrigger: EventEmitter<string[]>
    ) {
        checkMetaBlockStartsInFirstLine(
            document,
            metaBlock,
            documentUri,
            collection
        );
        checkSequenceInMetaBlockIsUniqueWithinFolder(
            itemProvider,
            metaBlock,
            documentUri,
            collection,
            fetchDiagnosticsTrigger
        );
    }
}
