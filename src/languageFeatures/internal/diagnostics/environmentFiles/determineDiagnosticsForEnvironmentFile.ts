import { Uri } from "vscode";
import {
    TextDocumentHelper,
    parseBruFile,
    EnvironmentFileBlockName,
} from "../../../../shared";
import { DiagnosticWithCode } from "../definitions";
import { checkArrayBlocksHaveArrayStructure } from "../shared/checks/multipleBlocks/checkArrayBlocksHaveArrayStructure";
import { checkDictionaryBlocksAreNotEmpty } from "../shared/checks/multipleBlocks/checkDictionaryBlocksAreNotEmpty";
import { checkDictionaryBlocksHaveDictionaryStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";

export function determineDiagnosticsForEnvironmentFile(
    documentUri: Uri,
    documentText: string
): DiagnosticWithCode[] {
    const document = new TextDocumentHelper(documentText);

    const { blocks, textOutsideOfBlocks } = parseBruFile(document);
    const blocksThatShouldBeDictionaryBlocks = blocks.filter(
        ({ name }) => name == EnvironmentFileBlockName.Vars
    );

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
        checkThatNoTextExistsOutsideOfBlocks(documentUri, textOutsideOfBlocks),
        checkNoBlocksHaveUnknownNames(
            documentUri,
            blocks,
            Object.values(EnvironmentFileBlockName)
        ),
        checkArrayBlocksHaveArrayStructure(
            documentUri,
            blocks.filter(
                ({ name }) => name == EnvironmentFileBlockName.SecretVars
            )
        ),
        checkDictionaryBlocksHaveDictionaryStructure(
            documentUri,
            blocksThatShouldBeDictionaryBlocks
        ),
        checkDictionaryBlocksAreNotEmpty(
            documentUri,
            blocksThatShouldBeDictionaryBlocks
        )
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}
