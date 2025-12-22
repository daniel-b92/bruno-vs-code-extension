import { basename } from "path";
import { CompletionItem, CompletionItemKind } from "vscode";
import {
    getExtensionForBrunoFiles,
    VariableReferenceType,
} from "../../../../shared";

export function mapEnvVariablesToCompletions(
    matchingEnvVariableDefinitions: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    functionType?: VariableReferenceType,
) {
    return matchingEnvVariableDefinitions.flatMap(
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
