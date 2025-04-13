import { DiagnosticCollection, Uri } from "vscode";
import { checkMetaBlockStartsInFirstLine } from "./providers/checksForSingleBlocks/checkMetaBlockStartsInFirstLine";
import { parseTestFile, TextDocumentHelper } from "../../../shared";
import { checkOccurencesOfMandatoryBlocks } from "./providers/checksForMultipleBlocks/checkOccurencesOfMandatoryBlocks";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "./providers/checksForMultipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "./providers/checksForMultipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneAuthBlockExists } from "./providers/checksForMultipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAtMostOneBodyBlockExists } from "./providers/checksForMultipleBlocks/checkAtMostOneBodyBlockExists";

export function provideBrunoLangDiagnostics(
    diagnosticCollection: DiagnosticCollection,
    documentText: string,
    uri: Uri
) {
    const document = new TextDocumentHelper(documentText);
    const { blocks, textOutsideOfBlocks } = parseTestFile(document);

    checkOccurencesOfMandatoryBlocks(
        uri,
        document,
        blocks,
        diagnosticCollection
    );

    checkThatNoBlocksAreDefinedMultipleTimes(uri, blocks, diagnosticCollection);
    checkThatNoTextExistsOutsideOfBlocks(
        uri,
        textOutsideOfBlocks,
        diagnosticCollection
    );
    checkAtMostOneAuthBlockExists(uri, blocks, diagnosticCollection);
    checkAtMostOneBodyBlockExists(uri, blocks, diagnosticCollection);

    checkMetaBlockStartsInFirstLine(
        document,
        blocks,
        uri,
        diagnosticCollection
    );
}
