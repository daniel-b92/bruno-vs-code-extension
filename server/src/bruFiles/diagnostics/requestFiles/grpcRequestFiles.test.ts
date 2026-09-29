import { describe, it, expect } from "@jest/globals";
import {
    BrunoFileType,
    getPossibleMethodBlocksForRequestType,
    isBlockCodeBlock,
    isBlockDictionaryBlock,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import { checkGrpcSpecificBlocksAreNotDefinedForOtherRequests } from "./checks/multipleBlocks/checkGrpcSpecificBlocksAreNotDefinedForOtherRequests";
import { checkMethodBlockMatchesRequestType } from "./checks/multipleBlocks/checkMethodBlockMatchesRequestType";
import { checkOnlyValidBlocksAreDefinedForGrpcRequests } from "./checks/multipleBlocks/checkOnlyValidBlocksAreDefinedForGrpcRequests";
import { getGrpcBodyBlockSpecificDiagnostics } from "./getGrpcBodyBlockSpecificDiagnostics";
import { NonBlockSpecificDiagnosticCode } from "../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { RelevantWithinGrpcBodyBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinGrpcBodyBlockDiagnosticCodeEnum";

const filePath = "/collection/grpc_example.bru";

describe("gRPC request files", () => {
    it("parses all gRPC specific blocks with the expected block types", () => {
        const blocks = parseBlocks(getGrpcFileContent("grpc", "grpc"));

        const byName = (name: string) => blocks.find((b) => b.name == name);

        for (const name of [
            RequestFileBlockName.Grpc,
            RequestFileBlockName.Metadata,
            RequestFileBlockName.GrpcBody,
        ]) {
            const block = byName(name);
            expect(block && isBlockDictionaryBlock(block)).toBe(true);
        }
        for (const name of [
            RequestFileBlockName.GrpcBeforeCallStartScript,
            RequestFileBlockName.GrpcBeforeMessageSendScript,
            RequestFileBlockName.GrpcAfterMessageReceiveScript,
            RequestFileBlockName.GrpcAfterCallEndScript,
        ]) {
            const block = byName(name);
            expect(block && isBlockCodeBlock(block)).toBe(true);
        }
    });

    it("finds variable references in the multiline content of the gRPC body block", () => {
        const bodyBlock = parseBlocks(getGrpcFileContent("grpc", "grpc")).find(
            ({ name }) => name == RequestFileBlockName.GrpcBody,
        );

        expect(
            bodyBlock?.variableReferences?.map(
                ({ variableName }) => variableName,
            ),
        ).toEqual(["other"]);
    });

    describe("getPossibleMethodBlocksForRequestType", () => {
        it("only allows the grpc block for gRPC requests", () => {
            expect(getPossibleMethodBlocksForRequestType("grpc")).toEqual([
                RequestFileBlockName.Grpc,
            ]);
        });

        it("does not allow the grpc block for other requests", () => {
            const result = getPossibleMethodBlocksForRequestType("http");

            expect(result).toContain(RequestFileBlockName.Get);
            expect(result).not.toContain(RequestFileBlockName.Grpc);
        });

        it("allows all blocks if the request type is unknown", () => {
            expect(getPossibleMethodBlocksForRequestType(undefined)).toContain(
                RequestFileBlockName.Grpc,
            );
            expect(getPossibleMethodBlocksForRequestType(undefined)).toContain(
                RequestFileBlockName.Get,
            );
        });
    });

    describe("checkGrpcSpecificBlocksAreNotDefinedForOtherRequests", () => {
        it("reports no problem for gRPC requests", () => {
            expect(
                checkGrpcSpecificBlocksAreNotDefinedForOtherRequests(
                    filePath,
                    parseBlocks(getGrpcFileContent("grpc", "grpc")),
                ),
            ).toBeUndefined();
        });

        it("reports all gRPC specific blocks for other request types", () => {
            const result = checkGrpcSpecificBlocksAreNotDefinedForOtherRequests(
                filePath,
                parseBlocks(getGrpcFileContent("http", "get")),
            );

            expect(result?.code).toBe(
                NonBlockSpecificDiagnosticCode.GrpcBlocksDefinedForNonGrpcRequestType,
            );
            // metadata, body:grpc and 4 scripts
            expect(result?.relatedInformation).toHaveLength(6);
        });
    });

    describe("checkMethodBlockMatchesRequestType", () => {
        it("reports no problem for the grpc block in gRPC requests", () => {
            expect(
                checkMethodBlockMatchesRequestType(
                    filePath,
                    parseBlocks(getGrpcFileContent("grpc", "grpc")),
                ),
            ).toBeUndefined();
        });

        it("reports HTTP method blocks in gRPC requests", () => {
            expect(
                checkMethodBlockMatchesRequestType(
                    filePath,
                    parseBlocks(getGrpcFileContent("grpc", "post")),
                )?.code,
            ).toBe(
                NonBlockSpecificDiagnosticCode.MethodBlockNotMatchingRequestType,
            );
        });

        it("does not report anything for other request types", () => {
            expect(
                checkMethodBlockMatchesRequestType(
                    filePath,
                    parseBlocks(getGrpcFileContent("http", "get")),
                ),
            ).toBeUndefined();
        });
    });

    describe("checkOnlyValidBlocksAreDefinedForGrpcRequests", () => {
        it("reports no problem for a valid gRPC request", () => {
            expect(
                checkOnlyValidBlocksAreDefinedForGrpcRequests(
                    parseBlocks(getGrpcFileContent("grpc", "grpc")),
                ),
            ).toEqual([]);
        });

        it("reports blocks that are not valid for gRPC requests", () => {
            const content = `${getGrpcFileContent("grpc", "grpc")}
headers {
  a: b
}

body:json {
  {}
}
`;

            const result = checkOnlyValidBlocksAreDefinedForGrpcRequests(
                parseBlocks(content),
            );

            expect(result.map(({ code }) => code)).toEqual([
                NonBlockSpecificDiagnosticCode.BlockNotValidForGrpcRequestType,
                NonBlockSpecificDiagnosticCode.BlockNotValidForGrpcRequestType,
            ]);
        });

        it("does not report anything for other request types", () => {
            expect(
                checkOnlyValidBlocksAreDefinedForGrpcRequests(
                    parseBlocks(`${getGrpcFileContent("http", "get")}
headers {
  a: b
}
`),
                ),
            ).toEqual([]);
        });
    });

    describe("getGrpcBodyBlockSpecificDiagnostics", () => {
        const getBodyBlock = (content: string) =>
            parseBlocks(content).find(
                ({ name }) => name == RequestFileBlockName.GrpcBody,
            )!;

        it("reports no problem for a valid body block", () => {
            expect(
                getGrpcBodyBlockSpecificDiagnostics(
                    filePath,
                    getBodyBlock(getGrpcFileContent("grpc", "grpc")),
                ).filter((val) => val != undefined),
            ).toEqual([]);
        });

        it("reports missing and unknown keys", () => {
            const codes = getGrpcBodyBlockSpecificDiagnostics(
                filePath,
                getBodyBlock(`body:grpc {
  name: message 1
  other: value
}
`),
            )
                .filter((val) => val != undefined)
                .map(({ code }) => code);

            expect(codes).toEqual(
                expect.arrayContaining([
                    RelevantWithinGrpcBodyBlockDiagnosticCode.KeysMissingInGrpcBodyBlock,
                    RelevantWithinGrpcBodyBlockDiagnosticCode.UnknownKeysDefinedInGrpcBodyBlock,
                ]),
            );
        });
    });
});

function getGrpcFileContent(type: string, methodBlockName: string) {
    return `meta {
  name: grpc_example
  type: ${type}
  seq: 7
}

${methodBlockName} {
  url: address/{{other}}
  body: grpc
  auth: basic
}

metadata {
  @description('description')
  sd: sd
}

auth:basic {
  username: user
  password: pw
}

body:grpc {
  name: message 1
  content: '''
    {{other}}
  '''
}

script:grpc:before-call-start {
  first
}

script:grpc:before-message-send {
  second
}

script:grpc:after-message-receive {
  third
}

script:grpc:after-call-end {
  fourth
}

docs {
  **docs**
}
`;
}

function parseBlocks(content: string) {
    return parseBruFile(
        new TextDocumentHelper(content),
        BrunoFileType.RequestFile,
    ).blocks;
}
