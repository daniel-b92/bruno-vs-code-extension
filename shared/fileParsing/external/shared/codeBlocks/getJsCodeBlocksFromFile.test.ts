import { describe, it, expect } from "@jest/globals";
import {
    BlockRuntimeExecutionGroup,
    BrunoFileType,
    CollectionFormat,
    RequestType,
} from "../../../..";
import { getJsCodeBlocksFromFile } from "./getJsCodeBlocksFromFile";

describe("getJsCodeBlocksFromFile", () => {
    it("maps code blocks and request type for Bru files", () => {
        const { requestType, blocks } = getJsCodeBlocksFromFile(
            `meta {
  name: test
  type: grpc
}

script:grpc:before-call-start {
  bru.setVar("a", 1);
}
`,
            BrunoFileType.RequestFile,
            CollectionFormat.Bru,
        );

        expect(requestType).toBe(RequestType.Grpc);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatchObject({
            name: "script:grpc:before-call-start",
            executionGroup: BlockRuntimeExecutionGroup.PreRequest,
            isTestsBlock: false,
        });
    });

    it("maps script types to execution groups for Yaml files", () => {
        const { requestType, blocks } = getJsCodeBlocksFromFile(
            `info:
  name: test
  type: websocket
runtime:
  scripts:
    - type: before-request
      code: |-
        a();
    - type: after-response
      code: |-
        b();
    - type: tests
      code: |-
        c();
`,
            BrunoFileType.RequestFile,
            CollectionFormat.Yaml,
        );

        expect(requestType).toBe(RequestType.Ws);
        expect(
            blocks.map(({ executionGroup, isTestsBlock }) => [
                executionGroup,
                isTestsBlock,
            ]),
        ).toEqual([
            [BlockRuntimeExecutionGroup.PreRequest, false],
            [BlockRuntimeExecutionGroup.PostResponse, false],
            [BlockRuntimeExecutionGroup.PostResponse, true],
        ]);
    });
});
