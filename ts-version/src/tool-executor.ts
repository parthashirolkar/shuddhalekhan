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
		try {
			switch (toolName) {
				case "open_url": {
					const url = args.url;
					if (!url) throw new Error("URL is required");
					return await this.openUrl(url);
				}
				case "search_web": {
					const query = args.query;
					if (!query) throw new Error("Query is required");
					return await this.searchWeb(query);
				}
				case "open_browser": {
					const appName = args.app_name;
					if (!appName) throw new Error("App name is required");

					if (this.looksLikeUrl(appName)) {
						return await this.openUrl(appName);
					}

					return await this.openBrowser(appName);
				}
				default:
					return {
						success: false,
						message: `Unknown tool: ${toolName}`,
						error: `Tool '${toolName}' is not implemented`,
					};
			}
		} catch (error) {
			logger.error(
				`Tool execution failed: ${toolName} - ${error instanceof Error ? error.message : String(error)}`,
			);
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
		let finalUrl = url;
		if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
			finalUrl = `https://${finalUrl}`;
		}

		try {
			const zenPath = this.BROWSER_EXE_PATHS.zen;
			if (!zenPath) {
				throw new Error("Zen browser path not configured");
			}
			const childProcess = spawn(zenPath, [finalUrl], {
				detached: true,
				stdio: "ignore",
			});
			childProcess.unref();
			return {
				success: true,
				message: `Opened URL: ${finalUrl}`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to open URL: ${finalUrl}`,
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

		if (!this.BROWSER_ALLOWLIST.includes(normalizedName)) {
			logger.warning(
				`Security: Attempted to open non-allowed browser: ${appName}`,
			);
			return {
				success: false,
				message: `Only ${this.BROWSER_ALLOWLIST.join(", ")} browsers are allowed`,
				error: `Browser '${appName}' is not in the allowlist`,
			};
		}

		try {
			const exePath = this.BROWSER_EXE_PATHS[normalizedName];
			if (!exePath) {
				throw new Error(
					`Browser executable path not configured for: ${appName}`,
				);
			}

			const childProcess = spawn(exePath, [], {
				detached: true,
				stdio: "ignore",
			});
			childProcess.unref();

			return {
				success: true,
				message: `Opened browser: ${appName}`,
			};
		} catch (error) {
			logger.error(
				`Failed to spawn browser process: ${appName} - ${error instanceof Error ? error.message : String(error)}`,
			);
			return {
				success: false,
				message: `Failed to open browser: ${appName}`,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
