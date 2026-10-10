import { describe, it, expect } from "@jest/globals";
import {
    Block,
    BrunoFileType,
    getOptionalKeysForSettingsBlock,
    getPossibleMethodBlocksForRequestType,
    isBlockDictionaryBlock,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import {
    getRequestTypeFieldFromRequestFileContent,
    parseBlocksFromRequestFileContent,
} from "@global_shared/_testingUtils";
import { checkAtMostOneBodyBlockExists } from "./checks/multipleBlocks/checkAtMostOneBodyBlockExists";
import { checkBlockForResponseValidationExists } from "./checks/multipleBlocks/checkBlockForResponseValidationExists";
import { checkMethodBlockMatchesRequestType } from "./checks/multipleBlocks/checkMethodBlockMatchesRequestType";
import { checkOnlyValidBlocksAreDefinedForWsRequests } from "./checks/multipleBlocks/checkOnlyValidBlocksAreDefinedForWsRequests";
import { checkWsSpecificBlocksAreNotDefinedForOtherRequests } from "./checks/multipleBlocks/checkWsSpecificBlocksAreNotDefinedForOtherRequests";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { getSettingsBlockSpecificDiagnostics } from "./getSettingsBlockSpecificDiagnostics";
import { getWsBodyBlockSpecificDiagnostics } from "./getWsBodyBlockSpecificDiagnostics";
import { getMissingOptionalBlocks } from "../../shared/getMissingOptionalBlocks";
import { getMissingMandatoryBlocks } from "../../shared/getMissingMandatoryBlocks";
import { checkUrlFromMethodBlockMatchesPathParamsBlock } from "./checks/multipleBlocks/checkUrlFromMethodBlockMatchesPathParamsBlock";
import { checkUrlFromMethodBlockMatchesQueryParamsBlock } from "./checks/multipleBlocks/checkUrlFromMethodBlockMatchesQueryParamsBlock";
import { NonBlockSpecificDiagnosticCode } from "../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { RelevantWithinSettingsBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinSettingsBlockDiagnosticCodeEnum";
import { RelevantWithinWsBodyBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinWsBodyBlockDiagnosticCodeEnum";

const filePath = "/collection/ws_example.bru";

describe("websocket request files", () => {
    it("parses all websocket specific blocks as dictionary blocks", () => {
        const blocks = parseBlocksFromRequestFileContent(
            getWsFileContent("ws", "ws"),
        );

        for (const name of [
            RequestFileBlockName.Ws,
            RequestFileBlockName.WsBody,
            RequestFileBlockName.Settings,
        ]) {
            const matchingBlocks = blocks.filter((b) => b.name == name);

            expect(matchingBlocks.length).toBeGreaterThan(0);
            expect(matchingBlocks.every(isBlockDictionaryBlock)).toBe(true);
        }
    });

    it("finds variable references in the multiline content of the websocket body blocks", () => {
        const referencedVariables = parseBlocksFromRequestFileContent(
            getWsFileContent("ws", "ws"),
        )
            .filter(({ name }) => name == RequestFileBlockName.WsBody)
            .flatMap(
                ({ variableReferences }) =>
                    variableReferences?.map(
                        ({ variableName }) => variableName,
                    ) ?? [],
            );

        expect(referencedVariables).toEqual(["other"]);
    });

    describe("getPossibleMethodBlocksForRequestType", () => {
        it("only allows the ws block for websocket requests", () => {
            expect(getPossibleMethodBlocksForRequestType("ws")).toEqual([
                RequestFileBlockName.Ws,
            ]);
        });

        it("does not allow the ws block for other requests", () => {
            for (const requestType of ["http", "graphql", "grpc"]) {
                expect(
                    getPossibleMethodBlocksForRequestType(requestType),
                ).not.toContain(RequestFileBlockName.Ws);
            }
        });

        it("allows all blocks if the request type is unknown", () => {
            expect(getPossibleMethodBlocksForRequestType(undefined)).toContain(
                RequestFileBlockName.Ws,
            );
        });
    });

    describe("checkWsSpecificBlocksAreNotDefinedForOtherRequests", () => {
        it("reports no problem for websocket requests", () => {
            expect(
                checkWsSpecificBlocksAreNotDefinedForOtherRequests(
                    filePath,
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    ),
                    getRequestTypeFieldFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    ),
                ),
            ).toBeUndefined();
        });

        it("reports all websocket specific blocks for other request types", () => {
            const result = checkWsSpecificBlocksAreNotDefinedForOtherRequests(
                filePath,
                parseBlocksFromRequestFileContent(
                    getWsFileContent("http", "get"),
                ),
                getRequestTypeFieldFromRequestFileContent(
                    getWsFileContent("http", "get"),
                ),
            );

            expect(result?.code).toBe(
                NonBlockSpecificDiagnosticCode.WsBlocksDefinedForNonWsRequestType,
            );
            // 2 x body:ws
            expect(result?.relatedInformation).toHaveLength(2);
        });

        it("reports the ws block for other request types", () => {
            const result = checkWsSpecificBlocksAreNotDefinedForOtherRequests(
                filePath,
                parseBlocksFromRequestFileContent(
                    getWsFileContent("http", "ws"),
                ),
                getRequestTypeFieldFromRequestFileContent(
                    getWsFileContent("http", "ws"),
                ),
            );

            expect(result?.relatedInformation).toHaveLength(3);
        });
    });

    describe("checkMethodBlockMatchesRequestType", () => {
        it("reports no problem for the ws block in websocket requests", () => {
            expect(
                checkMethodBlockMatchesRequestType(
                    filePath,
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    ),
                    getRequestTypeFieldFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    ),
                ),
            ).toBeUndefined();
        });

        it("reports other method blocks in websocket requests", () => {
            expect(
                checkMethodBlockMatchesRequestType(
                    filePath,
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("ws", "get"),
                    ),
                    getRequestTypeFieldFromRequestFileContent(
                        getWsFileContent("ws", "get"),
                    ),
                )?.code,
            ).toBe(
                NonBlockSpecificDiagnosticCode.MethodBlockNotMatchingRequestType,
            );
        });
    });

    describe("checkOnlyValidBlocksAreDefinedForWsRequests", () => {
        it("reports no problem for a valid websocket request", () => {
            expect(
                checkOnlyValidBlocksAreDefinedForWsRequests(
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    ),
                    getRequestTypeFieldFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    )?.value,
                ),
            ).toEqual([]);
        });

        it("reports blocks that are not valid for websocket requests", () => {
            const content = `${getWsFileContent("ws", "ws")}
script:pre-request {
  asd
}

params:query {
  a: b
}
`;

            const result = checkOnlyValidBlocksAreDefinedForWsRequests(
                parseBlocksFromRequestFileContent(content),
                getRequestTypeFieldFromRequestFileContent(content)?.value,
            );

            expect(result.map(({ code }) => code)).toEqual([
                NonBlockSpecificDiagnosticCode.BlockNotValidForWsRequestType,
                NonBlockSpecificDiagnosticCode.BlockNotValidForWsRequestType,
            ]);
        });

        it("does not report anything for other request types", () => {
            expect(
                checkOnlyValidBlocksAreDefinedForWsRequests(
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("http", "get"),
                    ),
                    getRequestTypeFieldFromRequestFileContent(
                        getWsFileContent("http", "get"),
                    )?.value,
                ),
            ).toEqual([]);
        });
    });

    describe("multiple messages", () => {
        it("does not report multiple body:ws blocks as duplicate blocks", () => {
            expect(
                checkThatNoBlocksAreDefinedMultipleTimes(
                    filePath,
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    ),
                ),
            ).toBeUndefined();
        });

        it("still reports other blocks that are defined multiple times", () => {
            expect(
                checkThatNoBlocksAreDefinedMultipleTimes(
                    filePath,
                    parseBlocksFromRequestFileContent(`${getWsFileContent("ws", "ws")}
docs {
  more
}
`),
                )?.code,
            ).toBe(
                NonBlockSpecificDiagnosticCode.MultipleDefinitionsForSameBlocks,
            );
        });

        it("does not report multiple body:ws blocks as too many body blocks", () => {
            expect(
                checkAtMostOneBodyBlockExists(
                    filePath,
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    ),
                ),
            ).toBeUndefined();
        });

        it("reports body:ws blocks combined with other body blocks", () => {
            expect(
                checkAtMostOneBodyBlockExists(
                    filePath,
                    parseBlocksFromRequestFileContent(`${getWsFileContent("ws", "ws")}
body:json {
  {}
}
`),
                )?.code,
            ).toBe(NonBlockSpecificDiagnosticCode.TooManyBodyBlocksDefined);
        });
    });

    describe("url params", () => {
        const content = getWsFileContent("ws", "ws").replace(
            "url: address",
            "url: wss://host/:room?token=abc",
        );

        it("does not require params blocks for the url of websocket requests", () => {
            const blocks = parseBlocksFromRequestFileContent(content);

            expect(
                checkUrlFromMethodBlockMatchesQueryParamsBlock(
                    filePath,
                    blocks,
                    "ws",
                ),
            ).toBeUndefined();
            expect(
                checkUrlFromMethodBlockMatchesPathParamsBlock(
                    filePath,
                    blocks,
                    "ws",
                ),
            ).toBeUndefined();
        });

        it("still requires params blocks for the url of other requests", () => {
            const blocks = parseBlocksFromRequestFileContent(content);

            expect(
                checkUrlFromMethodBlockMatchesQueryParamsBlock(
                    filePath,
                    blocks,
                    "http",
                ),
            ).toBeDefined();
            expect(
                checkUrlFromMethodBlockMatchesPathParamsBlock(
                    filePath,
                    blocks,
                    "http",
                ),
            ).toBeDefined();
        });
    });

    describe("checkBlockForResponseValidationExists", () => {
        it("does not require blocks for response validation for websocket requests", () => {
            expect(
                checkBlockForResponseValidationExists(
                    new TextDocumentHelper(getWsFileContent("ws", "ws")),
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    ),
                    getRequestTypeFieldFromRequestFileContent(
                        getWsFileContent("ws", "ws"),
                    )?.value,
                ),
            ).toBeUndefined();
        });

        it("still requires blocks for response validation for other request types", () => {
            expect(
                checkBlockForResponseValidationExists(
                    new TextDocumentHelper(getWsFileContent("http", "get")),
                    parseBlocksFromRequestFileContent(
                        getWsFileContent("http", "get"),
                    ),
                    getRequestTypeFieldFromRequestFileContent(
                        getWsFileContent("http", "get"),
                    )?.value,
                ),
            ).toBeDefined();
        });
    });

    describe("getWsBodyBlockSpecificDiagnostics", () => {
        it("reports no problem for valid body blocks", () => {
            const bodyBlocks = getWsBodyBlocks(getWsFileContent("ws", "ws"));

            expect(bodyBlocks).toHaveLength(2);
            for (const block of bodyBlocks) {
                expect(getDefinedBodyDiagnosticCodes(block)).toEqual([]);
            }
        });

        it("reports missing and unknown keys", () => {
            const [block] = getWsBodyBlocks(`body:ws {
  name: message 1
  other: value
}
`);

            expect(getDefinedBodyDiagnosticCodes(block)).toEqual(
                expect.arrayContaining([
                    RelevantWithinWsBodyBlockDiagnosticCode.KeysMissingInWsBodyBlock,
                    RelevantWithinWsBodyBlockDiagnosticCode.UnknownKeysDefinedInWsBodyBlock,
                ]),
            );
        });

        it("reports duplicate keys", () => {
            const [block] = getWsBodyBlocks(`body:ws {
  name: message 1
  name: message 2
  type: text
  content: '''
    a
  '''
}
`);

            expect(getDefinedBodyDiagnosticCodes(block)).toEqual([
                RelevantWithinWsBodyBlockDiagnosticCode.DuplicateKeysDefinedInWsBodyBlock,
            ]);
        });

        it("reports invalid message types", () => {
            const [block] = getWsBodyBlocks(`body:ws {
  name: message 1
  type: binary
  content: '''
    a
  '''
}
`);

            expect(getDefinedBodyDiagnosticCodes(block)).toEqual([
                RelevantWithinWsBodyBlockDiagnosticCode.TypeValueInvalid,
            ]);
        });

        it("reports invalid values for the selected field", () => {
            const [block] = getWsBodyBlocks(`body:ws {
  name: message 1
  type: text
  selected: maybe
  content: '''
    a
  '''
}
`);

            expect(getDefinedBodyDiagnosticCodes(block)).toEqual([
                RelevantWithinWsBodyBlockDiagnosticCode.SelectedValueInvalid,
            ]);
        });
    });

    describe("settings block", () => {
        it("only allows 'encodeUrl', 'timeout' and 'keepAliveInterval' for websocket requests", () => {
            expect(getOptionalKeysForSettingsBlock("ws")).toEqual([
                "encodeUrl",
                "timeout",
                "keepAliveInterval",
            ]);
        });

        it("does not allow 'keepAliveInterval' for other request types", () => {
            for (const requestType of ["http", "graphql", "grpc"]) {
                expect(
                    getOptionalKeysForSettingsBlock(requestType),
                ).not.toContain("keepAliveInterval");
            }
        });

        it("allows all keys if the request type is unknown", () => {
            expect(getOptionalKeysForSettingsBlock(undefined)).toContain(
                "keepAliveInterval",
            );
            expect(getOptionalKeysForSettingsBlock(undefined)).toContain(
                "followRedirects",
            );
        });

        it("reports no problem for valid settings of websocket requests", () => {
            expect(getSettingsDiagnosticCodes("ws", "ws")).toEqual([]);
        });

        it("reports settings that are not valid for websocket requests", () => {
            expect(
                getSettingsDiagnosticCodes(
                    "ws",
                    "ws",
                    "  followRedirects: true",
                ),
            ).toEqual([
                RelevantWithinSettingsBlockDiagnosticCode.UnknownKeysDefinedInSettingsBlock,
            ]);
        });

        it("reports 'keepAliveInterval' for other request types", () => {
            expect(
                getSettingsDiagnosticCodes(
                    "http",
                    "get",
                    "  keepAliveInterval: 5",
                ),
            ).toContain(
                RelevantWithinSettingsBlockDiagnosticCode.UnknownKeysDefinedInSettingsBlock,
            );
        });

        it("reports invalid values for 'keepAliveInterval'", () => {
            for (const value of ["abc", "-1", "1.5"]) {
                expect(
                    getSettingsDiagnosticCodes("ws", "ws", undefined, value),
                ).toEqual([
                    RelevantWithinSettingsBlockDiagnosticCode.KeepAliveIntervalValueInvalid,
                ]);
            }
        });
    });

    describe("getMissingOptionalBlocks", () => {
        it("suggests further body:ws blocks for websocket requests, but no blocks of other request types", () => {
            const names = getMissingOptionalBlockNames(
                getWsFileContent("ws", "ws"),
            );

            expect(names).toContain(RequestFileBlockName.WsBody);
            expect(names).not.toContain(RequestFileBlockName.JsonBody);
            expect(names).not.toContain(RequestFileBlockName.QueryParams);
            expect(names).not.toContain(RequestFileBlockName.PreRequestScript);
            expect(names).not.toContain(RequestFileBlockName.Tests);
        });

        it("still suggests further body:ws blocks if the method block defines the ws body", () => {
            const content = getWsFileContent("ws", "ws");
            const blocks = parseBlocksFromRequestFileContent(content);
            // The method block defining 'body: ws' makes all body blocks mandatory for the method block.
            const { blocksThatCannotBeOptional } = getMissingMandatoryBlocks(
                BrunoFileType.RequestFile,
                blocks,
            );

            expect(
                getMissingOptionalBlocks(
                    BrunoFileType.RequestFile,
                    blocks,
                    blocksThatCannotBeOptional.map(({ name }) => name),
                ),
            ).toContainEqual({
                mandatory: false,
                name: RequestFileBlockName.WsBody,
            });
        });

        it("does not suggest body:ws blocks if another kind of body block exists", () => {
            const names =
                getMissingOptionalBlockNames(`${getWsFileContent("ws", "ws")}
body:json {
  {}
}
`);

            expect(names).not.toContain(RequestFileBlockName.WsBody);
        });

        it("does not suggest websocket specific blocks for other request types", () => {
            const names = getMissingOptionalBlockNames(
                getWsFileContent("http", "get"),
            );

            expect(names).not.toContain(RequestFileBlockName.WsBody);
        });
    });
});

function getWsBodyBlocks(content: string) {
    return parseBlocksFromRequestFileContent(content).filter(
        ({ name }) => name == RequestFileBlockName.WsBody,
    );
}

function getDefinedBodyDiagnosticCodes(block: Block) {
    return getWsBodyBlockSpecificDiagnostics(filePath, block)
        .filter((val) => val != undefined)
        .map(({ code }) => code);
}

function getSettingsDiagnosticCodes(
    requestType: string,
    methodBlockName: string,
    additionalSetting?: string,
    keepAliveInterval = "33",
) {
    const blocks = parseBlocksFromRequestFileContent(`meta {
  name: example
  type: ${requestType}
  seq: 1
}

${methodBlockName} {
  url: address
  body: none
  auth: none
}

settings {
  encodeUrl: false
  timeout: 55
  keepAliveInterval: ${keepAliveInterval}
${additionalSetting ? `${additionalSetting}\n` : ""}}
`);
    const settingsBlock = blocks.find(
        ({ name }) => name == RequestFileBlockName.Settings,
    ) as Block;

    return (
        getSettingsBlockSpecificDiagnostics(
            filePath,
            settingsBlock,
            requestType,
        )
            .filter((val) => val != undefined)
            // For non-websocket request types, the unknown 'keepAliveInterval' key is expected to be reported.
            .filter(
                ({ code }) =>
                    requestType == "ws" ||
                    code !=
                        RelevantWithinSettingsBlockDiagnosticCode.UnknownKeysDefinedInSettingsBlock ||
                    additionalSetting != undefined,
            )
            .map(({ code }) => code)
    );
}

function getMissingOptionalBlockNames(content: string) {
    return getMissingOptionalBlocks(
        BrunoFileType.RequestFile,
        parseBlocksFromRequestFileContent(content),
        [],
    ).flatMap((entry) =>
        "mutuallyExclusiveBlocks" in entry
            ? entry.mutuallyExclusiveBlocks
            : [entry.name],
    );
}

function getWsFileContent(type: string, methodBlockName: string) {
    return `meta {
  name: ws_example
  type: ${type}
  seq: 8
}

${methodBlockName} {
  url: address
  body: ws
  auth: basic
}

headers {
  @description('description')
  a: b
}

auth:basic {
  username: user
  password: pw
}

body:ws {
  name: message 1
  type: json
  content: '''
    {"a": "{{other}}"}
  '''
}

body:ws {
  name: message 2
  type: text
  selected: true
  content: '''
    plain text
  '''
}

settings {
  encodeUrl: false
  timeout: 55
  keepAliveInterval: 33
}

docs {
  **docs**
}
`;
}
