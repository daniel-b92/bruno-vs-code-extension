import { readFileSync } from "fs";

type JsonReportData = {
    results: {
        test: {
            filename: string;
        };
        testResults: { status: "pass" | "fail" }[];
    }[];
}[];

export const getTestFilesWithFailures = (
    jsonReportPath: string
) => {
    const reportData = JSON.parse(
        readFileSync(jsonReportPath).toString()
    ) as JsonReportData;
    const resultsWithFailures = reportData[0].results.filter(
        (result) => result.testResults.some((testResult) => testResult.status == "fail")
    );

    return resultsWithFailures.map((res) => res.test.filename);
};
