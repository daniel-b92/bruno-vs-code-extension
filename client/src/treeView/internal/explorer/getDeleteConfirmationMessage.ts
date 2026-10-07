import { basename, extname } from "path";
import { BrunoFileType, ItemType, ReadyOnlyCollection } from "@global_shared";

export function getDeleteConfirmationMessage(
    itemLabel: string,
    itemPath: string,
    itemType: ItemType,
    collection: ReadyOnlyCollection<unknown>,
) {
    if (itemType != BrunoFileType.EnvironmentFile) {
        return `Delete '${itemLabel}'?`;
    }

    const environmentName = basename(itemPath, extname(itemPath));
    const dependentEnvironments =
        collection.getEnvironmentsExtending(environmentName);

    return dependentEnvironments.length > 0
        ? `Delete '${itemLabel}'? The environment(s) '${dependentEnvironments.join(
              "', '",
          )}' extend it and will lose access to its variables.`
        : `Delete '${itemLabel}'?`;
}
