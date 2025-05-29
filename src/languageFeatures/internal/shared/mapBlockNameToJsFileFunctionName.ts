import { RequestFileBlockName } from "../../../shared";

export function mapBlockNameToJsFileLine(name: RequestFileBlockName) {
    return `function ${name.replace(/-/g, "_").replace(/:/g, "_")}() {`;
}
