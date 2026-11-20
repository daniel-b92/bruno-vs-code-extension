import { execFileSync } from "node:child_process";

/** Returns the paths of all files tracked by git (relative to the repo root). */
export const getTrackedFiles = () =>
    execFileSync("git", ["ls-files", "-z"], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    })
        .split("\0")
        .filter((file) => file !== "");

/** Returns the tracked files with the given file name (in any folder). */
export const getTrackedFilesWithName = (fileName) =>
    getTrackedFiles().filter(
        (file) => file === fileName || file.endsWith(`/${fileName}`),
    );
