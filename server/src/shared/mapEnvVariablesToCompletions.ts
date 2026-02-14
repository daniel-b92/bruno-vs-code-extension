import { basename } from "path";
import {
    groupReferencesByName,
    getExtensionForBrunoFiles,
    VariableReferenceType,
    Logger,
    Range,
} from "@global_shared";
import { getDynamicVariableReferences } from "../bruFiles/shared/getDynamicVariableReferences";
import {
    EnvVariableBruFileSpecificData,
    EnvVariableCommonRequestData,
    EnvVariableRequest,
} from "./interfaces";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";

export function mapEnvVariablesToCompletions(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    { requestData, bruFileSpecificData, logger }: EnvVariableRequest,
) {
    const resultsForStaticVariables = mapStaticEnvVariables(
        requestData,
        matchingStaticEnvVariables,
        requestData.functionType,
        // Display static environment variables below dynamic ones.
        "b",
    );

    return resultsForStaticVariables.concat(
        !bruFileSpecificData
            ? []
            : mapDynamicEnvVariables(
                  requestData,
                  bruFileSpecificData,
                  "a",
                  logger,
              ).filter(
                  ({ label }) =>
                      !matchingStaticEnvVariables
                          .flatMap(
                              ({ matchingVariableKeys }) =>
                                  matchingVariableKeys,
                          )
                          .some((key) => key == label),
              ),
    );
}

function mapDynamicEnvVariables(
    requestData: EnvVariableCommonRequestData,
    bruFileSpecificData: EnvVariableBruFileSpecificData,
    prefixForSortText: string,
    logger?: Logger,
) {
    const { allBlocks, blockContainingPosition } = bruFileSpecificData;
    const {
        functionType,
        requestPosition,
        token,
        variable: { start, end },
    } = requestData;

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
            const completionItem: CompletionItem = {
                label: variableName,
                labelDetails: {
                    description:
                        hasDuplicateReferences && distinctBlocks.length > 1
                            ? `  Blocks '${distinctBlocks.join("','")}'`
                            : `  Block '${blockName}'`,
                },
                kind:
                    referenceType == VariableReferenceType.Read
                        ? CompletionItemKind.Field
                        : CompletionItemKind.Function,
                detail: hasDuplicateReferences
                    ? `Found a total of ${totalNumberOfReferences} relevant references in ${distinctBlocks.length > 1 ? `blocks ${JSON.stringify(distinctBlocks)}` : `block '${blockName}'`}.`
                    : undefined,
                sortText: `${prefixForSortText}_${blockName}_${variableName}`,
                textEdit: {
                    newText: variableName,
                    range: new Range(start, end),
                },
            };

            return completionItem;
        },
    );
}

function mapStaticEnvVariables(
    { variable: { start, end } }: EnvVariableCommonRequestData,
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
                const completionItem: CompletionItem = {
                    label: key,
                    labelDetails: {
                        description: `${functionType === VariableReferenceType.Write ? "!Env!" : "Env"} '${environmentName}'`,
                    },
                    detail:
                        functionType == VariableReferenceType.Write
                            ? `WARNING: Will overwrite static environment variable from env '${environmentName}'`
                            : undefined,
                    kind: CompletionItemKind.Constant,
                    sortText: `${prefixForSortText}_${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`,
                    textEdit: {
                        newText: key,
                        range: new Range(start, end),
                    },
                };
                return completionItem;
            }),
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(`Cancellation requested for completion provider.`);
}
