import { basename } from "path";
import { RelativePattern, workspace } from "vscode";

export function getPatternForTestitemsInCollection(collectionRootDir: string) {
    if (!workspace.workspaceFolders) {
        return undefined;
    }

    const maybeWorkspaceFolder = workspace.workspaceFolders.find((folder) =>
        collectionRootDir.includes(folder.uri.fsPath)
    );

    return maybeWorkspaceFolder
        ? new RelativePattern(
              maybeWorkspaceFolder,
              `{**/${basename(collectionRootDir)},**/${basename(
                  collectionRootDir
              )}/**/*}`
          )
        : undefined;
}
