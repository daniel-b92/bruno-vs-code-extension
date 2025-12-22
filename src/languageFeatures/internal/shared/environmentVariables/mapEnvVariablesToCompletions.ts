import { basename } from "path";
import { CompletionItem, CompletionItemKind } from "vscode";
import {
    BrunoVariableReference,
    BrunoVariableType,
    getExtensionForBrunoFiles,
    VariableReferenceType,
} from "../../../../shared";

export function mapEnvVariablesToCompletions(
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    matchingDynamicEnvVariables: BrunoVariableReference[],
    functionType: VariableReferenceType,
) {
    return mapDynamicEnvVariables(matchingDynamicEnvVariables, "a").concat(
        mapStaticEnvVariables(matchingStaticEnvVariables, functionType, "b"),
    );
}

function mapDynamicEnvVariables(
    variableReferences: BrunoVariableReference[],
    prefixForSortText: string,
) {
    return variableReferences
        .filter(
            ({ variableType }) =>
                variableType == BrunoVariableType.Unknown ||
                variableType == BrunoVariableType.Environment,
        )
        .sort(
            ({ referenceType: refType1 }, { referenceType: refType2 }) =>
                refType1 - refType2,
        )
        .map(({ variableName, referenceType, variableNameRange }) => {
            const completionItem = new CompletionItem({
                label: variableName,
                description: `${referenceType === VariableReferenceType.ModifyOrDelete ? "ModifyOrDelete:" : "Read"} line: ${variableNameRange.start.line}`,
            });
            completionItem.kind = CompletionItemKind.Field;
            completionItem.sortText = `${prefixForSortText}_${variableName}`;
            return completionItem;
        });
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
                    description: `${functionType === VariableReferenceType.ModifyOrDelete ? "!Static variable in Env!" : "Env"} '${environmentName}'`,
                });
                completionItem.kind = CompletionItemKind.Constant;
                completionItem.sortText = `${prefixForSortText}_${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`;
                return completionItem;
            }),
    );
}
