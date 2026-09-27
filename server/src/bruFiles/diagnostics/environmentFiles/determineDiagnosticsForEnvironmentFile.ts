import {
    TextDocumentHelper,
    parseBruFile,
    EnvironmentFileBlockName,
    EnvironmentFileTopLevelField,
    isBlockDictionaryBlock,
    BrunoFileType,
    isDictionaryBlockField,
    getAllExtendsFields,
} from "@global_shared";
import { TypedCollectionItemProvider } from "../../../shared";
import { DiagnosticWithCode } from "../interfaces";
import { checkArrayBlocksHaveArrayStructure } from "../shared/checks/multipleBlocks/checkArrayBlocksHaveArrayStructure";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";
import { runDictionaryBlocksBaseChecks } from "../shared/checks/runDictionaryBlocksBaseChecks";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";
import { checkExtendsFieldIsValid } from "./checkExtendsFieldIsValid";
import { checkExtendsFieldIsNotDefinedMultipleTimes } from "./checkExtendsFieldIsNotDefinedMultipleTimes";
import { checkExtendsFieldDoesNotCreateInheritanceLoop } from "./checkExtendsFieldDoesNotCreateInheritanceLoop";

export function determineDiagnosticsForEnvironmentFile(
    filePath: string,
    documentText: string,
    itemProvider?: TypedCollectionItemProvider,
): DiagnosticWithCode[] {
    const docHelper = new TextDocumentHelper(documentText);

    const { blocks, textOutsideOfBlocks } = parseBruFile(
        docHelper,
        BrunoFileType.EnvironmentFile,
    );
    const extendsFields = getAllExtendsFields(docHelper, textOutsideOfBlocks);
    const extendsField =
        extendsFields.length == 1 ? extendsFields[0] : undefined;
    const collection = itemProvider?.getAncestorCollectionForPath(filePath);
    const knownEnvironmentNames = collection
        ?.getEnvironments()
        .map(({ environmentName }) => environmentName);
    const blocksThatShouldBeDictionaryBlocks = blocks.filter(
        ({ name }) => name == EnvironmentFileBlockName.Vars,
    );

    const validDictionaryBlocks = blocksThatShouldBeDictionaryBlocks.filter(
        isBlockDictionaryBlock,
    );

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        checkThatNoBlocksAreDefinedMultipleTimes(filePath, blocks),
        checkThatNoTextExistsOutsideOfBlocks(filePath, textOutsideOfBlocks, [
            EnvironmentFileTopLevelField.Extends,
        ]),
        extendsField
            ? checkExtendsFieldIsValid(
                  filePath,
                  extendsField,
                  knownEnvironmentNames,
              )
            : undefined,
        extendsField && collection
            ? checkExtendsFieldDoesNotCreateInheritanceLoop(
                  filePath,
                  extendsField,
                  collection,
              )
            : undefined,
        ...(checkExtendsFieldIsNotDefinedMultipleTimes(
            filePath,
            extendsFields,
        ) ?? []),
        checkNoBlocksHaveUnknownNames(
            filePath,
            blocks,
            Object.values(EnvironmentFileBlockName),
        ),
        checkArrayBlocksHaveArrayStructure(
            filePath,
            blocks.filter(
                ({ name }) => name == EnvironmentFileBlockName.SecretVars,
            ),
        ),
        ...runDictionaryBlocksBaseChecks(
            blocksThatShouldBeDictionaryBlocks,
            validDictionaryBlocks,
            docHelper,
            filePath,
        ),
        checkDictionaryBlocksSimpleFieldsStructure(
            filePath,
            validDictionaryBlocks.map((block) => ({
                block,
                keys: block.content
                    .filter(isDictionaryBlockField)
                    .map(({ key }) => key),
            })),
        ),
        ...validDictionaryBlocks.flatMap(
            (block) =>
                checkNoDuplicateKeysAreDefinedForDictionaryBlock({
                    filePath,
                    block,
                    diagnosticCode:
                        RelevantWithinEnvironmentFileDiagnosticCode.EnvironmentVariableDefinedMultipleTimes,
                }) ?? [],
        ),
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}
