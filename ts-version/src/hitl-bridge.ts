import { ConfirmationDialog } from "./confirmation-dialog";

interface ToolRequest {
	name: string;
	args: Record<string, unknown>;
	description?: string;
}

const confirmationDialog = new ConfirmationDialog();

export async function showKoffiPopup(
	toolRequest: ToolRequest,
	timeoutSeconds = 10,
): Promise<"approve" | "reject"> {
	const decision = await confirmationDialog.requestConfirmation({
		toolName: toolRequest.name,
		args: toolRequest.args as Record<string, string>,
		timeoutSeconds,
	});

	if (decision === "allowed") {
		return "approve";
	}
	return "reject";
}
