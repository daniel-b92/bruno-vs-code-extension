import { basename } from "path";
import { CompletionItem, CompletionItemKind } from "vscode";
import { getExtensionForBrunoFiles } from "../../../../shared";
import { EnvVariableFunctionType } from "../interfaces";

export function mapEnvironmentVariablesToCompletions(
    matchingEnvVariableDefinitions: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    functionType?: EnvVariableFunctionType,
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
                    description: `${functionType == EnvVariableFunctionType.ModifyOrDelete ? "!Static variable in Env!" : "Env"} '${environmentName}'`,
                });
                completionItem.kind = CompletionItemKind.Constant;
                completionItem.sortText = `${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`;
                return completionItem;
            }),
    );
}
