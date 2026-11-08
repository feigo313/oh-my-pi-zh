import { type } from "@oh-my-pi/omptype";
import { sanitizeText } from "@oh-my-pi/pi-utils";
import { t } from "../i18n";
import {
	replaceTabs,
	shortenEmbeddedPaths,
	shortenPath,
	TRUNCATE_LENGTHS,
	truncateToWidth,
} from "@oh-my-pi/pi-tui/render/render-utils";

export const MCP_CONNECTION_STATUS_EVENT_CHANNEL = "mcp:connection-status";

export type McpConnectionFailure = {
	serverName: string;
	error: string;
	sourcePath?: string;
};

export type McpConnectionStatusEvent =
	| { type: "connecting"; serverNames: string[] }
	| { type: "reconnecting"; serverName: string }
	| { type: "connected"; serverName: string }
	| ({ type: "failed" } & McpConnectionFailure);

export type McpConnectionStatusSnapshot = {
	pendingServers: readonly string[];
	connectedServers: readonly string[];
	failedServers: readonly McpConnectionFailure[];
};

function sanitizeMcpStatusText(value: string, maxWidth: number): string {
	const text = shortenEmbeddedPaths(
		replaceTabs(sanitizeText(value))
			.replace(/[\r\n]+/g, " ")
			.trim(),
	);
	return truncateToWidth(text.length > 0 ? text : "(unnamed)", maxWidth);
}

function sanitizeMcpServerName(serverName: string): string {
	return sanitizeMcpStatusText(serverName, TRUNCATE_LENGTHS.SHORT);
}

function formatServerList(serverNames: readonly string[]): string {
	return serverNames.map(sanitizeMcpServerName).join(", ");
}

function sanitizeMcpStatusError(error: string): string {
	return sanitizeMcpStatusText(error, TRUNCATE_LENGTHS.CONTENT);
}

export function formatMCPConnectingMessage(serverNames: readonly string[]): string {
	return t("cli.mcp.connectingServers", "Connecting to MCP servers: {list}…", { list: formatServerList(serverNames) });
}

function formatFailedServer({ serverName, error, sourcePath }: McpConnectionFailure): string {
	const source = sourcePath
		? ` [config: ${sanitizeMcpStatusText(shortenPath(sourcePath), TRUNCATE_LENGTHS.CONTENT)}]`
		: "";
	return `${sanitizeMcpServerName(serverName)}${source}: ${sanitizeMcpStatusError(error)}`;
}

export function formatMCPConnectionStatusMessage(snapshot: McpConnectionStatusSnapshot): string {
	const { pendingServers, connectedServers, failedServers } = snapshot;
	if (pendingServers.length > 0) {
		if (connectedServers.length === 0 && failedServers.length === 0) {
			return formatMCPConnectingMessage(pendingServers);
		}
		const parts: string[] = [];
		if (connectedServers.length > 0) {
			parts.push(t("cli.mcp.connectedList", "Connected: {list}.", { list: formatServerList(connectedServers) }));
		}
		if (failedServers.length > 0) {
			parts.push(
				t("cli.mcp.failedList", "Failed: {list}.", { list: failedServers.map(formatFailedServer).join("; ") }),
			);
		}
		parts.push(t("cli.mcp.stillConnecting", "Still connecting: {list}…", { list: formatServerList(pendingServers) }));
		return parts.join(" ");
	}
	if (failedServers.length > 0) {
		const failureText = failedServers.map(formatFailedServer).join("; ");
		if (connectedServers.length === 0) {
			return failedServers.length === 1
				? t("cli.mcp.failedToConnectOne", "MCP {count} server failed to connect: {detail}", {
						count: failedServers.length,
						detail: failureText,
					})
				: t("cli.mcp.failedToConnect", "MCP {count} servers failed to connect: {detail}", {
						count: failedServers.length,
						detail: failureText,
					});
		}
		return t("cli.mcp.finishedWithFailures", "MCP finished with failures. Connected: {ok}. Failed: {bad}", {
			ok: formatServerList(connectedServers),
			bad: failureText,
		});
	}
	if (connectedServers.length > 0) {
		return connectedServers.length === 1
			? t("cli.mcp.connectedToServerOne", "Connected to MCP {count} server: {list}.", {
					count: connectedServers.length,
					list: formatServerList(connectedServers),
				})
			: t("cli.mcp.connectedToServers", "Connected to MCP {count} servers: {list}.", {
					count: connectedServers.length,
					list: formatServerList(connectedServers),
				});
	}
	return "";
}

const McpConnectionStatusEventShape = type({ type: "'connecting'", serverNames: "string[]" })
	.or({ type: "'reconnecting' | 'connected'", serverName: "string" })
	.or({ type: "'failed'", serverName: "string", error: "string", "sourcePath?": "string | undefined" });

/**
 * Runtime validator for the cross-module event payload. The event bus is
 * untyped at runtime, so the subscriber verifies the shape before formatting
 * rather than trusting a cast — a malformed emit is ignored instead of throwing.
 */
export function isMcpConnectionStatusEvent(data: unknown): data is McpConnectionStatusEvent {
	return McpConnectionStatusEventShape.allows(data);
}
