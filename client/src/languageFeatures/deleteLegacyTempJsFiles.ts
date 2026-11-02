import { Uri, workspace } from "vscode";
import { resolve } from "path";
import { OutputChannelLogger, TypedCollectionItemProvider } from "@shared";
import { getTemporaryJsFileBasename } from "@global_shared";

/**
 * Older versions of the extension created a temporary Javascript file in the root folder of each collection and in the `additionalContextRoots` folders.
 * They are not needed anymore, since the runtime definitions are provided by the Typescript server plugin.
 *
 * Only the exact locations where the old versions created the files are checked. The files are moved to the trash, if possible.
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

            // Checked upfront, since a missing trash support is reported before checking whether the file exists.
            if (!(await fileExists(uri))) {
                return;
            }

            try {
                await deleteFile(uri);
                logger?.info(
                    `Deleted obsolete temporary file '${uri.fsPath}'.`,
                );
            } catch (err) {
                logger?.warn(
                    `Could not delete obsolete temporary file '${uri.fsPath}': ${err instanceof Error ? err.message : String(err)}`,
                );
            }
        }),
    );
}

async function fileExists(uri: Uri) {
    try {
        await workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

async function deleteFile(uri: Uri) {
    try {
        await workspace.fs.delete(uri, { useTrash: true });
    } catch {
        // Moving files to the trash is only supported if they are on the same machine as the VS Code UI (e.g. not in WSL or SSH remote setups).
        await workspace.fs.delete(uri, { useTrash: false });
    }
}
