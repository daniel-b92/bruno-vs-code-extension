import { describe, expect, it } from "@jest/globals";
import {
    BrunoCollectionSettingsFile,
    BrunoFileType,
    BrunoFolderSettingsFile,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
} from "@global_shared";
import { getHoverText } from "@global_shared/_testingUtils";
import {
    CURSOR,
    requestCompletions,
    requestHover,
    TestFile,
    toTestFile,
} from "../_testingUtils/languageRequestTestUtils";

/**
 * Variables that are set in post-response vars (`vars:post-response` in Bru, `set-variable` actions in Yaml) are runtime variables.
 * Variables from pre-request vars are request or folder variables, which Bruno provides to all kinds of scripts.
 */
describe("variables that are set in post-response vars", () => {
    describe.each([
        [CollectionFormat.Bru, bruRequests()],
        [CollectionFormat.Yaml, yamlRequests()],
    ])(
        "in requests of the %s format",
        (format, { login, getUser, scripts }) => {
            it("offers pre-request vars, but not post-response vars, for request variables in a post-response script", async () => {
                const labels = await complete(
                    format,
                    login({
                        postResponseScript: `bru.getRequestVar("${CURSOR}")`,
                    }),
                    [getUser({})],
                );

                expect(labels).toEqual(["userId"]);
            });

            it("offers post-response vars for runtime variables in a pre-request script of another request", async () => {
                const labels = await complete(
                    format,
                    getUser({ preRequestScript: `bru.getVar("${CURSOR}")` }),
                    [login({})],
                );

                expect(labels).toContain("token");
            });

            it("offers post-response vars for variables in the URL of another request", async () => {
                const labels = await complete(
                    format,
                    getUser({ url: `{{${CURSOR}}}` }),
                    [login({})],
                );

                expect(labels).toContain("token");
            });

            it("offers post-response vars for runtime variables in the post-response script of the same request", async () => {
                const labels = await complete(
                    format,
                    login({ postResponseScript: `bru.getVar("${CURSOR}")` }),
                    [getUser({})],
                );

                expect(labels).toContain("token");
            });

            it("shows the reads of the runtime variable in the hover for a post-response var", () => {
                const hoverText = getHoverText(
                    requestHover(
                        format,
                        login({ tokenName: `to${CURSOR}ken` }),
                        [getUser({ preRequestScript: 'bru.getVar("token")' })],
                    ),
                );

                expect(hoverText).toContain("Dynamic references");
                expect(hoverText).toContain("get-user");
            });

            it.each([
                ["tests", (code: string) => ({ tests: code }), scripts.tests],
                [
                    "a post-response script",
                    (code: string) => ({ postResponseScript: code }),
                    scripts.postResponse,
                ],
            ])(
                "shows the reads in %s in the hover for a pre-request var",
                (_description, toParts, sectionName) => {
                    const hoverText = getHoverText(
                        requestHover(
                            format,
                            login({
                                userIdName: `user${CURSOR}Id`,
                                ...toParts('bru.getRequestVar("userId")'),
                            }),
                            [getUser({})],
                        ),
                    );

                    expect(hoverText).toContain("Dynamic references");
                    expect(hoverText).toContain(sectionName);
                },
            );
        },
    );

    describe.each([
        [CollectionFormat.Bru, "folder"],
        [CollectionFormat.Bru, "collection"],
        [CollectionFormat.Yaml, "folder"],
        [CollectionFormat.Yaml, "collection"],
    ] as [CollectionFormat, SettingsLevel][])(
        "in settings files of the %s format (%s)",
        (format, level) => {
            const { settingsFile, settingsDirectory, child } = settingsScenario(
                format,
                level,
            );

            it("offers the post-response vars for runtime variables in requests within the folder", async () => {
                const labels = await complete(
                    format,
                    child({ preRequestScript: `bru.getVar("${CURSOR}")` }),
                    [settingsFile(), settingsDirectory()],
                );

                expect(labels).toContain("token");
            });

            it("shows the reads in requests within the folder in the hover for a post-response var", () => {
                const hoverText = getHoverText(
                    requestHover(format, settingsFile(`to${CURSOR}ken`), [
                        settingsDirectory(),
                        child({ preRequestScript: 'bru.getVar("token")' }),
                    ]),
                );

                expect(hoverText).toContain("Dynamic references");
                expect(hoverText).toContain("child");
            });
        },
    );

    describe.each([[CollectionFormat.Bru], [CollectionFormat.Yaml]])(
        "in folder settings files of the %s format",
        (format) => {
            const { settingsFile, settingsDirectory, child, beforeFolder } =
                settingsScenario(format, "folder");

            it("does not show reads in requests that are executed before the folder in the hover for a post-response var", () => {
                const hoverText = getHoverText(
                    requestHover(format, settingsFile(`to${CURSOR}ken`), [
                        settingsDirectory(),
                        child({ preRequestScript: 'bru.getVar("token")' }),
                        beforeFolder({
                            preRequestScript: 'bru.getVar("token")',
                        }),
                    ]),
                );

                expect(hoverText).toContain("child");
                expect(hoverText).not.toContain("before-folder");
            });
        },
    );
});

interface RequestParts {
    url?: string;
    preRequestScript?: string;
    postResponseScript?: string;
    tests?: string;
    tokenName?: string;
    userIdName?: string;
}

type RequestFactory = (parts: RequestParts) => TestFile;

async function complete(
    format: CollectionFormat,
    source: TestFile,
    otherFiles: TestFile[],
) {
    const result = await requestCompletions(format, source, otherFiles);

    return result?.map(({ label }) => label.trim()) ?? [];
}

function bruRequest(
    path: string,
    sequence: number,
    {
        url = "https://example.com",
        preRequestScript,
        postResponseScript,
        tests,
        tokenName = "token",
        userIdName = "userId",
    }: RequestParts,
    withVars: boolean,
) {
    return toTestFile({
        item: new BrunoRequestFile(path, sequence),
        content: [
            `get {\n  url: ${url}\n}`,
            withVars
                ? `vars:pre-request {\n  ${userIdName}: 42\n}\n\nvars:post-response {\n  ${tokenName}: res.body.token\n}`
                : undefined,
            preRequestScript &&
                `script:pre-request {\n  ${preRequestScript}\n}`,
            postResponseScript &&
                `script:post-response {\n  ${postResponseScript}\n}`,
            tests && `tests {\n  ${tests}\n}`,
        ]
            .filter((block) => block != undefined)
            .join("\n\n"),
    });
}

function yamlRequest(
    path: string,
    sequence: number,
    {
        url = "https://example.com",
        preRequestScript,
        postResponseScript,
        tests,
        tokenName = "token",
        userIdName = "userId",
    }: RequestParts,
    withVars: boolean,
) {
    const scripts = [
        preRequestScript && yamlScript("before-request", preRequestScript),
        postResponseScript && yamlScript("after-response", postResponseScript),
        tests && yamlScript("tests", tests),
    ].filter((script) => script != undefined);
    const runtimeSections = [
        withVars
            ? `  variables:\n    - name: ${userIdName}\n      value: "42"\n  actions:\n${yamlSetVariableAction(tokenName)}`
            : undefined,
        scripts.length > 0 ? `  scripts:\n${scripts.join("\n")}` : undefined,
    ].filter((section) => section != undefined);

    return toTestFile({
        item: new BrunoRequestFile(path, sequence),
        content: `info:
  name: ${path}
  type: http
  seq: ${sequence}
http:
  method: GET
  url: "${url}"
${runtimeSections.length > 0 ? `runtime:\n${runtimeSections.join("\n")}\n` : ""}`,
    });
}

function bruRequests() {
    return {
        login: ((parts) =>
            bruRequest(
                "/collection/login.bru",
                1,
                parts,
                true,
            )) as RequestFactory,
        getUser: ((parts) =>
            bruRequest(
                "/collection/get-user.bru",
                2,
                parts,
                false,
            )) as RequestFactory,
        scripts: { tests: "tests", postResponse: "script:post-response" },
    };
}

function yamlRequests() {
    return {
        login: ((parts) =>
            yamlRequest(
                "/collection/login.yml",
                1,
                parts,
                true,
            )) as RequestFactory,
        getUser: ((parts) =>
            yamlRequest(
                "/collection/get-user.yml",
                2,
                parts,
                false,
            )) as RequestFactory,
        scripts: {
            tests: "scripts[0]:tests",
            postResponse: "scripts[0]:after-response",
        },
    };
}

function yamlScript(type: string, code: string) {
    return `    - type: ${type}\n      code: |\n        ${code}`;
}

function yamlSetVariableAction(name: string) {
    return `    - type: set-variable
      phase: after-response
      selector:
        expression: $.token
        method: jsonq
      variable:
        name: ${name}
        scope: runtime`;
}

/** A folder or collection settings file that sets the post-response variable `token`, together with requests that are executed before or within the folder. */
function settingsScenario(format: CollectionFormat, level: SettingsLevel) {
    const isBru = format == CollectionFormat.Bru;
    const extension = isBru ? ".bru" : ".yml";
    const isFolder = level == "folder";
    const directoryPath = isFolder ? "/collection/folder" : "/collection";
    const settingsPath = isFolder
        ? `${directoryPath}/folder${extension}`
        : isBru
          ? "/collection/collection.bru"
          : "/collection/opencollection.yml";
    const getContent = (tokenName: string) =>
        isBru
            ? `meta {\n  name: settings\n}\n\nvars:post-response {\n  ${tokenName}: res.body.token\n}\n`
            : `info:
  name: settings
  type: ${isFolder ? "folder" : "collection"}
request:
  actions:
${yamlSetVariableAction(tokenName)}
`;
    const request = isBru ? bruRequest : yamlRequest;

    return {
        settingsFile: (tokenName = "token") =>
            toTestFile({
                item: isFolder
                    ? new BrunoFolderSettingsFile(settingsPath)
                    : new BrunoCollectionSettingsFile(settingsPath),
                content: getContent(tokenName),
            }),
        /** The additional data of the settings are stored in the directory (the root directory for the collection settings). */
        settingsDirectory: (): TestFile => ({
            item: new CollectionDirectory(directoryPath, settingsPath, 1),
            content: getContent("token"),
            parsedAs: isFolder
                ? BrunoFileType.FolderSettingsFile
                : BrunoFileType.CollectionSettingsFile,
        }),
        child: ((parts) =>
            request(
                `${directoryPath}/child${extension}`,
                1,
                parts,
                false,
            )) as RequestFactory,
        beforeFolder: ((parts) =>
            request(
                `/collection/before-folder${extension}`,
                0,
                parts,
                false,
            )) as RequestFactory,
    };
}

type SettingsLevel = "folder" | "collection";
