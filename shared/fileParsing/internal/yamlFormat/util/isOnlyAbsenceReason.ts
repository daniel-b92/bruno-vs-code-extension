import { OrAbsenceReason, ReasonForFieldAbsence } from "../../../..";

export function isOnlyAbsenceReason<T>(
    result: OrAbsenceReason<T>,
): result is { reason: ReasonForFieldAbsence } {
    return (
        typeof result == "object" &&
        result != null &&
        "reason" in result &&
        Object.values(ReasonForFieldAbsence).includes(result.reason)
    );
}
