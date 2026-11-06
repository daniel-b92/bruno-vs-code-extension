import {
    BrunoFileType,
    CollectionItem,
    NonBrunoSpecificItemType,
} from "@global_shared";
import * as vscode from "vscode";

const requestIcon = createIcon("arrow-swap", "charts.blue");
const folderSettingsIcon = createIcon("settings", "charts.orange");
const collectionSettingsIcon = createIcon("settings-gear", "charts.purple");
const environmentIcon = createIcon("variable-group", "charts.green");
const appIcon = createIcon("browser", "charts.yellow");

/**
 * Determines the icon for Bruno specific files in the collection explorer.
 *
 * For all other items (e.g. folders, `.js` or `.json` files), no icon is returned, so that the icons of the active file icon theme are used.
 */
export function getIconForItem(
    item: CollectionItem,
    isCollectionRootFile: boolean,
) {
    switch (item.getItemType()) {
        case BrunoFileType.RequestFile:
            return requestIcon;
        case BrunoFileType.FolderSettingsFile:
            return folderSettingsIcon;
        case BrunoFileType.CollectionSettingsFile:
            return collectionSettingsIcon;
        case BrunoFileType.EnvironmentFile:
            return environmentIcon;
        case BrunoFileType.AppFile:
            return appIcon;
        case NonBrunoSpecificItemType.OtherFileType:
            // For the Bru format, the collection root file `bruno.json` is not a `.bru` file and therefore not identified as a Bruno specific file.
            return isCollectionRootFile ? collectionSettingsIcon : undefined;
        default:
            return undefined;
    }
}

function createIcon(id: string, colorId: string) {
    return new vscode.ThemeIcon(id, new vscode.ThemeColor(colorId));
}
