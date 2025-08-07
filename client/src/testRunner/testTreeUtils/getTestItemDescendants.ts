import { TestItem as vscodeTestItem } from "vscode";

export const getTestItemDescendants = (testItem: vscodeTestItem) => {
    let result: vscodeTestItem[] = [];
    let currentChildItems = Array.from(testItem.children).map(
        (item) => item[1]
    );

    while (currentChildItems.length > 0) {
        result = result.concat(currentChildItems);
        const nextDepthLevelDescendants: vscodeTestItem[] = [];

        currentChildItems.forEach((item) =>
            item.children.forEach((child) => {
                nextDepthLevelDescendants.push(child);
            })
        );

        currentChildItems = nextDepthLevelDescendants;
    }

    return result;
};
