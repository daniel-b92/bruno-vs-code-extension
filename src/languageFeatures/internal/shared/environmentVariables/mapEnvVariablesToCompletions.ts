import { basename } from "path";
import { CompletionItem, CompletionItemKind } from "vscode";
import {
    BrunoVariableReference,
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
                completionItem.sortText = `${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`;
                return completionItem;
            }),
    );
}
