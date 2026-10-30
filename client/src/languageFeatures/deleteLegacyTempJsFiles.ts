import { FileSystemError, Uri, workspace } from "vscode";
import { resolve } from "path";
import { OutputChannelLogger, TypedCollectionItemProvider } from "@shared";
import { getTemporaryJsFileBasename } from "@global_shared";

/**
 * Older versions of the extension created a temporary Javascript file in the root folder of each collection and in the `additionalContextRoots` folders.
 * They are not needed anymore, since the runtime definitions are provided by the Typescript server plugin.
 *
 * Only the exact locations where the old versions created the files are checked. The files are moved to the trash.
 */
export async function deleteLegacyTempJsFiles(
    collectionItemProvider: TypedCollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    const folders = new Set([
        ...collectionItemProvider
            .getRegisteredCollections()
            .map((collection) => collection.getRootDirectory()),
        ...collectionItemProvider.getUniqueAdditionalContextRoots(),
    ]);

    await Promise.all(
        [...folders].map(async (folder) => {
            const uri = Uri.file(resolve(folder, getTemporaryJsFileBasename()));

            try {
                await workspace.fs.delete(uri, { useTrash: true });
                logger?.info(
                    `Deleted obsolete temporary file '${uri.fsPath}'.`,
                );
            } catch (err) {
                if (!(
                    err instanceof FileSystemError && err.code == "FileNotFound"
                )) {
                    logger?.warn(
                        `Could not delete obsolete temporary file '${uri.fsPath}': ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
            }
        }),
    );
}
