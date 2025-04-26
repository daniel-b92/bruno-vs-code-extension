import { DiagnosticCollection, Uri } from "vscode";
import {
    CollectionItemProvider,
    getAllMethodBlocks,
    isAuthBlock,
    parseTestFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { checkOccurencesOfMandatoryBlocks } from "./checks/multipleBlocks/checkOccurencesOfMandatoryBlocks";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "./checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "./checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneAuthBlockExists } from "./checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAtMostOneBodyBlockExists } from "./checks/multipleBlocks/checkAtMostOneBodyBlockExists";
import { RelatedRequestsDiagnosticsHelper } from "./helpers/relatedRequestsDiagnosticsHelper";
import { checkBodyBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkBodyBlockTypeFromMethodBlockExists";
import { checkAuthBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkAuthBlockTypeFromMethodBlockExists";
import { checkNoBlocksHaveUnknownNames } from "./checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkDictionaryBlocksHaveDictionaryStructure } from "./checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { DiagnosticWithCode } from "./definitions";
import { checkEitherAssertOrTestsBlockExists } from "./checks/multipleBlocks/checkEitherAssertOrTestsBlockExists";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "./checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { getMetaBlockSpecificDiagnostics } from "./getMetaBlockSpecificDiagnostics";
import { getMethodBlockSpecificDiagnostics } from "./getMethodBlockSpecificDiagnostics";
import { getAuthBlockSpecificDiagnostics } from "./getAuthBlockSpecificDiagnostics";

export class BrunoLangDiagnosticsProvider {
    constructor(
        private diagnosticCollection: DiagnosticCollection,
        private itemProvider: CollectionItemProvider
    ) {
        this.relatedRequestsHelper = new RelatedRequestsDiagnosticsHelper();
    }

    private relatedRequestsHelper: RelatedRequestsDiagnosticsHelper;

    public dispose() {
        this.diagnosticCollection.clear();
        this.relatedRequestsHelper.dispose();
    }

    public provideDiagnostics(documentUri: Uri, documentText: string) {
        const newDiagnostics = this.determineDiagnostics(
            documentUri,
            documentText
        );
        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }

    private determineDiagnostics(
        documentUri: Uri,
        documentText: string
    ): DiagnosticWithCode[] {
        const document = new TextDocumentHelper(documentText);
        const { blocks, textOutsideOfBlocks } = parseTestFile(document);

        const results: DiagnosticWithCode[] = [];

        const addToResults = (
            ...maybeDiagnostics: (DiagnosticWithCode | undefined)[]
        ) => {
            results.push(...maybeDiagnostics.filter((val) => val != undefined));
        };

        addToResults(
            ...checkOccurencesOfMandatoryBlocks(document, blocks),
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
            checkEitherAssertOrTestsBlockExists(document, blocks),
            checkBlocksAreSeparatedBySingleEmptyLine(
                documentUri,
                textOutsideOfBlocks
            )
        );

        const metaBlocks = blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlocks.length == 1) {
            addToResults(
                ...getMetaBlockSpecificDiagnostics(
                    this.itemProvider,
                    this.relatedRequestsHelper,
                    documentUri,
                    document,
                    metaBlocks[0]
                )
            );
        }

        const methodBlocks = getAllMethodBlocks(blocks);

        if (methodBlocks.length == 1) {
            addToResults(...getMethodBlockSpecificDiagnostics(methodBlocks[0]));
        }

        const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

        if (authBlocks.length == 1) {
            addToResults(...getAuthBlockSpecificDiagnostics(authBlocks[0]));
        }

        return results;
    }
}
