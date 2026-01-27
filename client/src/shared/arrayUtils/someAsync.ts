export async function someAsync<T>(
    array: T[],
    callBack: (val: T) => Promise<boolean>
): Promise<boolean> {
    for (const val of array) {
        if (await callBack(val)) {
            return true;
        }
    }

    return false;
}
