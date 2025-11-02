import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownRenderer } from 'obsidian';
import { learnStyle, stylizeText } from './utils/styleAPI';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
	learnedNoteStyle?: boolean;
	previewInput?: string;
	sampleNotesPath?: string;
	anthropicApiKey?: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	learnedNoteStyle: false,
	previewInput: '',
	sampleNotesPath: '',
	anthropicApiKey: ''
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
		this.ribbonIconEl = this.addRibbonIcon('microphone', 'Start Note Taking', (_evt: MouseEvent) => {
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

	async startRecording() {
		this.isRecording = true;
		if (this.ribbonIconEl) {
			this.ribbonIconEl.setAttribute('aria-pressed', 'true');
			this.ribbonIconEl.setAttribute('title', 'Stop Note Taking');
			// Obsidian's HTMLElement helper includes addClass; fall back to classList if not present
			// @ts-ignore
			if (typeof (this.ribbonIconEl as any).addClass === 'function') (this.ribbonIconEl as any).addClass('is-recording');
			else this.ribbonIconEl.classList.add('is-recording');
		}
		if (this.statusBarItemEl) this.statusBarItemEl.setText('Recording...');
		
		// Get the absolute path of the current active file
		let currentFilePath = null;
		let fallbackPath = null;
		const activeFile = this.app.workspace.getActiveFile();
		
		if (activeFile) {
			// Get the absolute path of the active file in the vault
			const vaultPath = (this.app.vault.adapter as any).basePath;
			currentFilePath = `${vaultPath}/${activeFile.path}`;
			console.log(`📝 Will save notes to current file: ${currentFilePath}`);
		} else {
			// Fallback to final_notes.md in the vault root
			const vaultPath = (this.app.vault.adapter as any).basePath;
			fallbackPath = `${vaultPath}/final_notes.md`;
			console.log(`📝 No active file, will save notes to: ${fallbackPath}`);
		}
		
		// Start webhook processing
		try {
			const response = await fetch('http://localhost:3000/start-recording', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					currentFilePath: currentFilePath,
					fallbackPath: fallbackPath 
				})
			});
			
			if (response.ok) {
				new Notice(`Note taking started - saving to ${activeFile ? activeFile.name : 'final_notes.md'}`);
			} else {
				throw new Error('Failed to start webhook processing');
			}
		} catch (error) {
			console.error('Failed to start webhook processing:', error);
			new Notice('Note taking started (webhook server may not be running)');
		}

		// Example: start a lightweight timer to simulate periodic save/heartbeat
		this.recordingTimer = window.setInterval(() => {
			// Replace this with actual recording logic (writing audio/chunks etc.)
			console.log('Recording heartbeat — plugin would flush buffers here');
		}, 10_000);
	}

	async stopRecording() {
		this.isRecording = false;
		if (this.ribbonIconEl) {
			this.ribbonIconEl.setAttribute('aria-pressed', 'false');
			this.ribbonIconEl.setAttribute('title', 'Start Note Taking');
			// @ts-ignore
			if (typeof (this.ribbonIconEl as any).removeClass === 'function') (this.ribbonIconEl as any).removeClass('is-recording');
			else this.ribbonIconEl.classList.remove('is-recording');
		}
		if (this.statusBarItemEl) this.statusBarItemEl.setText('Processing final notes...');

		if (this.recordingTimer) {
			window.clearInterval(this.recordingTimer);
			this.recordingTimer = null;
		}

		// Stop webhook processing and trigger final processing
		try {
			const response = await fetch('http://localhost:3000/stop-recording', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});
			
			if (response.ok) {
				new Notice('Note taking stopped - processing all remaining content');
				if (this.statusBarItemEl) this.statusBarItemEl.setText('Ready');
			} else {
				throw new Error('Failed to stop webhook processing');
			}
		} catch (error) {
			console.error('Failed to stop webhook processing:', error);
			new Notice('Note taking stopped (webhook server may not be running)');
			if (this.statusBarItemEl) this.statusBarItemEl.setText('Ready');
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
	previewTimer: number | null = null;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
			const {containerEl} = this;
			// vault root path (used to compute plugin script path)
			const notesDir = (this.app.vault.adapter as any).basePath;
			const pluginScriptPath = `${notesDir}/.obsidian/plugins/live-noter/utils/learn_style.py`;

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
				.setName('Anthropic API Key')
				.setDesc('Optional: set your ANTHROPIC_API_KEY here so Obsidian can call the API even if it does not inherit your shell environment. Stored locally in plugin settings.')
				.addText(text => text
					.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.anthropicApiKey ?? '')
					.onChange(async (value) => {
						this.plugin.settings.anthropicApiKey = value;
						await this.plugin.saveSettings();
					}));

			// --- Preview input and live styled preview ---

			// --- Select sample notes folder (relative to vault root) ---
			new Setting(containerEl)
				.setName('Sample notes folder')
				.setDesc('Optional: relative path to the folder containing sample notes to learn style from (e.g. "Notes/Physics"). Leave blank to use vault root.')
				.addText(text => text
					.setPlaceholder('relative path or leave blank')
					.setValue(this.plugin.settings.sampleNotesPath ?? '')
					.onChange(async (value) => {
						this.plugin.settings.sampleNotesPath = value;
						await this.plugin.saveSettings();
					}));
			
			new Setting(containerEl)
				.setName('Learn note-taking style')
				.setDesc('Teach the plugin your note-taking preferences.')
				.addButton(btn => btn
					.setButtonText(this.plugin.settings.learnedNoteStyle ? 'Re-learn style' : 'Learn note-taking style')
					.setCta()
					.onClick(async () => {
						// Run the python helper to learn the style corpus from the user's vault notes
						try {
								// let user-specified sampleNotesPath refine which notes folder we use
								const samplePath = (this.plugin.settings.sampleNotesPath || '').trim();
								const notesRoot = samplePath ? `${notesDir}/${samplePath}` : notesDir;
								const apiKey = this.plugin.settings.anthropicApiKey || (window && (window as any).process?.env?.ANTHROPIC_API_KEY) || '';
								
								new Notice('Learning style... This may take a moment.');
								const result = learnStyle(notesRoot, pluginScriptPath, apiKey);
								
							this.plugin.settings.learnedNoteStyle = true;
							await this.plugin.saveSettings();
							
							// Show the style summary in console and notice
							console.log('📝 Your Note-Taking Style Summary:');
							console.log(result.summary);
							
							if (result.filePath) {
								console.log(`💾 Style saved to: ${result.filePath}`);
								new Notice(`Style learned and saved to style.txt! Check console for details.`);
							} else {
								new Notice('Style learned! Check console for summary.');
							}
							
							this.display();
						} catch (err) {
							console.error('Error learning style', err);
							new Notice('Failed to learn style (see console)');
						}
					}));
			if (this.plugin.settings.learnedNoteStyle) {
				const styleContainer = containerEl.createDiv({ cls: 'live-noter-learned-style' });
				
				const stylePreview = styleContainer.createDiv({ cls: 'live-noter-style-content' });
				stylePreview.style.cssText = `
					background: var(--background-secondary);
					border: 1px solid var(--background-modifier-border);
					border-radius: 6px;
					padding: 12px;
					margin: 10px 0;
					max-height: 200px;
					overflow-y: auto;
					font-size: 0.9em;
					line-height: 1.4;
				`;
				
				// Load and render the style from style.txt file
				const styleFilePath = `${notesDir}/.obsidian/plugins/live-noter/style.txt`;
				try {
					const fs = require('fs');
					const styleContent = fs.readFileSync(styleFilePath, 'utf8');
					MarkdownRenderer.renderMarkdown(styleContent, stylePreview, '', this.plugin).catch(() => {
						// Fallback to plain text if markdown rendering fails
						stylePreview.setText(styleContent || 'No style learned yet.');
					});
				} catch (error) {
					// Fallback if file doesn't exist
					stylePreview.setText('No style file found. Please learn your note-taking style first.');
				}
			}
			new Setting(containerEl)
				.setName('Preview text')
				.setDesc('Type sample text to preview how the style will be applied.')
				.addTextArea(textarea => textarea
					.setPlaceholder('Enter sample note text to preview')
					.setValue(this.plugin.settings.previewInput ?? '')
					.onChange(async (value) => {
						this.plugin.settings.previewInput = value;
						await this.plugin.saveSettings();
						// debounce: wait until user stops typing for 5s, then call the style API
						if (this.previewTimer) window.clearTimeout(this.previewTimer);
						this.previewTimer = window.setTimeout(() => {
							const apiKey = this.plugin.settings.anthropicApiKey || (window && (window as any).process?.env?.ANTHROPIC_API_KEY) || '';
							this.callStyleAndRender(value, previewContainer, pluginScriptPath, apiKey);
						}, 5000);
					}));

			// container for the rendered styled preview
			const previewContainer = containerEl.createDiv({ cls: 'live-noter-style-preview' });


			// helper to call the style API and render the result into previewContainer
			// kept as an instance method so it can access this.plugin and this.app
			// defined below after the initial render setup.

			// initial render: if we have previously-styled text saved, render it immediately
			if (this.plugin.settings.previewInput) {
				// show a lightweight placeholder until the API runs (user will trigger the API after typing stops)
				previewContainer.setText ? previewContainer.setText(this.plugin.settings.previewInput) : previewContainer.innerText = this.plugin.settings.previewInput;
			}

			// expose preview container for method below
			// (callStyleAndRender will use this.containerEl via the passed previewContainer)
	}

	/**
	 * Call the Python style API and render the returned markdown into the preview container.
	 */
	async callStyleAndRender(value: string, previewContainer: HTMLElement, scriptPath?: string, apiKey?: string) {
		const notesDir = (this.app.vault.adapter as any).basePath;
		try {
			const styled = stylizeText(notesDir, value ?? '', scriptPath, apiKey);
			// clear previous render
			if (previewContainer.empty) previewContainer.empty(); else previewContainer.innerHTML = '';
			if (!styled) return;
			await MarkdownRenderer.renderMarkdown(styled, previewContainer, '', this.plugin);
		} catch (err) {
			console.error('Preview render error', err);
			if (previewContainer.setText) previewContainer.setText('Error rendering preview'); else previewContainer.innerText = 'Error rendering preview';
		} finally {
			this.previewTimer = null;
		}
	}
}
