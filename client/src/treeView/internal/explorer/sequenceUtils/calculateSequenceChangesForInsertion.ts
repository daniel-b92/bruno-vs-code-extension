export interface SequencedItem {
    /** The path of the file that stores the sequence (e.g. a request file or a folder settings file). */
    path: string;
    sequence: number;
}

export enum SequenceInsertionPointType {
    /** At the end of the folder, after all existing items. */
    Append = 1,
    /** Directly after the item with the given sequence. */
    After = 2,
    /** Directly before the item with the given sequence. */
    Before = 3,
}

export type SequenceInsertionPoint =
    | { type: SequenceInsertionPointType.Append }
    | {
          type:
              | SequenceInsertionPointType.After
              | SequenceInsertionPointType.Before;
          /** The sequence of the item, that the new item should be inserted after/before. */
          sequence: number;
      };

export interface SequenceChangesForInsertion {
    newSequence: number;
    /** Existing items whose sequence needs to change, so that the new item gets its own sequence. Together with the new sequence for each one. */
    shiftedItems: SequencedItem[];
}

/**
 * Calculates the sequence for a new item (or an item that is moved within a folder), while keeping the sequences of the existing items whenever possible.
 *
 * - Between two items with a gap, the new item gets the integer closest to the middle (rounded down). No other item changes.
 * - Without a free integer, the new item gets the sequence directly after the previous item.
 *   Only the directly consecutive following items are shifted by 1, up to the next gap.
 * - At the end of the folder, the new item gets the highest sequence plus the sequence step.
 *
 * @param existingItems The other items of the folder. Must not contain the item that is inserted (e.g. with its sequence from before moving it).
 */
export function calculateSequenceChangesForInsertion(
    existingItems: SequencedItem[],
    insertionPoint: SequenceInsertionPoint,
    sequenceStep: number,
): SequenceChangesForInsertion {
    switch (insertionPoint.type) {
        case SequenceInsertionPointType.Append:
            return {
                newSequence: getHighestSequence(existingItems) + sequenceStep,
                shiftedItems: [],
            };
        case SequenceInsertionPointType.After: {
            const previous = insertionPoint.sequence;
            const next = getSmallestSequenceAbove(existingItems, previous);

            return next === undefined
                ? // The target is the last item, so there is nothing to insert between.
                  { newSequence: previous + sequenceStep, shiftedItems: [] }
                : insertBetween(existingItems, previous, next);
        }
        case SequenceInsertionPointType.Before: {
            const next = insertionPoint.sequence;
            const previous =
                getLargestSequenceBelow(existingItems, next) ??
                // For the first item, sequences below 1 are not used, so that the new item can only get a free integer between 1 and the item's sequence.
                Math.min(0, next - 1);

            return insertBetween(existingItems, previous, next);
        }
    }
}

function insertBetween(
    existingItems: SequencedItem[],
    previousSequence: number,
    nextSequence: number,
): SequenceChangesForInsertion {
    const difference = nextSequence - previousSequence;

    if (difference >= 2) {
        return {
            newSequence: previousSequence + Math.floor(difference / 2),
            shiftedItems: [],
        };
    }

    const newSequence = previousSequence + 1;
    const shiftedItems: SequencedItem[] = [];

    // The following items are shifted by 1 one after another, as long as they would otherwise not be behind the previous one anymore.
    // Sequences are not necessarily integers (e.g. in hand-edited files), so comparing to the last assigned sequence keeps the order in any case.
    let lastAssigned = newSequence;

    for (const { path, sequence } of [...existingItems]
        .filter((item) => item.sequence >= nextSequence)
        .sort((a, b) => a.sequence - b.sequence)) {
        if (sequence > lastAssigned) {
            break;
        }

        lastAssigned = sequence + 1;
        shiftedItems.push({ path, sequence: lastAssigned });
    }

    return { newSequence, shiftedItems };
}

function getHighestSequence(items: SequencedItem[]) {
    return items.length > 0
        ? Math.max(...items.map(({ sequence }) => sequence))
        : 0;
}

function getSmallestSequenceAbove(items: SequencedItem[], threshold: number) {
    const sequences = items
        .map(({ sequence }) => sequence)
        .filter((sequence) => sequence > threshold);

    return sequences.length > 0 ? Math.min(...sequences) : undefined;
}

function getLargestSequenceBelow(items: SequencedItem[], threshold: number) {
    const sequences = items
        .map(({ sequence }) => sequence)
        .filter((sequence) => sequence < threshold);

    return sequences.length > 0 ? Math.max(...sequences) : undefined;
}
