import { BrunoTreeItem } from "@shared";

/**
 * Sorts the tree items for display (without mutating the given array):
 * Folders come before files. Items with a sequence come before items without one and are ordered by their sequence.
 * Items without a sequence are ordered alphabetically by their label (case-insensitive).
 */
export function sortTreeItems<T extends BrunoTreeItem>(items: T[]) {
    return items.slice().sort((a, b) => {
        if (a.isFile != b.isFile) {
            // Display all subfolders before files
            return a.isFile ? 1 : -1;
        }
        const sequenceForA = a.getSequence();
        const sequenceForB = b.getSequence();

        if (
            sequenceForA === undefined &&
            sequenceForB === undefined &&
            a.label &&
            b.label
        ) {
            // Order items without a sequence alphabetically by label
            const labelForA = (
                typeof a.label == "string" ? a.label : a.label.label
            ).toLowerCase();
            const labelForB = (
                typeof b.label == "string" ? b.label : b.label.label
            ).toLowerCase();

            return labelForA <= labelForB ? -1 : 1;
        }

        if (sequenceForA === undefined || sequenceForB === undefined) {
            // Diplay items with a sequence before items without one
            return sequenceForA !== undefined ? -1 : 1;
        }

        return sequenceForA - sequenceForB;
    });
}
