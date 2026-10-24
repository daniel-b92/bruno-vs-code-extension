import { parse } from "path";
import { VariableReferenceType } from "@global_shared";

export function shouldShowWarning(referenceType: VariableReferenceType) {
    return [VariableReferenceType.Write, VariableReferenceType.Delete].includes(
        referenceType,
    );
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

export function getOverwriteWarning(environmentFiles: string[]) {
    return `WARNING: Will overwrite persistent environment variable from ${
        environmentFiles.length == 1
            ? `env '${parse(environmentFiles[0]).name}'`
            : `${environmentFiles.length} environments`
    }`;
}
