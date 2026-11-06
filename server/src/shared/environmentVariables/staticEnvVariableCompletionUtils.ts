import { parse } from "path";
import { VariableReferenceType } from "@global_shared";

/** The prefix for the description of completion items for persistent environment variables. Write and delete functions are marked with a warning. */
export function getEnvironmentDescriptionPrefix(
    referenceType: VariableReferenceType,
) {
    switch (referenceType) {
        case VariableReferenceType.Write:
            return "⚠ Env";
        case VariableReferenceType.Delete:
            return "⚠ Delete Env";
        default:
            return "Env";
    }
}

/** Groups the items by the variable keys they provide. An item that provides a key multiple times is only added once to the group of that key. */
export function groupByVariableKey<T>(
    items: T[],
    getKeys: (item: T) => string[],
) {
    const itemsByKey = new Map<string, T[]>();

    for (const item of items) {
        for (const key of new Set(getKeys(item))) {
            itemsByKey.set(key, [...(itemsByKey.get(key) ?? []), item]);
        }
    }

    return itemsByKey;
}

export function getSingleEnvironmentLabel(
    environmentFile: string,
    inheritedByEnvironmentName?: string,
) {
    const environmentName = parse(environmentFile).name;

    return inheritedByEnvironmentName
        ? `'${environmentName}' (inherited by '${inheritedByEnvironmentName}')`
        : `'${environmentName}'`;
}

/** Returns `undefined` for functions that only read the variable. */
export function getEnvironmentWarning(
    referenceType: VariableReferenceType,
    environmentFiles: string[],
) {
    if (referenceType == VariableReferenceType.Read) {
        return undefined;
    }

    const environments =
        environmentFiles.length == 1
            ? `env '${parse(environmentFiles[0]).name}'`
            : `${environmentFiles.length} environments`;

    // Only the active environment is affected at runtime, so the environments are only named as the places where the variable is defined.
    return referenceType == VariableReferenceType.Delete
        ? `WARNING: Will delete the variable in the active environment (defined in ${environments})`
        : `WARNING: Will overwrite persistent environment variable from ${environments}`;
}
