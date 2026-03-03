import { spawn } from "node:child_process";
import { logger } from "./logger.ts";

export interface ToolExecutionResult {
	success: boolean;
	message: string;
	error?: string;
}

export class ToolExecutor {
	private readonly BROWSER_ALLOWLIST = ["zen"];
	private readonly BROWSER_EXE_PATHS: Record<string, string> = {
		zen: "C:\\Program Files\\Zen Browser\\zen.exe",
	};
	async executeTool(
		toolName: string,
		args: Record<string, string>,
	): Promise<ToolExecutionResult> {
		console.log(
			"[DEBUG TOOL] executeTool called:",
			toolName,
			JSON.stringify(args),
		);
		try {
			switch (toolName) {
				case "open_url": {
					const url = args.url;
					if (!url) throw new Error("URL is required");
					console.log("[DEBUG TOOL] Opening URL:", url);
					return await this.openUrl(url);
				}
				case "search_web": {
					const query = args.query;
					if (!query) throw new Error("Query is required");
					console.log("[DEBUG TOOL] Searching web:", query);
					return await this.searchWeb(query);
				}
				case "open_browser": {
					const appName = args.app_name;
					if (!appName) throw new Error("App name is required");
					console.log("[DEBUG TOOL] Opening browser:", appName);

					// Check if app_name looks like a URL (LLM mistake handling)
					if (this.looksLikeUrl(appName)) {
						console.log(
							"[DEBUG TOOL] app_name looks like URL, redirecting to openUrl",
						);
						return await this.openUrl(appName);
					}

					return await this.openBrowser(appName);
				}
				default:
					console.log("[DEBUG TOOL] Unknown tool:", toolName);
					return {
						success: false,
						message: `Unknown tool: ${toolName}`,
						error: `Tool '${toolName}' is not implemented`,
					};
			}
		} catch (error) {
			console.log("[DEBUG TOOL] Error:", error);
			return {
				success: false,
				message: `Failed to execute ${toolName}`,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private looksLikeUrl(text: string): boolean {
		// Check if text looks like a URL (contains .com, .org, .net, etc. or starts with http)
		const urlPatterns = [
			/^https?:\/\//i,
			/\.(com|org|net|edu|gov|io|co|app|dev|ai)(\/|$)/i,
			/^[a-z0-9-]+\.[a-z]{2,}/i,
		];
		return urlPatterns.some((pattern) => pattern.test(text));
	}

	private async openUrl(url: string): Promise<ToolExecutionResult> {
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			url = `https://${url}`;
		}

		try {
			// Use Zen browser to open the URL
			const zenPath = this.BROWSER_EXE_PATHS.zen;
			if (!zenPath) {
				throw new Error("Zen browser path not configured");
			}
			const childProcess = spawn(zenPath, [url], {
				detached: true,
				stdio: "ignore",
			});
			childProcess.unref();
			return {
				success: true,
				message: `Opened URL: ${url}`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to open URL: ${url}`,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async searchWeb(query: string): Promise<ToolExecutionResult> {
		const encodedQuery = encodeURIComponent(query);
		const searchUrl = `https://www.google.com/search?q=${encodedQuery}`;

		// Reuse openUrl which opens the search in Zen browser
		return this.openUrl(searchUrl);
	}

	private async openBrowser(appName: string): Promise<ToolExecutionResult> {
		const normalizedName = appName.toLowerCase().trim();
		console.log("[DEBUG BROWSER] Checking allowlist for:", normalizedName);
		console.log("[DEBUG BROWSER] Allowlist:", this.BROWSER_ALLOWLIST);

		if (!this.BROWSER_ALLOWLIST.includes(normalizedName)) {
			logger.warning(
				`Security: Attempted to open non-allowed browser: ${appName}`,
			);
			console.log("[DEBUG BROWSER] BLOCKED - not in allowlist");
			return {
				success: false,
				message: `Only ${this.BROWSER_ALLOWLIST.join(", ")} browsers are allowed`,
				error: `Browser '${appName}' is not in the allowlist`,
			};
		}

		try {
			const exePath = this.BROWSER_EXE_PATHS[normalizedName];
			console.log("[DEBUG BROWSER] Executable path:", exePath);
			if (!exePath) {
				throw new Error(
					`Browser executable path not configured for: ${appName}`,
				);
			}

			// Spawn the browser process directly
			console.log("[DEBUG BROWSER] Spawning:", exePath);
			const childProcess = spawn(exePath, [], {
				detached: true,
				stdio: "ignore",
			});
			childProcess.unref();
			console.log("[DEBUG BROWSER] Spawn successful");

			return {
				success: true,
				message: `Opened browser: ${appName}`,
			};
		} catch (error) {
			console.log("[DEBUG BROWSER] Error spawning:", error);
			return {
				success: false,
				message: `Failed to open browser: ${appName}`,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
