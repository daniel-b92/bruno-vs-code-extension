import {
    groupReferencesByName,
    VariableReferenceType,
    Range,
    BrunoVariableReference,
} from "@global_shared";
import {
    EnvVariableCommonRequestData,
    mapStaticEnvVariablesToCompletions,
} from "../../shared";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";

export function mapEnvVariablesToCompletions(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    matchingDynamicEnvVariables: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
    requestData: EnvVariableCommonRequestData,
    appendOnInsertion?: string,
) {
    const resultsForStaticVariables = mapStaticEnvVariablesToCompletions(
        requestData,
        matchingStaticEnvVariables,
        // Display static environment variables below dynamic ones.
        { prefixForSortText: "b", appendOnInsertion },
    );

    return resultsForStaticVariables.concat(
        mapDynamicEnvVariables(requestData, matchingDynamicEnvVariables, {
            prefixForSortText: "a",
            appendOnInsertion,
        }).filter(
            ({ label }) =>
                !matchingStaticEnvVariables
                    .flatMap(({ matchingVariableKeys }) => matchingVariableKeys)
                    .some((key) => key == label),
        ),
    );
}

function mapDynamicEnvVariables(
    requestData: EnvVariableCommonRequestData,
    matchingDynamicEnvVariables: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[],
    modifications: {
        prefixForSortText: string;
        appendOnInsertion?: string;
    },
) {
    const {
        variable: { start, end },
    } = requestData;

    return groupReferencesByName(matchingDynamicEnvVariables).map(
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
                sortText: `${modifications?.prefixForSortText ?? ""}_${blockName}_${variableName}`,
                textEdit: {
                    newText: `${variableName}${modifications.appendOnInsertion ?? ""}`,
                    range: new Range(start, end),
                },
            };

            return completionItem;
        },
    );
}
