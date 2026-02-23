import { basename } from "path";
import {
    getExtensionForBrunoFiles,
    VariableReferenceType,
    Range,
} from "@global_shared";
import { EnvVariableCommonRequestData } from "../interfaces";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";

export function mapStaticEnvVariablesToCompletions(
    { variable: { start, end }, functionType }: EnvVariableCommonRequestData,
    matchingStaticEnvVariables: {
        environmentFile: string;
        matchingVariableKeys: string[];
        isConfiguredEnv: boolean;
    }[],
    modifications?: {
        prefixForSortText?: string;
        appendOnInsertion?: string;
    },
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
                    sortText: `${modifications?.prefixForSortText ?? ""}_${isConfiguredEnv ? "a" : "b"}_${environmentName}_${key}`,
                    textEdit: {
                        newText: `${key}${modifications?.appendOnInsertion ?? ""}`,
                        range: new Range(start, end),
                    },
                };
                return completionItem;
            }),
    );
}
