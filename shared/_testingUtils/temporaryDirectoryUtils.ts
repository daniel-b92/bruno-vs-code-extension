import { afterEach } from "@jest/globals";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";

/**
 * Has to be called within a `describe` block (or at the top level of a test file).
 * All directories that were created via the returned function are removed after each test.
 *
 * The returned function creates a temporary directory with the given files (keys are paths relative to the directory)
 * and returns the absolute path of the directory.
 */
export function useTemporaryDirectories() {
    const createdDirectories: string[] = [];

    afterEach(async () => {
        await Promise.all(
            createdDirectories
                .splice(0)
                .map((dir) => rm(dir, { recursive: true, force: true })),
        );
    });

    return async (filesByRelativePath: Record<string, string> = {}) => {
        const rootDirectory = await mkdtemp(join(tmpdir(), "bru-test-"));
        createdDirectories.push(rootDirectory);

        for (const [relativePath, content] of Object.entries(
            filesByRelativePath,
        )) {
            const absolutePath = join(rootDirectory, relativePath);
            await mkdir(dirname(absolutePath), { recursive: true });
            await writeFile(absolutePath, content, "utf-8");
        }

        return rootDirectory;
    };
}
