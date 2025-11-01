import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
	learnedNoteStyle?: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	learnedNoteStyle: false
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	isRecording: boolean = false;
	ribbonIconEl?: HTMLElement;
	statusBarItemEl?: HTMLElement;
	recordingTimer: number | null = null;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon. It acts as a recording controller for lectures.
		this.ribbonIconEl = this.addRibbonIcon('microphone', 'Start Lecture Recording', (_evt: MouseEvent) => {
			// Toggle recording on click
			this.toggleRecording();
		});
		// Add a class so users/themes can style an "is-recording" state if desired
		this.ribbonIconEl.addClass('my-plugin-ribbon-class');

	// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
	this.statusBarItemEl = this.addStatusBarItem();
	this.statusBarItemEl.setText('Ready');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		// clean up any recording timer if present
		if (this.recordingTimer) {
			window.clearInterval(this.recordingTimer);
			this.recordingTimer = null;
		}
		this.isRecording = false;
	}

	toggleRecording() {
		if (this.isRecording) {
			this.stopRecording();
		} else {
			this.startRecording();
		}
	}

	startRecording() {
		this.isRecording = true;
		if (this.ribbonIconEl) {
			this.ribbonIconEl.setAttribute('aria-pressed', 'true');
			this.ribbonIconEl.setAttribute('title', 'Stop Lecture Recording');
			// Obsidian's HTMLElement helper includes addClass; fall back to classList if not present
			// @ts-ignore
			if (typeof (this.ribbonIconEl as any).addClass === 'function') (this.ribbonIconEl as any).addClass('is-recording');
			else this.ribbonIconEl.classList.add('is-recording');
		}
		if (this.statusBarItemEl) this.statusBarItemEl.setText('Recording...');
		new Notice('Lecture recording started');

		// Example: start a lightweight timer to simulate periodic save/heartbeat
		this.recordingTimer = window.setInterval(() => {
			// Replace this with actual recording logic (writing audio/chunks etc.)
			console.log('Recording heartbeat — plugin would flush buffers here');
		}, 10_000);
	}

	stopRecording() {
		this.isRecording = false;
		if (this.ribbonIconEl) {
			this.ribbonIconEl.setAttribute('aria-pressed', 'false');
			this.ribbonIconEl.setAttribute('title', 'Start Lecture Recording');
			// @ts-ignore
			if (typeof (this.ribbonIconEl as any).removeClass === 'function') (this.ribbonIconEl as any).removeClass('is-recording');
			else this.ribbonIconEl.classList.remove('is-recording');
		}
		if (this.statusBarItemEl) this.statusBarItemEl.setText('Ready');
		new Notice('Lecture recording stopped');

		if (this.recordingTimer) {
			window.clearInterval(this.recordingTimer);
			this.recordingTimer = null;
		}
	}

	async learnNoteTakingStyle() {
		// Placeholder: the real implementation would analyze notes or prompt the user.
		this.settings.learnedNoteStyle = true;
		await this.saveSettings();
		new Notice('Learned note-taking style (simulated)');
	}

    

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

			new Setting(containerEl)
				.setName('Setting #1')
				.setDesc('It\'s a mom')
				.addText(text => text
					.setPlaceholder('enter your dad')
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Learn note-taking style')
				.setDesc('Teach the plugin your note-taking preferences (simulated).')
				.addButton(btn => btn
					.setButtonText(this.plugin.settings.learnedNoteStyle ? 'Re-learn style' : 'Learn note-taking style')
					.setCta()
					.onClick(async () => {
						await this.plugin.learnNoteTakingStyle();
						// Update button text after learning
						this.display();
					}));
	}
}
