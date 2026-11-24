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

/** Other numbers (e.g. in hand-edited files) could not be recognized as a prefix afterwards. */
export function canSequenceBeUsedAsPrefix(sequence: number) {
    return Number.isSafeInteger(sequence) && sequence >= 0;
}

/**
 * The prefix for the name of an item with the given sequence (see {@link canSequenceBeUsedAsPrefix}), e.g. `0010_` for sequence 10 and step 10 (4 digits).
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

/** What is known about an item, for determining whether the digits at the start of its name are a sequence prefix. */
export interface KnownItemData {
    sequence?: number;
    /** The name that is stored in the file, which never contains the prefix. Without it, only the digits themselves are checked. */
    storedName?: string;
    /** If it is missing, the number of digits is not considered. */
    sequenceStep?: number;
}

/**
 * Removes a leading sequence prefix from the name (without file extension, if a stored name is given) of an existing item.
 * Names can also start with digits and an underscore without having a prefix (e.g. `404_not-found`). The digits are treated as a prefix, if one of the following is true:
 * - They match the sequence or are padded with zeros.
 * - The stored name is the same as the name without them.
 * - The stored name is neither the same as the name with them nor as the one without them, but they have the number of digits that prefixes have for the step.
 *
 * Don't use it for names that were entered by the user, since they must not be changed.
 */
export function removeSequencePrefix(name: string, itemData: KnownItemData) {
    const parsed = parseSequencePrefix(name);

    return parsed && isSequencePrefix(name, parsed, itemData)
        ? parsed.nameWithoutPrefix
        : name;
}

/** Sets the prefix for the given sequence. An already existing prefix is replaced (see {@link removeSequencePrefix}). */
export function addSequencePrefix(
    name: string,
    itemData: { sequence: number; sequenceStep: number; storedName?: string },
) {
    const { sequence, sequenceStep } = itemData;

    return `${getSequencePrefix(sequence, sequenceStep)}${removeSequencePrefix(name, itemData)}`;
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

function isSequencePrefix(
    name: string,
    {
        digits,
        sequence: sequenceInName,
        nameWithoutPrefix,
    }: { digits: string; sequence: number; nameWithoutPrefix: string },
    { sequence, storedName, sequenceStep }: KnownItemData,
) {
    if (sequenceInName === sequence || digits.startsWith("0")) {
        return true;
    }

    if (storedName !== undefined) {
        if (areNamesEquivalent(storedName, name)) {
            return false;
        }
        if (areNamesEquivalent(storedName, nameWithoutPrefix)) {
            return true;
        }
    }

    return (
        sequenceStep !== undefined &&
        digits.length == getMinimumDigitsForSequencePrefix(sequenceStep)
    );
}

/** Names of files and folders often only differ in case and separators from the stored name (e.g. `get-token` and `Get token`). */
function areNamesEquivalent(first: string, second: string) {
    const simplify = (name: string) =>
        name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

    return (
        first === second ||
        (simplify(first) != "" && simplify(first) == simplify(second))
    );
}
