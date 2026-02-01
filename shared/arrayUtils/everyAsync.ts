export async function everyAsync<T>(
    array: T[],
    callBack: (val: T) => Promise<boolean>,
): Promise<boolean> {
    const bools = await Promise.all(
        array.map(async (val) => await callBack(val)),
    );

    return bools.every((val) => val);
}
