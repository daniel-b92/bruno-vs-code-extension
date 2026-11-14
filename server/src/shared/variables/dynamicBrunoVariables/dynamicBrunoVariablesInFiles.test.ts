import { describe, expect, it } from "@jest/globals";
import {
    BrunoRequestFile,
    CollectionFormat,
    Position,
    Range,
} from "@global_shared";
import { getHoverText } from "@global_shared/_testingUtils";
import {
    CURSOR,
    requestCompletions,
    requestHover,
    toTestFile,
} from "../../_testingUtils/languageRequestTestUtils";

describe.each([[CollectionFormat.Bru], [CollectionFormat.Yaml]])(
    "dynamic Bruno variables in files of the %s format",
    (format) => {
        it("suggests the dynamic variables when `{{$` is typed", async () => {
            const result = await requestCompletions(
                format,
                requestWithUrl(
                    format,
                    `https://api.example.com/{{$ra${CURSOR}`,
                ),
            );

            const randomInt = result?.find(
                ({ label }) => label == "$randomInt",
            );
            expect(randomInt?.labelDetails?.description).toBe(
                "A random integer between 0 and 1000",
            );
        });

        it("does not suggest the dynamic variables when only `{{` is typed", async () => {
            const result = await requestCompletions(
                format,
                requestWithUrl(format, `https://api.example.com/{{${CURSOR}`),
            );

            expect(
                (result ?? []).filter(({ label }) => label.startsWith("$")),
            ).toEqual([]);
        });

        it("shows the description and the example for a dynamic variable in the url", () => {
            const result = requestHover(
                format,
                requestWithUrl(
                    format,
                    `https://api.example.com/{{$gu${CURSOR}id}}`,
                ),
            );

            expect(getHoverText(result)).toBe(
                "A random UUID. Example: `550e8400-e29b-41d4-a716-446655440000`",
            );
        });

        it("shows all examples for a dynamic variable with multiple examples", () => {
            const result = requestHover(
                format,
                requestWithUrl(
                    format,
                    `https://api.example.com/{{$ran${CURSOR}domInt}}`,
                ),
            );

            expect(getHoverText(result)).toBe(
                "A random integer between 0 and 1000. Examples: `802`, `494`, `200`",
            );
        });

        it("shows no hover for an unknown name starting with `$`", () => {
            const result = requestHover(
                format,
                requestWithUrl(
                    format,
                    `https://api.example.com/{{$gu${CURSOR}ids}}`,
                ),
            );

            expect(result).toBeUndefined();
        });
    },
);

describe("dynamic Bruno variables in yaml files", () => {
    it("replaces the typed name inside a quoted value", async () => {
        const result = await requestCompletions(
            CollectionFormat.Yaml,
            requestWithUrl(CollectionFormat.Yaml, `"{{$ra${CURSOR}"`),
        );

        const item = result?.find(({ label }) => label == "$randomEmail");
        expect(item?.textEdit).toEqual({
            newText: "$randomEmail}}",
            range: new Range(new Position(2, 10), new Position(2, 13)),
        });
    });

    it("wraps the value in quotes when `{{$` starts an unquoted value", async () => {
        const result = await requestCompletions(
            CollectionFormat.Yaml,
            requestWithUrl(CollectionFormat.Yaml, `{{$gu${CURSOR}`),
        );

        const item = result?.find(({ label }) => label == "$guid");
        expect(item?.filterText).toBe("{{$guid");
        expect(item?.textEdit).toEqual({
            newText: `"{{$guid}}"`,
            range: new Range(new Position(2, 7), new Position(2, 12)),
        });
    });
});

function requestWithUrl(format: CollectionFormat, url: string) {
    return format == CollectionFormat.Bru
        ? toTestFile({
              item: new BrunoRequestFile("/collection/request.bru"),
              content: `get {\n  url: ${url}\n}\n`,
          })
        : toTestFile({
              item: new BrunoRequestFile("/collection/request.yml"),
              content: `http:\n  method: GET\n  url: ${url}\n`,
          });
}
