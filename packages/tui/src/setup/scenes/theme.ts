import { padding, visibleWidth } from "../../utils";
import { padToWidth } from "../../render/utils";
import { type SgrMouseEvent } from "../../mouse";
import { type SelectItem, SelectList } from "../../components/select-list";
import { Text } from "../../components/text";
import { WizardStep } from "../../components/wizard-step";
import { Container } from "../../tui";
import { editorKey } from "../../chrome/keybinding-hints";
import {
	enableAutoTheme,
	getAvailableThemes,
	getCurrentThemeName,
	getSelectListTheme,
	isLightTheme,
	previewTheme,
	type SymbolPreset,
	setColorBlindMode,
	setSymbolPreset,
	theme,
} from "../../theme/theme";
import { col, node, span, text } from "../../native/describe";
import type { NativeChild, NativeNode } from "../../native/node";
import { Memo } from "../../native/memo";
import type { SetupScene, SetupSceneController, SetupSceneHost } from "./types";
import { tuiT } from "../../i18n-host";

type ThemeMode = "curated" | "all";

function curatedItems(): readonly SelectItem[] {
	return [
		{
			value: "auto",
			label: tuiT("ui.setupTheme.matchTerminal", "Match terminal"),
			description: tuiT("ui.setupTheme.matchTerminalDesc", "Titanium in dark terminals, Light in light terminals"),
		},
		{
			value: "theme:titanium",
			label: "Titanium",
			description: tuiT("ui.setupTheme.titaniumDesc", "Default dark theme"),
		},
		{ value: "theme:light", label: "Light", description: tuiT("ui.setupTheme.lightDesc", "Default light theme") },
		{
			value: "colorblind",
			label: tuiT("ui.setupTheme.colorblind", "Colorblind colors"),
			description: tuiT("ui.setupTheme.colorblindDesc", "Adjust red/green contrast"),
		},
		{
			value: "ansi",
			label: tuiT("ui.setupTheme.ansiSafe", "ANSI-safe"),
			description: tuiT("ui.setupTheme.ansiSafeDesc", "ASCII glyphs with the dark terminal theme"),
		},
		{
			value: "browse",
			label: tuiT("ui.setupTheme.browseAll", "Browse all…"),
			description: tuiT("ui.setupTheme.browseAllDesc", "Show every built-in and custom theme"),
		},
	];
}

function fillStyledLine(content: string, width: number): string {
	return content + padding(Math.max(0, width - visibleWidth(content)));
}

function renderMockStatusLine(width: number): string {
	const sep = theme.fg("statusLineSep", ` ${theme.sep.pipe} `);
	const left = [
		theme.fg("statusLineModel", `${theme.icon.model} sonnet`),
		theme.fg("statusLinePath", "~/project"),
		theme.fg("statusLineGitDirty", `${theme.icon.git} main +2`),
	].join(sep);
	const right = [
		theme.fg("statusLineContext", `${theme.icon.context} 42%`),
		theme.fg("statusLineCost", `${theme.icon.cost} 0.18`),
	].join(sep);
	const innerWidth = Math.max(1, width - 2);
	const leftWidth = visibleWidth(left);
	const rightWidth = visibleWidth(right);
	const gap = padding(Math.max(1, innerWidth - leftWidth - rightWidth - 2));
	return theme.bg("statusLineBg", width > 0 ? padToWidth(` ${left}${gap}${right} `, width) : "");
}

function renderMockEditor(width: number): string[] {
	const box = theme.boxRound;
	const innerWidth = Math.max(1, width - 2);
	const horizontal = box.horizontal.repeat(innerWidth);
	const top = theme.fg("borderAccent", `${box.topLeft}${horizontal}${box.topRight}`);
	const bottom = theme.fg("borderMuted", `${box.bottomLeft}${horizontal}${box.bottomRight}`);
	const prompt = `${theme.fg("accent", ">")} ${theme.fg("text", "Ask anything, edit files, run tools")}${theme.inverse(" ")}`;
	const hint = theme.fg(
		"dim",
		tuiT("ui.setupTheme.editorHint", "{submit} send · {newline} newline · / commands", {
			submit: editorKey("tui.input.submit"),
			newline: editorKey("tui.input.newLine"),
		}),
	);
	return [
		top,
		`${theme.fg("borderAccent", box.vertical)}${innerWidth > 0 ? padToWidth(prompt, innerWidth) : ""}${theme.fg("borderAccent", box.vertical)}`,
		`${theme.fg("borderMuted", box.vertical)}${fillStyledLine(hint, innerWidth)}${theme.fg("borderMuted", box.vertical)}`,
		bottom,
	];
}

function renderThemePreview(width: number): string[] {
	const previewWidth = Math.max(24, Math.min(width, 88));
	return [
		theme.bold(tuiT("ui.setupTheme.preview", "Preview")),
		`${theme.fg("success", `${theme.status.success} success`)}  ${theme.fg("warning", `${theme.status.warning} warning`)}  ${theme.fg("error", `${theme.status.error} error`)}  ${theme.fg("accent", "accent")}`,
		"",
		theme.fg("muted", tuiT("ui.setupTheme.statusLine", "Status line")),
		renderMockStatusLine(previewWidth),
		theme.fg("muted", tuiT("ui.setupTheme.editor", "Editor")),
		...renderMockEditor(previewWidth),
	];
}

/**
 * Native theme preview: status samples, a status bar and a read-only editor
 * in the highlighted theme's tokens. The terminal draws the bar and editor
 * chrome, so none of the ANSI mock's box or fill math applies.
 */
function describeThemePreview(): NativeNode {
	return col(
		[
			text([span(tuiT("ui.setupTheme.preview", "Preview"), "strong")]),
			text([
				span(`${theme.status.success} success`, "success"),
				span("  "),
				span(`${theme.status.warning} warning`, "warning"),
				span("  "),
				span(`${theme.status.error} error`, "error"),
				span("  "),
				span("accent", "accent"),
			]),
			text([span(tuiT("ui.setupTheme.statusLine", "Status line"), "muted")]),
			node("status", {}, [
				node("seg", { spans: [span(`${theme.icon.model} sonnet`, "statusLineModel")], side: "left" }),
				node("seg", { spans: [span("~/project", "statusLinePath")], side: "left" }),
				node("seg", { spans: [span(`${theme.icon.git} main +2`, "statusLineGitDirty")], side: "left" }),
				node("seg", { spans: [span(`${theme.icon.context} 42%`, "statusLineContext")], side: "right" }),
				node("seg", { spans: [span(`${theme.icon.cost} 0.18`, "statusLineCost")], side: "right" }),
			]),
			text([span(tuiT("ui.setupTheme.editor", "Editor"), "muted")]),
			node("input", {
				text: "Ask anything, edit files, run tools",
				cursor: "Ask anything, edit files, run tools".length,
				prompt: [span(">", "accent")],
				readonly: true,
			}),
			text([
				span(
					tuiT("ui.setupTheme.editorHint", "{submit} send · {newline} newline · / commands", {
						submit: editorKey("tui.input.submit"),
						newline: editorKey("tui.input.newLine"),
					}),
					"dim",
				),
			]),
		],
		{ role: "omp.setup.theme.preview" },
	);
}

class ThemeSceneController implements SetupSceneController {
	title = tuiT("ui.setupTheme.title", "Pick a theme");
	get subtitle(): string {
		return tuiT(
			"ui.setupTheme.subtitle",
			"Move through the list to preview; {confirm} saves the highlighted choice.",
			{
				confirm: editorKey("tui.select.confirm"),
			},
		);
	}
	#mode: ThemeMode = "curated";
	#selectList: SelectList;
	#loadingAllThemes = false;
	/** Error copy shown under the list (raw text; styled at render/describe time). */
	#message: string | undefined;
	#previewRequest = 0;
	#disposed = false;
	#step: WizardStep | undefined;
	#native = new Memo();
	readonly #originalTheme = getCurrentThemeName();
	readonly #originalSymbolPreset: SymbolPreset;
	readonly #originalColorBlindMode: boolean;

	readonly #host: SetupSceneHost;

	constructor(host: SetupSceneHost) {
		this.#host = host;
		this.#originalSymbolPreset = host.ctx.symbolPreset;
		this.#originalColorBlindMode = host.ctx.colorBlindMode;
		this.#selectList = this.#createSelectList(curatedItems(), this.#currentCuratedIndex());
	}

	dispose(): void {
		this.#disposed = true;
	}

	invalidate(): void {
		this.#native.clear();
		this.#step?.invalidate();
		this.#selectList.invalidate();
	}

	handleInput(data: string): void {
		const quickIndex = data >= "1" && data <= "9" ? Number(data) - 1 : -1;
		if (quickIndex >= 0) {
			this.#selectList.setSelectedIndex(quickIndex);
			this.#previewByIndex(quickIndex);
			return;
		}
		this.#selectList.handleInput(data);
	}

	/** Wheel moves the highlight (live preview); hover lights the row under the pointer; click confirms it. */
	routeMouse(event: SgrMouseEvent, line: number, col: number): void {
		if (this.#loadingAllThemes) {
			this.#selectList.routeMouse(event, Number.NEGATIVE_INFINITY, col);
			return;
		}
		this.#step?.routeMouse(event, line, col);
	}

	render(width: number, maxLines?: number): readonly string[] {
		const intro = new Container();
		intro.addChild(
			new Text(
				theme.fg(
					"muted",
					tuiT("ui.setupTheme.intro", "Theme changes preview live. Nothing is saved until you press {confirm}.", {
						confirm: editorKey("tui.select.confirm"),
					}),
				),
				0,
				0,
			),
		);
		intro.addChild(
			new Text(
				this.#mode === "all"
					? theme.fg(
							"dim",
							tuiT("ui.setupTheme.browsingAll", "Browsing all themes · {cancel} returns to curated choices", {
								cancel: editorKey("tui.select.cancel"),
							}),
						)
					: theme.fg(
							"dim",
							tuiT("ui.setupTheme.skipHint", "{cancel} skips this step", {
								cancel: editorKey("tui.select.cancel"),
							}),
						),
				0,
				0,
			),
		);
		// The mock status-line/editor block is decorative — the wizard itself
		// re-renders in the highlighted theme — so it yields to the list when
		// it would squeeze the window below the six curated rows (+1 for the
		// list's own search-status row).
		const preview = new Container();
		for (const line of renderThemePreview(width)) {
			preview.addChild(new Text(line, 0, 0));
		}
		const loading = this.#loadingAllThemes
			? new Text(theme.fg("dim", tuiT("ui.setupTheme.loading", "Loading themes…")), 0, 0)
			: undefined;
		const status = this.#message ? new Text(theme.fg("error", this.#message), 0, 0) : undefined;
		if (!this.#step) {
			this.#step = new WizardStep({
				kind: loading ? "async" : "choice",
				intro,
				preview: { component: preview, optional: true },
				content: loading ?? this.#selectList,
				status,
				minContentLines: curatedItems().length + 1,
				fitContent: budget => {
					if (this.#loadingAllThemes) return;
					const visible = budget === undefined ? 10 : budget - 1;
					this.#selectList.setMaxVisible(Math.max(1, Math.min(10, visible)));
				},
			});
		} else {
			this.#step.setKind(loading ? "async" : "choice");
			this.#step.setIntro(intro);
			this.#step.setPreview({ component: preview, optional: true });
			this.#step.setContent(loading ?? this.#selectList);
			this.#step.setStatus(status);
		}
		this.#step.setMaxHeight(maxLines);
		return this.#step.render(width);
	}

	/**
	 * Intro hints, the live preview, the theme list (a spinner while every
	 * theme loads) and any preview error. Theme switches re-describe through
	 * `invalidate()`, so the preview's tokens follow the highlighted theme.
	 */
	describe(): NativeNode {
		const confirm = editorKey("tui.select.confirm");
		const cancel = editorKey("tui.select.cancel");
		return this.#native.get(
			[this.#mode, this.#loadingAllThemes, this.#selectList, this.#message, confirm, cancel],
			() => {
				const children: NativeChild[] = [
					col([
						text([
							span(
								tuiT(
									"ui.setupTheme.intro",
									"Theme changes preview live. Nothing is saved until you press {confirm}.",
									{
										confirm,
									},
								),
								"muted",
							),
						]),
						text([
							span(
								this.#mode === "all"
									? tuiT(
											"ui.setupTheme.browsingAll",
											"Browsing all themes · {cancel} returns to curated choices",
											{
												cancel,
											},
										)
									: tuiT("ui.setupTheme.skipHint", "{cancel} skips this step", { cancel }),
								"dim",
							),
						]),
					]),
					describeThemePreview(),
					this.#loadingAllThemes
						? node(
								"spinner",
								{ label: [span(tuiT("ui.setupTheme.loading", "Loading themes…"), "dim")] },
								undefined,
								"loading",
							)
						: this.#selectList,
				];
				if (this.#message)
					children.push(node("text", { spans: [span(this.#message, "error")] }, undefined, "status"));
				return col(children, { gap: "sm", role: "omp.setup.theme" });
			},
		);
	}

	#createSelectList(items: readonly SelectItem[], selectedIndex: number): SelectList {
		const list = new SelectList(items, Math.min(10, Math.max(1, items.length)), getSelectListTheme());
		list.setSelectedIndex(selectedIndex);
		list.onSelectionChange = item => {
			void this.#preview(item.value);
		};
		list.onSelect = item => {
			void this.#select(item.value);
		};
		list.onCancel = () => {
			if (this.#mode === "all") {
				this.#mode = "curated";
				this.#selectList = this.#createSelectList(curatedItems(), this.#currentCuratedIndex());
				this.#host.requestRender();
				return;
			}
			this.#restorePreview();
			this.#host.finish("skipped");
		};
		return list;
	}

	#currentCuratedIndex(): number {
		const current = getCurrentThemeName();
		if (current === "titanium") return 1;
		if (current === "light") return 2;
		return 0;
	}

	#previewByIndex(index: number): void {
		const items = this.#mode === "curated" ? curatedItems() : undefined;
		const value = items?.[index]?.value;
		if (value) void this.#preview(value);
	}

	async #select(value: string): Promise<void> {
		if (value === "browse") {
			await this.#showAllThemes();
			return;
		}
		await this.#commit(value);
		this.#host.finish("done");
	}

	async #showAllThemes(): Promise<void> {
		if (this.#loadingAllThemes) return;
		this.#loadingAllThemes = true;
		this.#message = undefined;
		this.#host.requestRender();
		try {
			const themes = await getAvailableThemes();
			if (this.#disposed) return;
			const items = themes.map(name => ({
				value: `theme:${name}`,
				label: name,
				description: name === this.#originalTheme ? tuiT("ui.setupTheme.current", "current") : undefined,
			}));
			const selectedIndex = Math.max(0, themes.indexOf(this.#originalTheme ?? ""));
			this.#mode = "all";
			this.#selectList = this.#createSelectList(items, selectedIndex);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.#message = tuiT("ui.setupTheme.loadFailed", "Failed to load themes: {message}", { message });
		} finally {
			this.#loadingAllThemes = false;
			this.#host.requestRender();
		}
	}

	async #commit(value: string): Promise<void> {
		if (value === "auto") {
			this.#host.ctx.saveTheme("dark", "titanium");
			this.#host.ctx.saveTheme("light", "light");
			await this.#applyPreviewPresentation(this.#originalSymbolPreset, this.#originalColorBlindMode);
			enableAutoTheme();
			return;
		}
		if (value === "colorblind") {
			this.#host.ctx.saveColorBlindMode(true);
			await this.#applyPreviewPresentation(this.#originalSymbolPreset, true);
			return;
		}
		if (value === "ansi") {
			this.#host.ctx.saveSymbolPreset("ascii");
			this.#host.ctx.saveTheme("dark", "dark-terminal");
			await this.#applyPreviewPresentation("ascii", this.#originalColorBlindMode);
			enableAutoTheme();
			return;
		}
		const themeName = this.#themeNameFromValue(value);
		if (!themeName) return;
		await this.#applyPreviewPresentation(this.#originalSymbolPreset, this.#originalColorBlindMode);
		if (isLightTheme(themeName)) {
			this.#host.ctx.saveTheme("light", themeName);
		} else {
			this.#host.ctx.saveTheme("dark", themeName);
		}
		await previewTheme(themeName, { ephemeral: false });
	}

	async #preview(value: string): Promise<void> {
		const request = ++this.#previewRequest;
		this.#message = undefined;
		if (value === "browse") {
			this.#host.requestRender();
			return;
		}

		let result: { success: boolean; error?: string } = { success: true };
		if (value === "auto") {
			await this.#applyPreviewPresentation(this.#originalSymbolPreset, this.#originalColorBlindMode);
			enableAutoTheme({ ephemeral: true });
		} else if (value === "colorblind") {
			await this.#applyPreviewPresentation(this.#originalSymbolPreset, true);
		} else if (value === "ansi") {
			await this.#applyPreviewPresentation("ascii", this.#originalColorBlindMode);
			result = await previewTheme("dark-terminal");
		} else {
			const themeName = this.#themeNameFromValue(value);
			if (themeName) {
				await this.#applyPreviewPresentation(this.#originalSymbolPreset, this.#originalColorBlindMode);
				result = await previewTheme(themeName);
			}
		}
		if (request !== this.#previewRequest || this.#disposed) return;
		if (!result.success) {
			this.#message = result.error ?? tuiT("ui.setupTheme.previewFailed", "Theme preview failed");
		}
		this.#host.ctx.ui.invalidate();
		this.#host.requestRender();
	}

	async #applyPreviewPresentation(symbolPreset: SymbolPreset, colorBlindMode: boolean): Promise<void> {
		await setSymbolPreset(symbolPreset);
		await setColorBlindMode(colorBlindMode);
	}

	#restorePreview(): void {
		void (async () => {
			await this.#applyPreviewPresentation(this.#originalSymbolPreset, this.#originalColorBlindMode);
			if (this.#originalTheme) {
				await previewTheme(this.#originalTheme);
			}
			this.#host.ctx.ui.invalidate();
			this.#host.requestRender();
		})();
	}

	#themeNameFromValue(value: string): string | undefined {
		return value.startsWith("theme:") ? value.slice("theme:".length) : undefined;
	}
}

/** Preview and persist the terminal color theme. */
export const themeSetupScene: SetupScene = {
	id: "theme",
	get title(): string {
		return tuiT("ui.setupTheme.title", "Pick a theme");
	},
	get step(): string {
		return tuiT("ui.setupTheme.step", "Theme");
	},
	minVersion: 1,
	ansiOnly: true,
	mount: host => new ThemeSceneController(host),
};
