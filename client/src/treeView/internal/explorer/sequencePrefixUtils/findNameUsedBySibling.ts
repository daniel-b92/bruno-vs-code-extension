/**
 * Returns the sibling name that conflicts with the given one, if there is any (see `getSiblingNamesWithoutSequencePrefix`).
 * Names that only differ in their case conflict as well, since they could not exist next to each other without prefixes on a case-insensitive file system.
 */
export function findNameUsedBySibling(
    name: string,
    siblingNamesWithoutPrefix: string[],
) {
    const lowerCaseName = name.toLowerCase();

    return siblingNamesWithoutPrefix.find(
        (siblingName) => siblingName.toLowerCase() == lowerCaseName,
    );
}
