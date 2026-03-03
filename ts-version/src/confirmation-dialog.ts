import koffi from "koffi";

export interface ConfirmationOptions {
	toolName: string;
	args: Record<string, string>;
	timeoutSeconds: number;
}

export type ConfirmationResult = "allowed" | "denied" | "timeout";

// Load user32.dll for native Windows UI
const user32 = koffi.load("user32.dll");

// int MessageBoxTimeoutW(HWND hWnd, LPCWSTR lpText, LPCWSTR lpCaption, UINT uType, WORD wLanguageId, DWORD dwMilliseconds);
const MessageBoxTimeoutW = user32.func(
	"int __stdcall MessageBoxTimeoutW(void* hWnd, const char16_t* lpText, const char16_t* lpCaption, uint32_t uType, uint16_t wLanguageId, uint32_t dwMilliseconds)",
);

// MessageBox flags
const MB_YESNO = 0x00000004;
const MB_OK = 0x00000000;
const MB_ICONINFORMATION = 0x00000040;
const MB_ICONQUESTION = 0x00000020;
const MB_SYSTEMMODAL = 0x00001000;
const MB_SETFOREGROUND = 0x00010000;
const MB_TOPMOST = 0x00040000;

// MessageBox return codes
const IDYES = 6;
const IDNO = 7;
const IDTIMEOUT = 32000;

export class ConfirmationDialog {
	async requestConfirmation(
		options: ConfirmationOptions,
	): Promise<ConfirmationResult> {
		console.log("[DEBUG CONFIRM] requestConfirmation called");
		const argsString = this.formatArgs(options.args);
		const message = `Execute: ${options.toolName}(${argsString})?\n\n(This dialog will auto-close and timeout in ${options.timeoutSeconds} seconds)`;
		console.log("[DEBUG CONFIRM] Message:", message);

		return new Promise((resolve) => {
			console.log("[DEBUG CONFIRM] Showing native Windows dialog...");

			// Call the native MessageBoxTimeoutW asynchronously
			MessageBoxTimeoutW.async(
				null,
				message,
				"Shuddhlekhan - Agent Action Required",
				MB_YESNO |
					MB_ICONQUESTION |
					MB_TOPMOST |
					MB_SETFOREGROUND |
					MB_SYSTEMMODAL,
				0,
				options.timeoutSeconds * 1000,
				(err: any, result: number) => {
					console.log(
						"[DEBUG CONFIRM] Native dialog closed. Result code:",
						result,
					);
					if (err) {
						console.error(
							"[DEBUG CONFIRM] Error calling MessageBoxTimeoutW:",
							err,
						);
						resolve("timeout");
						return;
					}

					switch (result) {
						case IDYES:
							console.log("[DEBUG CONFIRM] Resolved to: allowed");
							resolve("allowed");
							break;
						case IDNO:
							console.log("[DEBUG CONFIRM] Resolved to: denied");
							resolve("denied");
							break;
						default:
							console.log("[DEBUG CONFIRM] Resolved to: timeout");
							resolve("timeout");
							break;
					}
				},
			);
		});
	}

	private formatArgs(args: Record<string, string>): string {
		const entries = Object.entries(args);
		if (entries.length === 0) return "";
		return entries.map(([key, value]) => `${key}="${value}"`).join(", ");
	}

	showResponse(message: string): void {
		console.log("[DEBUG RESPONSE] showResponse called");
		console.log("[DEBUG RESPONSE] Message:", message);

		// Call the native MessageBoxTimeoutW synchronously for OK dialog (no timeout needed)
		MessageBoxTimeoutW(
			null,
			message,
			"Shuddhlekhan - Agent Response",
			MB_OK |
				MB_ICONINFORMATION |
				MB_TOPMOST |
				MB_SETFOREGROUND |
				MB_SYSTEMMODAL,
			0,
			0,
		);
		console.log("[DEBUG RESPONSE] Dialog closed");
	}
}
