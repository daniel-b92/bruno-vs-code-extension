import { RequestFileBlockName } from "../../../shared";

export function mapBlockNameToJsFileLine(name: RequestFileBlockName) {
    return `function ${name.replace("-", "_").replace(":", "_")}() {`;
}
