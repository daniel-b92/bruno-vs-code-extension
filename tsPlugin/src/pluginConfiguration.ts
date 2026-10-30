import { CollectionFormat } from "./constants";
import { isPathWithinFolder } from "./pathComparison";

export interface PluginConfig {
    yamlCollectionSupport: boolean;
    /** Absolute paths of the folders that are available to the scripts of at least one collection, besides the collection folder itself. */
    additionalContextRoots: string[];
    /** The formats of the collections that exist in the workspace. */
    collectionFormats: CollectionFormat[];
}

/**
 * The configuration is passed to the plugin by the VS Code extension (see `configureTsServerPlugin` in the client).
 * As long as no configuration is passed, Yaml collections are not supported and there are no additional context roots and no collections.
 */
export class PluginConfiguration {
    private config: PluginConfig = {
        yamlCollectionSupport: false,
        additionalContextRoots: [],
        collectionFormats: [],
    };
    private readonly changeListeners: (() => void)[] = [];

    isYamlCollectionSupportEnabled() {
        return this.config.yamlCollectionSupport;
    }

    hasCollectionsWithFormat(format: CollectionFormat) {
        return this.config.collectionFormats.includes(format);
    }

    /**
     * Javascript files within additional context roots are not part of a collection, but can use the objects that Bruno provides at runtime.
     */
    getAdditionalContextRootContaining(
        fileName: string,
        caseSensitive: boolean,
    ) {
        const normalizedFileName = normalizePath(fileName);

        return this.config.additionalContextRoots.find(
            (root) =>
                normalizedFileName != root &&
                isPathWithinFolder(normalizedFileName, root, caseSensitive),
        );
    }

    onDidChange(listener: () => void) {
        this.changeListeners.push(listener);
    }

    update(config: Partial<PluginConfig> | undefined) {
        const yamlCollectionSupport = config?.yamlCollectionSupport == true;
        const additionalContextRoots = Array.isArray(
            config?.additionalContextRoots,
        )
            ? config.additionalContextRoots
                  .filter((root) => typeof root == "string" && root != "")
                  .map(normalizePath)
            : [];
        const collectionFormats = Object.values(CollectionFormat).filter(
            (format) =>
                Array.isArray(config?.collectionFormats) &&
                config.collectionFormats.includes(format),
        );

        if (
            yamlCollectionSupport == this.config.yamlCollectionSupport &&
            haveSameElements(
                additionalContextRoots,
                this.config.additionalContextRoots,
            ) &&
            haveSameElements(collectionFormats, this.config.collectionFormats)
        ) {
            return;
        }

        this.config = {
            yamlCollectionSupport,
            additionalContextRoots,
            collectionFormats,
        };

        for (const listener of this.changeListeners) {
            listener();
        }
    }
}

/**
 * The Typescript server uses forward slashes in file names.
 * The returned path never ends with a slash (except for a root folder, which is not a valid context root anyway).
 */
function normalizePath(path: string) {
    const withForwardSlashes = path.replace(/\\/g, "/");

    return withForwardSlashes.length > 1
        ? withForwardSlashes.replace(/\/+$/, "")
        : withForwardSlashes;
}

function haveSameElements(first: string[], second: string[]) {
    return (
        first.length == second.length &&
        first.every((element, index) => element == second[index])
    );
}
