import { basename } from "path";
import { CompletionItem, CompletionItemKind } from "vscode";
import { getExtensionForBrunoFiles } from "../../../../shared";

export function mapEnvironmentVariablesToCompletions(
    matchingEnvVariableDefinitions: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
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
                    description: `Environment: '${environmentName}'`,
                });
                completionItem.kind = CompletionItemKind.Constant;
                completionItem.sortText = `${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`;
                return completionItem;
            }),
    );
}
