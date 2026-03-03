import { tool } from "langchain";
import * as z from "zod";
import { ToolExecutor } from "./tool-executor";

const toolExecutor = new ToolExecutor();

export const openUrl = tool(
	async ({ url }: { url: string }) => {
		const result = await toolExecutor.executeTool("open_url", { url });
		return result.success ? result.message : `Error: ${result.error}`;
	},
	{
		name: "open_url",
		description:
			"Open a specific URL in the browser. The URL should include the protocol (https:// or http://).",
		schema: z.object({
			url: z.string().describe("The complete URL to open (include https://)"),
		}),
	},
);

export const searchWeb = tool(
	async ({ query }: { query: string }) => {
		const result = await toolExecutor.executeTool("search_web", { query });
		return result.success ? result.message : `Error: ${result.error}`;
	},
	{
		name: "search_web",
		description:
			"Search the web and open results in the browser. Use this when the user wants to find information about a topic.",
		schema: z.object({
			query: z.string().describe("The search query to look for"),
		}),
	},
);

export const openBrowser = tool(
	async ({ app_name }: { app_name: string }) => {
		const result = await toolExecutor.executeTool("open_browser", { app_name });
		return result.success ? result.message : `Error: ${result.error}`;
	},
	{
		name: "open_browser",
		description:
			"Open the Zen web browser application. Use this ONLY when the user explicitly says 'open Zen browser' or 'launch the browser'. Do NOT use this for opening websites - use open_url instead.",
		schema: z.object({
			app_name: z
				.string()
				.describe(
					"The name of the browser to open. Currently only 'zen' is supported.",
				),
		}),
	},
);

export const browserTools = [openUrl, searchWeb, openBrowser];
