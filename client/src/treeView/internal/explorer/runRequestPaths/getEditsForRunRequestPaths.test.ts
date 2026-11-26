import { describe, it, expect } from "@jest/globals";
import { join, relative } from "path";
import {
    BrunoCollectionSettingsFile,
    BrunoFolderSettingsFile,
    BrunoRequestFile,
    CollectionFormat,
    CollectionItem,
    getFileExtensionForFormat,
    NonBrunoFile,
    Position,
    Range,
} from "@global_shared";
import { createCollectionWithItems } from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import {
    getEditsForRunRequestPaths,
    PathRename,
} from "./getEditsForRunRequestPaths";

const root = join("/", "collection");

describe("getEditsForRunRequestPaths", () => {
    describe.each([
        [CollectionFormat.Bru, "collection.bru", "folder.bru"],
        [CollectionFormat.Yaml, "opencollection.yml", "folder.yml"],
    ])("%s collections", (format, settingsName, folderSettingsName) => {
        const extension = getFileExtensionForFormat(format);
        const call = (path: string) => `await bru.runRequest("${path}");`;

        it("updates the calls of a renamed request in all kinds of files", async () => {
            const files = {
                [`users/get-user${extension}`]: requestFile(format, call("a")),
                [`caller${extension}`]: requestFile(
                    format,
                    call("users/get-user"),
                ),
                [settingsName]: settingsFile(format, call("users/get-user")),
                [`users/${folderSettingsName}`]: settingsFile(
                    format,
                    call("users/get-user"),
                ),
                "helpers/util.js": call("users/get-user"),
                "node_modules/dep/index.js": call("users/get-user"),
                "helpers/other.js": call("users/other"),
            };

            const edits = await getEdits(format, files, [
                {
                    sourcePath: join(root, `users/get-user${extension}`),
                    targetPath: join(root, `users/find-user${extension}`),
                    isFile: true,
                },
            ]);

            expect(summarize(edits)).toEqual(
                sortedSummary([
                    [`caller${extension}`, "users/find-user"],
                    ["helpers/util.js", "users/find-user"],
                    [settingsName, "users/find-user"],
                    [`users/${folderSettingsName}`, "users/find-user"],
                ]),
            );
        });

        it("returns the location of the edited files after moving a folder", async () => {
            const files = {
                [`users/get-user${extension}`]: requestFile(
                    format,
                    call("users/other"),
                ),
                [`users/${folderSettingsName}`]: settingsFile(
                    format,
                    call("users/other"),
                ),
                [`caller${extension}`]: requestFile(
                    format,
                    call("users/other"),
                ),
                [`unrelated/x${extension}`]: requestFile(format, call("a/b")),
            };

            const edits = await getEdits(format, files, [
                {
                    sourcePath: join(root, "users"),
                    targetPath: join(root, "archive/users"),
                    isFile: false,
                },
            ]);

            expect(summarize(edits)).toEqual(
                sortedSummary([
                    [
                        `archive/users/${folderSettingsName}`,
                        "archive/users/other",
                    ],
                    [
                        `archive/users/get-user${extension}`,
                        "archive/users/other",
                    ],
                    [`caller${extension}`, "archive/users/other"],
                ]),
            );
        });

        it("returns the position of the path within the file", async () => {
            const edits = await getEdits(
                format,
                {
                    [`caller${extension}`]: requestFile(
                        format,
                        call("users/a"),
                    ),
                },
                [
                    {
                        sourcePath: join(root, `users/a${extension}`),
                        targetPath: join(root, `users/b${extension}`),
                        isFile: true,
                    },
                ],
            );

            const content = requestFile(format, call("users/a"));
            const line = content
                .split("\n")
                .findIndex((l) => l.includes("users/a"));
            const character = content.split("\n")[line].indexOf("users/a");
            expect(edits.map(({ range }) => range)).toEqual([
                new Range(
                    new Position(line, character),
                    new Position(line, character + "users/a".length),
                ),
            ]);
        });

        it("updates the style of the original path", async () => {
            const edits = await getEdits(
                format,
                {
                    [`caller${extension}`]: requestFile(
                        format,
                        `${call(`./users/a${extension}`)}\n${call("/users/a")}`,
                    ),
                },
                [
                    {
                        sourcePath: join(root, `users/a${extension}`),
                        targetPath: join(root, `users/b${extension}`),
                        isFile: true,
                    },
                ],
            );

            expect(edits.map(({ newText }) => newText)).toEqual([
                `./users/b${extension}`,
                "/users/b",
            ]);
        });

        it.each([
            ["the collection root", join(root), join("/", "renamed"), false],
            [
                "a move into another collection",
                join(root, "users"),
                join("/", "other", "users"),
                false,
            ],
            [
                "a request that is renamed to another file type",
                join(root, `users/a${extension}`),
                join(root, "users/a.txt"),
                true,
            ],
            [
                "a non-request file",
                join(root, "helpers/util.js"),
                join(root, "helpers/util2.js"),
                true,
            ],
            // E.g. when changing the sequence of a request via drag-and-drop within the same folder.
            [
                "a request that is moved to its own path",
                join(root, `users/a${extension}`),
                join(root, `users/a${extension}`),
                true,
            ],
            [
                "a folder that is moved to its own path",
                join(root, "users"),
                join(root, "users"),
                false,
            ],
        ])(
            "returns no edits for %s",
            async (_, sourcePath, targetPath, isFile) => {
                const edits = await getEdits(
                    format,
                    {
                        [`users/a${extension}`]: requestFile(format, call("a")),
                        "helpers/util.js": call("users/a"),
                        [`caller${extension}`]: requestFile(
                            format,
                            call("users/a"),
                        ),
                    },
                    [{ sourcePath, targetPath, isFile }],
                );

                expect(edits).toEqual([]);
            },
        );

        it.each([
            ["the quote character", 'users/it"s', '"'],
            ["a substitution of a template literal", "users/${x}", "`"],
        ])("skips new paths that contain %s", async (_, newName, quote) => {
            const edits = await getEdits(
                format,
                {
                    [`caller${extension}`]: requestFile(
                        format,
                        `bru.runRequest(${quote}users/a${quote});`,
                    ),
                },
                [
                    {
                        sourcePath: join(root, `users/a${extension}`),
                        targetPath: join(root, `${newName}${extension}`),
                        isFile: true,
                    },
                ],
            );

            expect(edits).toEqual([]);
        });

        it("logs skipped calls", async () => {
            const messages: string[] = [];

            await getEdits(
                format,
                {
                    [`caller${extension}`]: requestFile(
                        format,
                        call("users/a"),
                    ),
                },
                [
                    {
                        sourcePath: join(root, `users/a${extension}`),
                        targetPath: join(root, `users/a"b${extension}`),
                        isFile: true,
                    },
                ],
                (message) => messages.push(message),
            );

            expect(messages).toHaveLength(1);
            expect(messages[0]).toContain("users/a");
        });
    });

    it("skips new paths of single-line Yaml scalars that would change their meaning", async () => {
        const content = `info:
  name: a
  type: http
runtime:
  scripts:
    - type: before-request
      code: bru.runRequest('users/a');
`;

        const edits = await getEdits(
            CollectionFormat.Yaml,
            { "caller.yml": content },
            [
                {
                    sourcePath: join(root, "users/a.yml"),
                    targetPath: join(root, "users/a: b.yml"),
                    isFile: true,
                },
            ],
        );
        const okEdits = await getEdits(
            CollectionFormat.Yaml,
            { "caller.yml": content },
            [
                {
                    sourcePath: join(root, "users/a.yml"),
                    targetPath: join(root, "users/b.yml"),
                    isFile: true,
                },
            ],
        );

        expect(edits).toEqual([]);
        expect(summarize(okEdits)).toEqual([["caller.yml", "users/b"]]);
    });

    it("returns no edits for files that cannot be read", async () => {
        const { collection } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [new BrunoRequestFile(join(root, "a.bru"))],
                CollectionFormat.Bru,
                [],
                root,
            );

        expect(
            await getEditsForRunRequestPaths(
                collection,
                [
                    {
                        sourcePath: join(root, "a.bru"),
                        targetPath: join(root, "b.bru"),
                        isFile: true,
                    },
                ],
                async () => undefined,
            ),
        ).toEqual([]);
    });

    describe("for several renames at once", () => {
        const format = CollectionFormat.Bru;
        const call = (path: string) => `await bru.runRequest("${path}");`;
        const renameOf = (from: string, to: string, isFile = true) => ({
            sourcePath: join(root, from),
            targetPath: join(root, to),
            isFile,
        });

        it("does not apply a rename to the result of another one", async () => {
            const edits = await getEdits(
                format,
                {
                    "0010_a.bru": requestFile(format, call("0010_a")),
                    "0020_a.bru": requestFile(format, call("0020_a")),
                    "caller.bru": requestFile(
                        format,
                        `${call("0010_a")}\n${call("0020_a")}`,
                    ),
                },
                [
                    renameOf("0010_a.bru", "0020_a.bru"),
                    renameOf("0020_a.bru", "0030_a.bru"),
                ],
            );

            expect(summarize(edits)).toEqual(
                sortedSummary([
                    // The files are located at their new paths after all renames.
                    ["0020_a.bru", "0020_a"],
                    ["0030_a.bru", "0030_a"],
                    ["caller.bru", "0020_a"],
                    ["caller.bru", "0030_a"],
                ]),
            );
        });

        it("updates paths of requests within a renamed folder in which requests are renamed as well", async () => {
            const edits = await getEdits(
                format,
                {
                    "users/a.bru": requestFile(format, call("users/a")),
                    "caller.bru": requestFile(format, call("users/a")),
                },
                [
                    renameOf("users/a.bru", "users/0005_a.bru"),
                    renameOf("users", "0020_users", false),
                ],
            );

            expect(summarize(edits)).toEqual(
                sortedSummary([
                    ["0020_users/0005_a.bru", "0020_users/0005_a"],
                    ["caller.bru", "0020_users/0005_a"],
                ]),
            );
        });

        it("finds files that are still registered with their old location after a previous rename", async () => {
            const { collection } =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        // The caller was moved with the folder, but is still registered with its old location.
                        new BrunoRequestFile(join(root, "a/caller.bru")),
                        new BrunoRequestFile(join(root, "b/b.bru")),
                    ],
                    format,
                    [],
                    root,
                );

            const edits = await getEditsForRunRequestPaths(
                collection,
                [renameOf("b/b.bru", "b/0010_b.bru")],
                async (path) =>
                    relative(root, path) == "b/caller.bru"
                        ? requestFile(format, call("b/b"))
                        : undefined,
                undefined,
                { previousRenames: [renameOf("a", "b", false)] },
            );

            expect(summarize(edits)).toEqual([["b/caller.bru", "b/0010_b"]]);
        });

        it("ignores files that were moved into another collection but are still registered here", async () => {
            const edits = await getEdits(
                format,
                {
                    "a/caller.bru": requestFile(format, call("users/login")),
                    "users/login.bru": requestFile(format, ""),
                },
                [renameOf("users/login.bru", "users/0010_login.bru")],
                undefined,
                [
                    {
                        sourcePath: join(root, "a"),
                        targetPath: join("/", "other-collection", "a"),
                        isFile: false,
                    },
                ],
            );

            expect(edits).toEqual([]);
        });

        it("only returns one edit per path if files are registered with their old and new location", async () => {
            const edits = await getEdits(
                format,
                {
                    "a/caller.bru": requestFile(format, call("b/x")),
                    "b/caller.bru": requestFile(format, call("b/x")),
                },
                [renameOf("b/x.bru", "b/0010_x.bru")],
                undefined,
                [renameOf("a", "b", false)],
            );

            expect(summarize(edits)).toEqual([["b/caller.bru", "b/0010_x"]]);
        });
    });
});

async function getEdits(
    format: CollectionFormat,
    filesByRelativePath: Record<string, string>,
    renames: PathRename[],
    log?: (message: string) => void,
    previousRenames?: PathRename[],
) {
    const extension = getFileExtensionForFormat(format);
    const { collection } =
        createCollectionWithItems<TypedCollectionItemProvider>(
            // The sources of renamed files are registered in the collection, even if they have no content.
            [
                ...Object.keys(filesByRelativePath).map((path) =>
                    join(root, path),
                ),
                ...renames
                    .filter(
                        ({ isFile, sourcePath }) =>
                            isFile &&
                            !(
                                relative(root, sourcePath) in
                                filesByRelativePath
                            ),
                    )
                    .map(({ sourcePath }) => sourcePath),
            ].map((path) => createItem(path, extension)),
            format,
            [],
            root,
        );

    return await getEditsForRunRequestPaths(
        collection,
        renames,
        async (path) => filesByRelativePath[relative(root, path)],
        log ? ({ info: log } as never) : undefined,
        { previousRenames },
    );
}

function createItem(path: string, extension: string): CollectionItem {
    const name = path.substring(path.lastIndexOf("/") + 1);

    if (name == "collection.bru" || name == "opencollection.yml") {
        return new BrunoCollectionSettingsFile(path);
    }

    if (name == "folder.bru" || name == "folder.yml") {
        return new BrunoFolderSettingsFile(path);
    }

    return name.endsWith(extension)
        ? new BrunoRequestFile(path)
        : new NonBrunoFile(path);
}

function summarize(
    edits: Awaited<ReturnType<typeof getEditsForRunRequestPaths>>,
) {
    return sortedSummary(
        edits.map(({ filePath, newText }) => [
            relative(root, filePath),
            newText,
        ]),
    );
}

function sortedSummary(summary: string[][]) {
    return summary.sort(([a], [b]) => a.localeCompare(b));
}

function requestFile(format: CollectionFormat, code: string) {
    return format == CollectionFormat.Bru
        ? `meta {\n  name: a\n}\n\nscript:pre-request {\n  ${code.split("\n").join("\n  ")}\n}\n`
        : `info:\n  name: a\n  type: http\nruntime:\n  scripts:\n    - type: before-request\n      code: |-\n        ${code.split("\n").join("\n        ")}\n`;
}

function settingsFile(format: CollectionFormat, code: string) {
    return format == CollectionFormat.Bru
        ? `script:pre-request {\n  ${code}\n}\n`
        : `request:\n  scripts:\n    - type: before-request\n      code: |-\n        ${code}\n`;
}
