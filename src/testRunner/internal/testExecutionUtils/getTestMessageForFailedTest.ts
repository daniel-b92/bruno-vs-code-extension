import { TestMessage } from "vscode";

export function getTestMessageForFailedTest(
    testResultData: {
        testResults: Record<string, string | number | object>[];
        assertionResults: Record<string, string | number | object>[];
        request: Record<string, string | number | object>;
        response: Record<string, string | number | object>;
        error?: string;
    },
    lineBreakForRunOutput: string,
) {
    const { assertionResults, request, response, testResults, error } =
        testResultData;

    const stringifyField = (
        reportField: Record<string, string | number | object>,
    ) =>
        Object.keys(reportField)
            .map((key) =>
                typeof reportField[key] == "string"
                    ? `${key}: ${reportField[key].replace(/\n/g, lineBreakForRunOutput)}`
                    : `${key}: ${JSON.stringify(
                          reportField[key],
                          null,
                          2,
                      ).replace(/\n/g, lineBreakForRunOutput)}`,
            )
            .join(lineBreakForRunOutput);

    const formattedRequest = stringifyField(request);
    const formattedResponse = stringifyField(response);
    const formattedTestResults = testResults
        .map((result) => stringifyField(result))
        .join(lineBreakForRunOutput);
    const formattedAssertionResults = assertionResults
        .map((result) => stringifyField(result))
        .join(lineBreakForRunOutput);
    const dividerAndLinebreak = `---------------------------------------------${lineBreakForRunOutput}`;

    return new TestMessage(
        (testResults.length > 0
            ? `${dividerAndLinebreak}testResults:${lineBreakForRunOutput}${formattedTestResults}${lineBreakForRunOutput}${dividerAndLinebreak}`
            : ""
        ).concat(
            assertionResults.length > 0
                ? `assertionResults:${lineBreakForRunOutput}${formattedAssertionResults}${lineBreakForRunOutput}${dividerAndLinebreak}`
                : "",
            error
                ? `error: ${error}${lineBreakForRunOutput}${dividerAndLinebreak}`
                : "",
            `request:${lineBreakForRunOutput}${formattedRequest}${lineBreakForRunOutput}${dividerAndLinebreak}`,
            `response:${lineBreakForRunOutput}${formattedResponse}${lineBreakForRunOutput}${dividerAndLinebreak}`,
        ),
    );
}
