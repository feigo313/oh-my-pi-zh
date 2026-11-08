/**
 * i18n 拦截层
 *
 * 在 UI 渲染边界拦截数据，统一注入翻译。
 * 源码保持纯英文，翻译在数据输出时集中处理。
 *
 * Settings/welcome/overlay 的拦截自 v18 起由 packages/tui 的 i18n-host
 * seam 承担（tui 包无法反向依赖本包）；本文件只保留 coding-agent 侧的
 * slash 命令拦截。
 */

import { i18n } from "./index";

// ═══════════════════════════════════════════════════════════════════════════
// Slash Commands 拦截
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Palette text for one slash command. The key is derived from the command name, so
 * the upstream English literal stays the fallback for any command we have not
 * filled; callers resolve this at read time because `/settings` can switch language
 * without rebuilding the command registry.
 */
export function slashCommandDescription(name: string, english: string): string {
	return i18n.t(`commands.${name}.description`, english);
}

/** Palette text for one subcommand, keyed under its parent command. */
export function subcommandDescription(commandName: string, subName: string, english: string): string {
	return i18n.t(`commands.${commandName}.subcommands.${subName}.description`, english);
}
