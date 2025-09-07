import { Uri } from "vscode";
import {
    TextDocumentHelper,
    parseBruFile,
    EnvironmentFileBlockName,
    castBlockToDictionaryBlock,
    DictionaryBlock,
} from "../../../../../shared";
import { DiagnosticWithCode } from "../definitions";
import { checkArrayBlocksHaveArrayStructure } from "../shared/checks/multipleBlocks/checkArrayBlocksHaveArrayStructure";
import { checkDictionaryBlocksAreNotEmpty } from "../shared/checks/multipleBlocks/checkDictionaryBlocksAreNotEmpty";
import { checkDictionaryBlocksHaveDictionaryStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";

export function determineDiagnosticsForEnvironmentFile(
    documentUri: Uri,
    documentText: string,
): DiagnosticWithCode[] {
    const document = new TextDocumentHelper(documentText);

    const { blocks, textOutsideOfBlocks } = parseBruFile(document);
    const blocksThatShouldBeDictionaryBlocks = blocks.filter(
        ({ name }) => name == EnvironmentFileBlockName.Vars,
    );

    const validDictionaryBlocks = blocksThatShouldBeDictionaryBlocks.filter(
        castBlockToDictionaryBlock,
    ) as DictionaryBlock[];

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
        checkThatNoTextExistsOutsideOfBlocks(documentUri, textOutsideOfBlocks),
        checkNoBlocksHaveUnknownNames(
            documentUri,
            blocks,
            Object.values(EnvironmentFileBlockName),
        ),
        checkArrayBlocksHaveArrayStructure(
            documentUri,
            blocks.filter(
                ({ name }) => name == EnvironmentFileBlockName.SecretVars,
            ),
        ),
        validDictionaryBlocks.length < blocksThatShouldBeDictionaryBlocks.length
            ? checkDictionaryBlocksHaveDictionaryStructure(
                  documentUri,
                  blocksThatShouldBeDictionaryBlocks,
              )
            : undefined,
        checkDictionaryBlocksSimpleFieldsStructure(
            documentUri,
            validDictionaryBlocks.map((block) => ({
                block,
                keys: block.content.map(({ key }) => key),
            })),
        ),
        checkDictionaryBlocksAreNotEmpty(
            documentUri,
            blocksThatShouldBeDictionaryBlocks,
        ),
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}
