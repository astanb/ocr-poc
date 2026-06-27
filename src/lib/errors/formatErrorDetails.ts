export function formatErrorDetails(error: unknown, context = "Error"): string {
  const lines = [`${context}: ${getErrorMessage(error)}`];

  if (error instanceof Error && error.stack) {
    lines.push("", error.stack);
  }

  if (error instanceof Error && "cause" in error && error.cause) {
    lines.push("", formatErrorDetails(error.cause, "Cause"));
  }

  return lines.join("\n");
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Something went wrong.";
  }
}
