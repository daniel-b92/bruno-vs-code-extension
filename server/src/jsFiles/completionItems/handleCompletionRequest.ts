import {
    VariableReferenceType,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    Position,
    getInbuiltFunctionReferenceType,
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
    Logger,
    BrunoVariableType,
} from "@global_shared";
import {
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
    mapStaticEnvVariablesToCompletions,
    TypedCollection,
} from "../../shared";
import { CompletionItem } from "vscode-languageserver";

export async function handleCompletionRequest({
    baseRequest,
    collection,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo): Promise<
    CompletionItem[] | undefined
> {
    const { token } = baseRequest;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const envVariableRelatedFunction = getEnvVariableRelatedFunctionForRequest({
        file: {
            collection,
        },
        baseRequest,
        logger,
    });

    return envVariableRelatedFunction != undefined
        ? getResultsForEnvironmentVariable(
              envVariableRelatedFunction.variable,
              {
                  collection,
                  functionType: envVariableRelatedFunction.type,
              },
              baseRequest,
              configuredEnvironmentName,
              logger,
          )
        : undefined;
}

function getEnvVariableRelatedFunctionForRequest(params: {
    file: { collection: TypedCollection };
    baseRequest: LanguageFeatureBaseRequest;
    logger?: Logger;
}) {
    const {
        baseRequest: { documentHelper, token, position },
        logger,
    } = params;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const found = getFirstParameterForInbuiltFunctionIfStringLiteral({
        relevantContent: {
            asString: documentHelper.getText(),
            startPosition: new Position(0, 0),
        },
        functionsToSearchFor: getInbuiltFunctionIdentifiers(),
        position,
    });

    return found
        ? {
              ...found,
              type: getInbuiltFunctionReferenceType(found.inbuiltFunction),
          }
        : undefined;
}

function getResultsForEnvironmentVariable(
    variable: { name: string; start: Position; end: Position },
    additionalData: {
        collection: TypedCollection;
        functionType: VariableReferenceType;
    },
    baseRequest: LanguageFeatureBaseRequest,
    configuredEnvironmentName?: string,
    logger?: Logger,
) {
    const { collection, functionType } = additionalData;
    const { token } = baseRequest;

    const matchingEnvVariableDefinitions = getMatchingDefinitionsFromEnvFiles(
        collection,
        variable.name,
        EnvVariableNameMatchingMode.Ignore,
        configuredEnvironmentName,
    );

    if (matchingEnvVariableDefinitions.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapStaticEnvVariablesToCompletions(
        {
            variable,
            functionType,
            variableType: BrunoVariableType.Environment,
        },
        matchingEnvVariableDefinitions.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested for completion provider for JS files.",
    );
}
