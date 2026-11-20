/**
 * Polls the condition until it is met. Throws if it is not met within the given time.
 */
export async function waitUntil(
    condition: () => boolean,
    timeoutInMs = 3000,
    pollIntervalInMs = 20,
) {
    const start = Date.now();

    while (!condition()) {
        if (Date.now() - start > timeoutInMs) {
            throw new Error(`Condition not met within ${timeoutInMs} ms.`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalInMs));
    }
}
