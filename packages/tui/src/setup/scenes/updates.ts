import { type SgrMouseEvent } from "../../mouse";
import { type SelectItem, SelectList } from "../../components/select-list";
import { Text } from "../../components/text";
import { WizardStep } from "../../components/wizard-step";
import { getSelectListTheme, theme } from "../../theme/theme";
import { col, span, text } from "../../native/describe";
import type { NativeNode } from "../../native/node";
import { Memo } from "../../native/memo";
import type { SetupScene, SetupSceneController, SetupSceneHost } from "./types";
import { tuiT } from "../../i18n-host";

function introText(): string {
	return tuiT(
		"ui.setupUpdates.intro",
		"Updates install through whatever installed omp: the standalone binary, Homebrew, mise, bun, or npm. Change this later in /settings.",
	);
}

function updateItems(): readonly SelectItem[] {
	return [
		{
			value: "auto",
			label: tuiT("ui.setupUpdates.itemAuto", "1  Update automatically"),
			description: tuiT("ui.setupUpdates.itemAutoDesc", "Installs in the background; the next launch runs it"),
		},
		{
			value: "notify",
			label: tuiT("ui.setupUpdates.itemNotify", "2  Notify me"),
			description: tuiT("ui.setupUpdates.itemNotifyDesc", "Show a notice on startup; run omp update yourself"),
		},
	];
}

class UpdatesSceneController implements SetupSceneController {
	title = tuiT("ui.setupUpdates.title", "Keep omp up to date");
	subtitle = tuiT("ui.setupUpdates.subtitle", "Choose how new releases reach you.");
	#items: readonly SelectItem[];
	#selectList: SelectList;
	#committing = false;
	#step: WizardStep | undefined;
	#native = new Memo();

	readonly #host: SetupSceneHost;

	constructor(host: SetupSceneHost) {
		this.#host = host;
		this.#items = updateItems();
		this.#selectList = new SelectList(this.#items, this.#items.length, getSelectListTheme());
		this.#selectList.setSelectedIndex(host.ctx.autoUpdate ? 0 : 1);
		this.#selectList.onSelect = item => {
			void this.#commit(item.value === "auto");
		};
		// Esc skips the scene; the configured setting stays untouched.
		this.#selectList.onCancel = () => host.finish("skipped");
	}

	invalidate(): void {
		this.#native.clear();
		if (this.#step) this.#step.invalidate();
		else this.#selectList.invalidate();
	}

	handleInput(data: string): void {
		if (this.#committing) return;
		const quickIndex = data === "1" || data === "2" ? Number(data) - 1 : -1;
		if (quickIndex >= 0) {
			this.#selectList.setSelectedIndex(quickIndex);
			this.#host.requestRender();
			return;
		}
		if (this.#step) this.#step.handleInput(data);
		else this.#selectList.handleInput(data);
	}

	routeMouse(event: SgrMouseEvent, line: number, col: number): void {
		if (this.#committing) return;
		this.#step?.routeMouse(event, line, col);
	}

	render(width: number, maxLines?: number): readonly string[] {
		this.#step ??= new WizardStep({
			kind: "choice",
			intro: new Text(theme.fg("muted", introText()), 0, 0),
			content: this.#selectList,
			minContentLines: this.#items.length,
			fitContent: () => {
				this.#selectList.setMaxVisible(this.#items.length);
			},
		});
		this.#step.setMaxHeight(maxLines);
		return this.#step.render(width);
	}

	describe(): NativeNode {
		return this.#native.get([this.#selectList], () =>
			col([text([span(introText(), "muted")], { wrap: "word" }), this.#selectList], {
				gap: "sm",
				role: "omp.setup.updates",
			}),
		);
	}

	async #commit(enabled: boolean): Promise<void> {
		if (this.#committing) return;
		this.#committing = true;
		try {
			await this.#host.ctx.saveAutoUpdate(enabled);
		} finally {
			this.#host.finish("done");
		}
	}
}

/**
 * Opt in to background self-update (`update.auto`). Skipped where omp cannot
 * update itself, notably under Tern, which keeps its omp current on its own.
 */
export const updatesSetupScene: SetupScene = {
	id: "auto-update",
	get title(): string {
		return tuiT("ui.setupUpdates.title", "Keep omp up to date");
	},
	get step(): string {
		return tuiT("ui.setupUpdates.step", "Updates");
	},
	minVersion: 3,
	shouldRun: ctx => ctx.canAutoUpdate(),
	mount: host => new UpdatesSceneController(host),
};
