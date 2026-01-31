export async function filterAsync<T>(
    array: T[],
    callBack: (val: T) => Promise<boolean>
): Promise<T[]> {
    const booleanArray = await Promise.all(array.map(callBack));

    return array.filter((_v, index) => booleanArray[index]);
}
