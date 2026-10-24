import { parse } from "path";
import { VariableReferenceType, Range } from "@global_shared";
import { VariableSpecificRequestData } from "../interfaces";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
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
    const definitionsByKey = new Map<
        string,
        {
            environmentFile: string;
            isConfiguredEnv: boolean;
            inheritedByEnvironmentName?: string;
        }[]
    >();

    for (const {
        matchingVariableKeys,
        ...definition
    } of matchingStaticEnvVariables) {
        for (const key of matchingVariableKeys) {
            definitionsByKey.set(key, [
                ...(definitionsByKey.get(key) ?? []),
                definition,
            ]);
        }
    }

    const showWarning = shouldShowWarning(functionType);

    return [...definitionsByKey.entries()].map(([key, definitions]) => {
        const isConfiguredEnv = definitions.some(
            ({ isConfiguredEnv }) => isConfiguredEnv,
        );
        const completionItem: CompletionItem = {
            label: key,
            labelDetails: {
                description: `${showWarning ? "!Env!" : "Env"} ${getEnvironmentLabel(definitions)}`,
            },
            detail: showWarning
                ? definitions.length == 1
                    ? `WARNING: Will overwrite static environment variable from env '${parse(definitions[0].environmentFile).name}'`
                    : `WARNING: Will overwrite static environment variable from ${definitions.length} environments`
                : undefined,
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
    const environmentName = parse(environmentFile).name;

    return inheritedByEnvironmentName
        ? `'${environmentName}' (inherited by '${inheritedByEnvironmentName}')`
        : `'${environmentName}'`;
}

export function shouldShowWarning(referenceType: VariableReferenceType) {
    return [VariableReferenceType.Write, VariableReferenceType.Delete].includes(
        referenceType,
    );
}
