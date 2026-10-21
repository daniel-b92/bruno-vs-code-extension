import {
    Block,
    BrunoVariableType,
    hasVariableSupport,
    isScriptVarsSection,
    getPossibleMethodBlocks,
    isAuthBlock,
    isBrunoFileType,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
    VariableReferenceType,
    getActiveKeysUsedInOtherLines,
    getKeyRangeContainingPosition,
    LineBreakType,
    Range,
    BrunoFileType,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    MetaBlockKey,
} from "@global_shared";
import { CompletionItem } from "vscode-languageserver";
import {
    LanguageFeatureBaseRequest,
    TypedCollection,
    TypedCollectionItemProvider,
} from "../../shared";
import {
    BlockRequestWithAdditionalData,
    toVariableSectionRequest,
} from "../shared/interfaces";
import { getCompletionsForReadOnlyVariablesInNonCodeSection } from "../../shared/variables/getCompletionsForReadOnlyVariablesInNonCodeSection";
import { mapVariablesToCompletions } from "../../shared/variables/mapVariablesToCompletions";
import { getMetaBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getMetaBlockContentCompletions";
import { getMethodBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getMethodBlockContentCompletions";
import { getAuthBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getAuthBlockContentCompletions";
import { getSettingsBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getSettingsBlockContentCompletions";
import { getGrpcBodyBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getGrpcBodyBlockContentCompletions";
import { getWsBodyBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getWsBodyBlockContentCompletions";
import { getAuthModeBlockContentCompletions } from "./dictionaryBlocks/specificBlocks/getAuthModeBlockContentCompletions";
import { getAllVariableReferences } from "../../shared/variables/getAllVariableReferences";
import { getTextEditForKey } from "./dictionaryBlocks/generic/getTextEditForKey";

export async function getCompletionsForNonCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    itemProvider: TypedCollectionItemProvider,
    configuredEnvironment?: string,
): Promise<CompletionItem[] | undefined> {
    const {
        request: baseRequest,
        file: { blockContainingPosition, allBlocks, collection },
    } = fullRequest;

    const { kind: sectionKind } =
        toVariableSectionRequest(fullRequest).file.sectionContainingPosition;
    const blockHasVariableSupport = hasVariableSupport(sectionKind);
    // For Script variable blocks only write-only variables can be defined.
    const blockSupportsOnlyWriteOnlyVars =
        blockHasVariableSupport && isScriptVarsSection(sectionKind);

    return (
        (await getBlockSpecificCompletions(
            itemProvider,
            baseRequest,
            allBlocks,
            blockContainingPosition,
            collection,
        )) ?? []
    ).concat(
        !blockHasVariableSupport
            ? []
            : blockSupportsOnlyWriteOnlyVars
              ? getCompletionsForBlockWithWriteOnlyVariables(
                    fullRequest,
                    configuredEnvironment,
                )
              : getCompletionsForReadOnlyVariablesInNonCodeSection(
                    toVariableSectionRequest(fullRequest),
                    configuredEnvironment,
                ),
    );
}

function getCompletionsForBlockWithWriteOnlyVariables(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    configuredEnvironment?: string,
) {
    const {
        request: { documentHelper, position },
        file: { blockContainingPosition: block },
    } = fullRequest;
    const functionType = VariableReferenceType.Write;
    // For non-code blocks with write-only variable access options, only simple variables can be set.
    const variableType = BrunoVariableType.Runtime;

    const allRefs = getAllVariableReferences(
        toVariableSectionRequest(fullRequest),
        {
            referenceType: functionType,
            variableType,
        },
        {
            configuredEnvironment,
        },
    );

    if (!allRefs) {
        return [];
    }

    const activeKeysInOtherLines = getActiveKeysUsedInOtherLines(
        position.line,
        block,
    );
    const variableRange = getKeyRangeContainingPosition(position, block);

    const nonDuplicateRefsFromOtherFiles =
        // For Script variable blocks, the only relevant references can be in code blocks, which means dynamic references.
        allRefs.dynamicReferences.fromOtherFiles.filter(
            ({
                mostRelevantReference: {
                    reference: { variableName },
                },
            }) => !activeKeysInOtherLines.includes(variableName),
        );
    const nonDuplicateRefsFromSameFile =
        // For Script variable blocks, the only relevant references can be in code blocks, which means dynamic references.
        allRefs.dynamicReferences.withinSameFile.filter(
            ({ variableReference: { variableName } }) =>
                !activeKeysInOtherLines.includes(variableName),
        );

    return !variableRange
        ? []
        : mapVariablesToCompletions(
              {
                  staticEnvVariables: [],
                  staticScriptVariables: [],
                  dynamicVariables: {
                      fromSameFile: nonDuplicateRefsFromSameFile,
                      fromOtherFiles: nonDuplicateRefsFromOtherFiles,
                  },
              },
              {
                  variable: {
                      ...variableRange,
                      name: documentHelper.getText(variableRange),
                  },
                  functionType,
                  variableType,
                  documentLineBreak:
                      documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
              },
              (
                  variableName: string,
                  rangeToReplace: Range,
                  lineBreak: LineBreakType,
              ) =>
                  getTextEditForKey(
                      lineBreak,
                      rangeToReplace,
                      variableName,
                      true,
                  ),
          );
}

async function getBlockSpecificCompletions(
    itemProvider: TypedCollectionItemProvider,
    request: LanguageFeatureBaseRequest,
    allBlocks: Block[],
    blockContainingPosition: Block,
    collection?: TypedCollection,
) {
    const { name: blockName } = blockContainingPosition;
    const itemType = collection
        ? collection.getStoredDataForPath(request.filePath)?.item.getItemType()
        : undefined;

    if (!itemType) {
        return undefined;
    }

    if (blockName == RequestFileBlockName.Meta && isBrunoFileType(itemType)) {
        return await getMetaBlockContentCompletions(
            itemProvider,
            request,
            blockContainingPosition,
            itemType,
            collection,
        );
    }
    if ((getPossibleMethodBlocks() as string[]).includes(blockName)) {
        return getMethodBlockContentCompletions(
            request,
            allBlocks,
            blockContainingPosition,
        );
    }
    if (isAuthBlock(blockName)) {
        return getAuthBlockContentCompletions(request, blockContainingPosition);
    }
    if (blockName == RequestFileBlockName.Settings) {
        return getSettingsBlockContentCompletions(
            request,
            blockContainingPosition,
            getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
                allBlocks,
                RequestFileBlockName.Meta,
                MetaBlockKey.Type,
            )?.value,
        );
    }
    if (blockName == RequestFileBlockName.WsBody) {
        return getWsBodyBlockContentCompletions(
            request,
            blockContainingPosition,
        );
    }
    if (blockName == RequestFileBlockName.GrpcBody) {
        return getGrpcBodyBlockContentCompletions(
            request,
            blockContainingPosition,
        );
    }
    if (blockName == SettingsFileSpecificBlock.AuthMode) {
        return getAuthModeBlockContentCompletions(
            request,
            allBlocks,
            blockContainingPosition,
            itemType == BrunoFileType.CollectionSettingsFile,
        );
    }
    return [];
}
