const sequencePrefixSeparator = "_";
/** The number of items per folder that should fit into the prefix without needing additional digits. */
const itemsPerFolderWithoutAdditionalDigits = 999;
const sequencePrefixRegex = new RegExp(
    `^(\\d+)${sequencePrefixSeparator}(.+)$`,
);

/**
 * The number of digits that sequence prefixes have at least, depending on the sequence step.
 * It is chosen so that up to 999 items per folder fit (step 1: 3 digits, step 5 and 10: 4 digits, step 100: 5 digits).
 */
export function getMinimumDigitsForSequencePrefix(sequenceStep: number) {
    return `${itemsPerFolderWithoutAdditionalDigits * sequenceStep}`.length;
}

/**
 * The prefix for the name of an item with the given sequence, e.g. `010_` for sequence 10 and step 10.
 * If the sequence does not fit into the minimum number of digits, more digits are used.
 */
export function getSequencePrefix(sequence: number, sequenceStep: number) {
    return `${`${sequence}`.padStart(
        getMinimumDigitsForSequencePrefix(sequenceStep),
        "0",
    )}${sequencePrefixSeparator}`;
}

/** Splits a leading `<digits>_` off the name. Returns `undefined` if the name has no such prefix (or consists only of it). */
export function parseSequencePrefix(name: string) {
    const match = sequencePrefixRegex.exec(name);

    return match
        ? {
              sequence: Number.parseInt(match[1], 10),
              nameWithoutPrefix: match[2],
          }
        : undefined;
}

export function removeSequencePrefix(name: string) {
    return parseSequencePrefix(name)?.nameWithoutPrefix ?? name;
}

/** Sets the prefix for the given sequence. An already existing prefix is replaced. */
export function addSequencePrefix(
    name: string,
    sequence: number,
    sequenceStep: number,
) {
    return `${getSequencePrefix(sequence, sequenceStep)}${removeSequencePrefix(name)}`;
}

/**
 * Whether the name starts with a prefix for the given sequence.
 * Only the numeric value is compared, so the number of leading zeros does not matter.
 */
export function doesNameHaveSequencePrefixMatching(
    name: string,
    sequence: number,
) {
    return parseSequencePrefix(name)?.sequence === sequence;
}
