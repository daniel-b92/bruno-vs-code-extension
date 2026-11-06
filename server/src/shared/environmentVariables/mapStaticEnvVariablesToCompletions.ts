import { Range } from "@global_shared";
import { VariableSpecificRequestData } from "../interfaces";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import {
    getEnvironmentDescriptionPrefix,
    getEnvironmentWarning,
    getSingleEnvironmentLabel,
    groupByVariableKey,
} from "./staticEnvVariableCompletionUtils";
import { GetTextEditForVariableCompletion } from "../variables/mapVariablesToCompletions";

export function mapStaticEnvVariablesToCompletions(
    {
        variable: { start, end },
        functionType,
        documentLineBreak,
    }: VariableSpecificRequestData,
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
        inheritedByEnvironmentName?: string;
    }[],
    modifications?: {
        prefixForSortText?: string;
        getTextEditForCompletion?: GetTextEditForVariableCompletion;
    },
) {
    const definitionsByKey = groupByVariableKey(
        matchingStaticEnvVariables,
        ({ matchingVariableKeys }) => matchingVariableKeys,
    );

    return [...definitionsByKey.entries()].map(([key, definitions]) => {
        const isConfiguredEnv = definitions.some(
            ({ isConfiguredEnv }) => isConfiguredEnv,
        );
        const completionItem: CompletionItem = {
            label: key,
            labelDetails: {
                description: `${getEnvironmentDescriptionPrefix(functionType)} ${getEnvironmentLabel(definitions)}`,
            },
            detail: getEnvironmentWarning(
                functionType,
                definitions.map(({ environmentFile }) => environmentFile),
            ),
            kind: CompletionItemKind.Constant,
            sortText: `${modifications?.prefixForSortText ?? ""}_${isConfiguredEnv ? "a" : "b"}_${key}`,
            textEdit: modifications?.getTextEditForCompletion?.(
                key,
                new Range(start, end),
                documentLineBreak,
            ),
        };
        return completionItem;
    });
}

function getEnvironmentLabel(
    definitions: {
        environmentFile: string;
        inheritedByEnvironmentName?: string;
    }[],
) {
    if (definitions.length > 1) {
        return `(${definitions.length} environments)`;
    }

    const [{ environmentFile, inheritedByEnvironmentName }] = definitions;

    return getSingleEnvironmentLabel(
        environmentFile,
        inheritedByEnvironmentName,
    );
}
