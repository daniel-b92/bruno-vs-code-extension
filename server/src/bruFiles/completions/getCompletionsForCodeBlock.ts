import {
    Block,
    VariableReferenceType,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionReferenceType,
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
    Logger,
    Position,
    CodeBlock,
    BrunoVariableType,
    getInbuiltFunctionVariableType,
} from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";
import { mapToVariableNameParams } from "../shared/mapToVariableNameParams";
import { CompletionItem } from "vscode-languageserver";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";
import { getDynamicVariableReferencesWithinFile } from "../shared/VariableReferences/getDynamicVariableReferencesWithinFile";
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { getDynamicVariableReferencesFromOtherFiles } from "../shared/VariableReferences/getDynamicVariableReferencesFromOtherFiles";

export function getCompletionsForCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    configuredEnvironment?: string,
): CompletionItem[] {
    const {
        request,
        file: { blockContainingPosition, allBlocks, collection },
        logger,
    } = fullRequest;

    const envVariableResult =
        getFirstParameterForInbuiltFunctionIfStringLiteral(
            mapToVariableNameParams(
                fullRequest,
                getInbuiltFunctionIdentifiers(),
            ),
        );

    if (envVariableResult) {
        const { inbuiltFunction, variable } = envVariableResult;

        return getResultsForVariable(
            variable,
            {
                collection,
                functionType: getInbuiltFunctionReferenceType(inbuiltFunction),
                variableType: getInbuiltFunctionVariableType(inbuiltFunction),
                blockContainingPosition,
                allBlocks,
                configuredEnvironment,
            },
            request,
            logger,
        );
    }

    return [];
}

function getResultsForVariable(
    variable: {
        name: string;
        start: Position;
        end: Position;
    },
    additionalData: {
        collection: TypedCollection;
        functionType: VariableReferenceType;
        variableType: BrunoVariableType;
        blockContainingPosition: Block;
        allBlocks: Block[];
        configuredEnvironment?: string;
    },
    baseRequest: LanguageFeatureBaseRequest,
    logger?: Logger,
) {
    const {
        collection,
        functionType,
        variableType,
        allBlocks,
        blockContainingPosition,
        configuredEnvironment,
    } = additionalData;
    const { position, token, filePath } = baseRequest;

    const matchingStaticEnvVariableDefinitions = [
        BrunoVariableType.Environment,
        BrunoVariableType.Unknown,
    ].includes(variableType)
        ? getMatchingDefinitionsFromEnvFiles(
              collection,
              variable.name,
              EnvVariableNameMatchingMode.Ignore,
              configuredEnvironment,
          )
        : [];

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    const dynamicVariableReferencesWithinFile =
        getDynamicVariableReferencesWithinFile(
            {
                request: baseRequest,
                file: { allBlocks, blockContainingPosition, collection },
                logger,
            },
            functionType,
            variableType,
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    const dynamicVariableReferencesFromOtherFiles =
        getDynamicVariableReferencesFromOtherFiles(
            filePath,
            collection,
            functionType,
            variableType,
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapVariablesToCompletions(
        matchingStaticEnvVariableDefinitions.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
        {
            fromSameFile: dynamicVariableReferencesWithinFile,
            fromOtherFiles: dynamicVariableReferencesFromOtherFiles,
        },
        {
            collection,
            functionType,
            variableType,
            requestPosition: position,
            variable,
            token,
        },
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'bru' language.`,
    );
}
