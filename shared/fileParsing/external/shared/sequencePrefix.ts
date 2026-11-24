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
 * The prefix for the name of an item with the given sequence, e.g. `0010_` for sequence 10 and step 10 (4 digits).
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
              digits: match[1],
              sequence: Number.parseInt(match[1], 10),
              nameWithoutPrefix: match[2],
          }
        : undefined;
}

/**
 * Removes a leading sequence prefix from the name of an existing item. Names that merely start with digits and an underscore (e.g. `2024_reports`) are kept,
 * since the prefix is only recognized if it looks like one that was created for the given step:
 * It matches the expected sequence, is padded with zeros or has the number of digits that prefixes have for the step.
 * Don't use it for names that were entered by the user, since they must not be changed.
 */
export function removeSequencePrefix(
    name: string,
    expected: { sequence?: number; sequenceStep: number },
) {
    const parsed = parseSequencePrefix(name);

    return parsed &&
        (parsed.sequence === expected.sequence ||
            parsed.digits.startsWith("0") ||
            parsed.digits.length ==
                getMinimumDigitsForSequencePrefix(expected.sequenceStep))
        ? parsed.nameWithoutPrefix
        : name;
}

/** Sets the prefix for the given sequence. An already existing prefix is replaced (see {@link removeSequencePrefix}). */
export function addSequencePrefix(
    name: string,
    sequence: number,
    sequenceStep: number,
) {
    return `${getSequencePrefix(sequence, sequenceStep)}${removeSequencePrefix(name, { sequence, sequenceStep })}`;
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
