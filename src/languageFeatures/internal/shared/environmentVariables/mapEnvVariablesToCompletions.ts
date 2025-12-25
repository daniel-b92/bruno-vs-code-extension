import { basename } from "path";
import {
    CancellationToken,
    CompletionItem,
    CompletionItemKind,
    Position as VsCodePosition,
} from "vscode";
import {
    Block,
    groupReferencesByName,
    getExtensionForBrunoFiles,
    OutputChannelLogger,
    VariableReferenceType,
} from "../../../../shared";
import { getDynamicVariableReferences } from "./getDynamicVariableReferences";

export function mapEnvVariablesToCompletions(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    requestData: {
        functionType: VariableReferenceType;
        position: VsCodePosition;
        token: CancellationToken;
    },
    dynamicVariablesData?: {
        blockContainingPosition: Block;
        allBlocks: Block[];
    },
    logger?: OutputChannelLogger,
) {
    const { functionType } = requestData;

    return (
        dynamicVariablesData
            ? mapDynamicEnvVariables(
                  requestData,
                  dynamicVariablesData,
                  "a",
                  logger,
              )
            : []
    )
        .filter(
            ({ label }) =>
                !matchingStaticEnvVariables
                    .flatMap(({ matchingVariableKeys }) => matchingVariableKeys)
                    .some((key) =>
                        typeof label == "string"
                            ? key == label
                            : key == label.label,
                    ),
        )
        .concat(
            mapStaticEnvVariables(
                matchingStaticEnvVariables,
                functionType,
                "b",
            ),
        );
}

function mapDynamicEnvVariables(
    requestData: {
        functionType: VariableReferenceType;
        position: VsCodePosition;
        token: CancellationToken;
    },
    dynamicVariablesData: {
        blockContainingPosition: Block;
        allBlocks: Block[];
    },
    prefixForSortText: string,
    logger?: OutputChannelLogger,
) {
    const { allBlocks, blockContainingPosition } = dynamicVariablesData;
    const { functionType, position: requestPosition, token } = requestData;

    const variableReferences = getDynamicVariableReferences(
        {
            functionType,
            requestPosition,
            token,
        },
        blockContainingPosition,
        allBlocks,
        logger,
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return groupReferencesByName(variableReferences).map(
        ({
            blockName,
            variableName,
            referenceType,
            references: {
                distinctBlocks,
                hasDuplicateReferences,
                totalNumberOfReferences,
            },
        }) => {
            const completionItem = new CompletionItem({
                label: variableName,
                detail:
                    hasDuplicateReferences && distinctBlocks.length > 1
                        ? `  Blocks '${distinctBlocks.join("','")}'`
                        : `  Block '${blockName}'`,
            });

            completionItem.kind =
                referenceType == VariableReferenceType.Read
                    ? CompletionItemKind.Field
                    : CompletionItemKind.Function;
            completionItem.detail = hasDuplicateReferences
                ? `Found a total of ${totalNumberOfReferences} relevant references in ${distinctBlocks.length > 1 ? `blocks ${JSON.stringify(distinctBlocks)}` : `block '${blockName}'`}.`
                : undefined;
            completionItem.sortText = `${prefixForSortText}_${blockName}_${variableName}`;

            return completionItem;
        },
    );
}

function mapStaticEnvVariables(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    functionType: VariableReferenceType,
    prefixForSortText: string,
) {
    return matchingStaticEnvVariables.flatMap(
        ({ environmentFile, matchingVariableKeys, isConfiguredEnv }) =>
            matchingVariableKeys.map((key) => {
                const environmentName = basename(
                    environmentFile,
                    getExtensionForBrunoFiles(),
                );
                const completionItem = new CompletionItem({
                    label: key,
                    description: `${functionType === VariableReferenceType.Write ? "!Env!" : "Env"} '${environmentName}'`,
                });
                completionItem.detail =
                    functionType == VariableReferenceType.Write
                        ? `WARNING: Will overwrite static environment variable from env '${environmentName}'`
                        : undefined;
                completionItem.kind = CompletionItemKind.Constant;
                completionItem.sortText = `${prefixForSortText}_${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`;
                return completionItem;
            }),
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for completion provider.`);
}
