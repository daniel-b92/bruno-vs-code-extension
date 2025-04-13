import { DiagnosticCollection, Uri } from "vscode";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { getDiagnosticForMetaBlockNotInFirstLine } from "./providers/getDiagnosticForMetaBlockNotInFirstLine";
import {
    parseTestFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { checkOccurencesOfMandatoryBlocks } from "./providers/checkOccurencesOfMandatoryBlocks";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "./providers/checkThatNoBlocksAreDefinedMultipleTimes";
import { DiagnosticCode } from "./diagnosticCodeEnum";
import { checkThatNoTextExistsOutsideOfBlocks } from "./providers/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneAuthBlockExists } from "./providers/checkAtMostOneAuthBlockExists";
import { checkAtMostOneBodyBlockExists } from "./providers/checkAtMostOneBodyBlockExists";

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

    if (
        blocks.find(({ name }) => name == RequestFileBlockName.Meta)?.nameRange
            .start.line != 0
    ) {
        addDiagnosticForDocument(
            uri,
            diagnosticCollection,
            getDiagnosticForMetaBlockNotInFirstLine(document)
        );
    } else {
        removeDiagnosticsForDocument(
            uri,
            diagnosticCollection,
            DiagnosticCode.MetaBlockNotInFirstLine
        );
    }
}
