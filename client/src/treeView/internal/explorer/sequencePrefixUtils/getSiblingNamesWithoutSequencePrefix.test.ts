import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    NonBrunoFile,
} from "@global_shared";
import {
    createCollectionWithItems,
    requestContent,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { getSiblingNamesWithoutSequencePrefix } from "./getSiblingNamesWithoutSequencePrefix";

describe("getSiblingNamesWithoutSequencePrefix", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    it.each([
        [CollectionFormat.Bru, "bru"],
        [CollectionFormat.Yaml, "yml"],
    ])(
        "only returns the siblings of the same kind, without their prefixes (%s)",
        async (format, extension) => {
            const requestName = `001_login.${extension}`;
            const requestWithDigits = `404_error.${extension}`;
            const directory = await createTemporaryDirectory({
                [requestName]: requestContent(format, "login", 1),
                [requestWithDigits]: requestContent(format, "404_error", 2),
            });
            const usersFolder = join(directory, "001_users");
            const { collection } =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        new BrunoRequestFile(join(directory, requestName), 1),
                        new BrunoRequestFile(
                            join(directory, requestWithDigits),
                            2,
                        ),
                        new BrunoRequestFile(
                            join(directory, `own.${extension}`),
                        ),
                        new NonBrunoFile(join(directory, "001_data.json")),
                        new CollectionDirectory(
                            usersFolder,
                            join(usersFolder, `folder.${extension}`),
                            1,
                        ),
                        new BrunoRequestFile(
                            join(usersFolder, `nested.${extension}`),
                        ),
                    ],
                    format,
                    [],
                    directory,
                );
            const getNames = (isFile: boolean) =>
                getSiblingNamesWithoutSequencePrefix(collection, directory, {
                    isFile,
                    excludedPath: join(directory, `own.${extension}`),
                });

            expect((await getNames(true)).sort()).toEqual([
                "001_data.json",
                requestWithDigits,
                `login.${extension}`,
            ]);
            expect(await getNames(false)).toEqual(["users"]);
        },
    );
});
