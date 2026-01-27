export function mapBlockNameToJsFileLine(name: string) {
    return `function ${name.replace(/-/g, "_").replace(/:/g, "_")}() {`;
}
