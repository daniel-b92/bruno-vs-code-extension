import { BrunoTreeItem } from "./brunoTreeItem";

export class BrunoTestItemRegistry {
    private brunoTreeItems: BrunoTreeItem[] = [];

    public getItem(path: string) {
        return this.brunoTreeItems.find((item) => item.getPath() == path);
    }

    public registerItem(item: BrunoTreeItem) {
        this.brunoTreeItems.push(item);
    }

    public unregisterItem(path: string) {
        if (!this.brunoTreeItems.some((item) => item.getPath() == path)) {
            console.warn(
                `No tree item with path '${path}' found for unregistering.`
            );
        } else {
            this.brunoTreeItems.splice(
                this.brunoTreeItems.findIndex((item) => item.getPath() == path),
                1
            );
        }
    }
}
