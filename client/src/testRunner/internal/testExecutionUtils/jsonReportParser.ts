import { existsSync, readFileSync } from "fs";

type JsonReportData = {
    results: {
        test: {
            filename: string;
        };
        request: unknown;
        response: unknown;
        error?: string;
        testResults: { status: "pass" | "fail" }[];
        assertionResults: { status: "pass" | "fail"; error?: string }[];
    }[];
}[];

export const getTestFilesWithFailures = (jsonReportPath: string) => {
    if (!existsSync(jsonReportPath)) {
        return [];
    }

    const reportData = JSON.parse(
        readFileSync(jsonReportPath).toString(),
    ) as JsonReportData;

    const resultsWithFailures = reportData[0].results.filter(
        (result) =>
            result.testResults.some(
                (testResult) => testResult.status == "fail",
            ) ||
            result.assertionResults.some(
                (result) =>
                    result.status == "fail" || result.error != undefined,
            ) ||
            result.error != undefined,
    );

    return resultsWithFailures.map((res) => ({
        file: res.test.filename,
        testResults: res.testResults,
        assertionResults: res.assertionResults,
        error: res.error,
        request: res.request,
        response: res.response,
    }));
};
