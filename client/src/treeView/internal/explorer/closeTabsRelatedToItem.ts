import { Tab, window, TabInputText } from "vscode";
import { normalizeDirectoryPath } from "../../../shared";
import { BrunoTreeItem } from "../../brunoTreeItem";

export async function closeTabsRelatedToItem(item: BrunoTreeItem) {
    const path = item.getPath();
    const toClose: Tab[] = [];

    for (const group of window.tabGroups.all) {
        toClose.push(
            ...group.tabs.filter(
                (tab) =>
                    tab.input instanceof TabInputText &&
                    (item.isFile
                        ? tab.input.uri.fsPath == path
                        : tab.input.uri.fsPath.startsWith(
                              normalizeDirectoryPath(path),
                          )),
            ),
        );
    }

    await window.tabGroups.close(toClose);
}
