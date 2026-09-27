import { basename } from "path";
import {
    getExtensionForBrunoFiles,
    VariableReferenceType,
    Range,
} from "@global_shared";
import { VariableSpecificRequestData } from "../interfaces";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { GetTextEditForVariableCompletion } from "../../bruFiles/completions/mapVariablesToCompletions";

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
    return matchingStaticEnvVariables.flatMap(
        ({
            environmentFile,
            matchingVariableKeys,
            isConfiguredEnv,
            inheritedByEnvironmentName,
        }) =>
            matchingVariableKeys.map((key) => {
                const environmentName = basename(
                    environmentFile,
                    getExtensionForBrunoFiles(),
                );
                const environmentLabel = inheritedByEnvironmentName
                    ? `'${environmentName}' (inherited by '${inheritedByEnvironmentName}')`
                    : `'${environmentName}'`;
                const completionItem: CompletionItem = {
                    label: key,
                    labelDetails: {
                        description: `${shouldShowWarning(functionType) ? "!Env!" : "Env"} ${environmentLabel}`,
                    },
                    detail: shouldShowWarning(functionType)
                        ? `WARNING: Will overwrite static environment variable from env '${environmentName}'`
                        : undefined,
                    kind: CompletionItemKind.Constant,
                    sortText: `${modifications?.prefixForSortText ?? ""}_${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`,
                    textEdit: modifications?.getTextEditForCompletion?.(
                        key,
                        new Range(start, end),
                        documentLineBreak,
                    ),
                };
                return completionItem;
            }),
    );
}

function shouldShowWarning(referenceType: VariableReferenceType) {
    return [VariableReferenceType.Write, VariableReferenceType.Delete].includes(
        referenceType,
    );
}
