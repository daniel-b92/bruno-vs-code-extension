import { access, constants } from "fs";

export function checkIfFileExistsAsync(path: string) {
    return new Promise<boolean>((resolve) =>
        access(path, constants.R_OK, (err) => {
            resolve(!err);
        })
    );
}
