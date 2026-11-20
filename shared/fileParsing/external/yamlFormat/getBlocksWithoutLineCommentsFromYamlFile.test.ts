import { describe, it, expect } from "@jest/globals";
import { getBlocksWithoutLineCommentsFromYamlFile } from "./getBlocksWithoutLineCommentsFromYamlFile";

describe("getBlocksWithoutLineCommentsFromYamlFile", () => {
    it("returns the content lines of json, xml and html bodies, regardless of the field order", () => {
        const ranges = getBlocksWithoutLineCommentsFromYamlFile(
            `http:
  body:
    type: json
    data: |-
      {
        "a": 1
      }
examples:
  - name: e
    response:
      body:
        data: |
          <a/>
        type: xml
      other:
        type: html
        data: |2
            <b/>
`,
        );

        expect(toLines(ranges)).toEqual([
            [4, 6],
            [12, 12],
            [17, 17],
        ]);
    });

    it("returns graphql variables, grpc messages and html code of app sections", () => {
        const ranges = getBlocksWithoutLineCommentsFromYamlFile(
            `graphql:
  body:
    query: |
      query { a }
    variables: |
      {"a": 1}
grpc:
  message:
    - message: |
        {"b": 2}
app:
  code: |
    <p>hi</p>
`,
        );

        expect(toLines(ranges)).toEqual([
            [5, 5],
            [9, 9],
            [12, 12],
        ]);
    });

    it("returns the top-level code of app files", () => {
        const ranges = getBlocksWithoutLineCommentsFromYamlFile(
            `info:
  type: app
code: |
  <p>hi</p>
`,
        );

        expect(toLines(ranges)).toEqual([[3, 3]]);
    });

    it("returns markdown docs of request, folder and collection files", () => {
        expect(
            toLines(
                getBlocksWithoutLineCommentsFromYamlFile(
                    `info:
  name: request
docs: |-
  # Title
  text
`,
                ),
            ),
        ).toEqual([[3, 4]]);
        expect(
            toLines(
                getBlocksWithoutLineCommentsFromYamlFile(
                    `info:
  name: folder
docs:
  content: |
    # Title
`,
                ),
            ),
        ).toEqual([[4, 4]]);
    });

    it("ignores scripts, text bodies, non-block values and invalid files", () => {
        expect(
            getBlocksWithoutLineCommentsFromYamlFile(
                `runtime:
  scripts:
    - type: tests
      code: |
        test("x", () => {});
http:
  body:
    type: text
    data: |
      {"a": 1}
  other:
    type: json
    data: '{"a": 1}'
`,
            ),
        ).toEqual([]);
        expect(
            getBlocksWithoutLineCommentsFromYamlFile("a: [\n  b: |\n"),
        ).toEqual([]);
    });
});

function toLines(
    ranges: ReturnType<typeof getBlocksWithoutLineCommentsFromYamlFile>,
) {
    return ranges.map(({ start, end }) => [start.line, end.line]);
}
