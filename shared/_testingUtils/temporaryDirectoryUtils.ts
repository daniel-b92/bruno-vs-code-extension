import { afterEach } from "@jest/globals";
import { mkdirSync, writeFileSync } from "fs";
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "fs/promises";
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

/**
 * Synchronous variant for writing files (keys are paths relative to the directory) into an existing directory.
 * Missing parent directories are created and existing files are overwritten.
 */
export function writeFilesSync(
    directory: string,
    filesByRelativePath: Record<string, string>,
) {
    for (const [relativePath, content] of Object.entries(filesByRelativePath)) {
        const absolutePath = join(directory, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, content, "utf-8");
    }
}

const unmodifiedTime = new Date("2000-01-01T00:00:00Z");

/**
 * Sets the modification time of the files (relative to the directory) to a fixed time in the past,
 * so that it can be detected afterwards with `getModifiedFiles` whether they were written.
 * Returns the absolute paths of the files.
 */
export async function markFilesAsUnmodified(
    directory: string,
    relativePaths: string[],
) {
    const paths = relativePaths.map((path) => join(directory, path));

    for (const path of paths) {
        await utimes(path, unmodifiedTime, unmodifiedTime);
    }

    return paths;
}

/** Returns those of the given files, whose modification time differs from the one that was set by `markFilesAsUnmodified`. */
export async function getModifiedFiles(filePaths: string[]) {
    const modified: string[] = [];

    for (const path of filePaths) {
        if ((await stat(path)).mtime.getTime() != unmodifiedTime.getTime()) {
            modified.push(path);
        }
    }

    return modified;
}
