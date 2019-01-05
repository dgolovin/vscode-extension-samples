/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem, window, Disposable, CancellationToken, QuickInputButton, QuickInput, ExtensionContext, QuickInputButtons, Uri } from 'vscode';

/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 * 
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 */
export async function multiStepInput(context: ExtensionContext) {

	class MyButton implements QuickInputButton {
		constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
	}

	const createResourceGroupButton = new MyButton({
		dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
		light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
	}, 'Create Resource Group');

	const projects: QuickPickItem[] = ['project1', 'project2', 'project3', 'project4', 'project5']
		.map(label => ({ label }));

	const applications: QuickPickItem[] = ['app1', 'app2', 'app3', 'app4', 'app5']
		.map(label => ({ label }));

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		project: QuickPickItem | string;
		application: QuickPickItem | string;
		name: string;
		runtime: QuickPickItem;
	}

	async function collectInputs() {
		const state = {} as Partial<State>;

		await MultiStepInput.run(input => pickProject(input, state));
		return state as State;
	}

	const title = 'Create OpenShift Component';

	async function pickProject(input: MultiStepInput, state: Partial<State>, additionalSteps: number = 0) {
		state.step = state.step ? state.step + 1 : 1;
		const pick = await input.showQuickPick({
			title,
			step: state.step,
			totalSteps: 3 + additionalSteps,
			placeholder: 'Pick a Project',
			items: projects,
			activeItem: typeof state.project !== 'string' ? state.project : undefined,
			buttons: [createResourceGroupButton],
			shouldResume: shouldResume
		});
		if (pick instanceof MyButton) {
			return (input: MultiStepInput) => inputProjectName(input, state, additionalSteps + 1);
		}
		state.project = pick;
		return (input: MultiStepInput) => pickApplicationName(input, state,  additionalSteps);
	}

	async function inputProjectName(input: MultiStepInput, state: Partial<State>, additionalSteps: number = 0) {
		state.step = state.step ? state.step + 1 : 1;
		state.project = await input.showInputBox({
			title,
			step: state.step,
			totalSteps: 3 + additionalSteps,
			value: typeof state.project === 'string' ? state.project : '',
			prompt: 'Choose a unique name for the Project',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: MultiStepInput) => pickApplicationName(input, state,  additionalSteps);
	}

	async function pickApplicationName(input: MultiStepInput, state: Partial<State>, additionalSteps: number = 0) {
		state.step = state.step ? state.step + 1 : 1;
		const pick = await input.showQuickPick({
			title,
			step: state.step,
			totalSteps: 3 + additionalSteps,
			placeholder: 'Pick an Application',
			items: applications,
			activeItem: typeof state.application !== 'string' ? state.application : undefined,
			buttons: [createResourceGroupButton],
			shouldResume: shouldResume
		});
		if (pick instanceof MyButton) {
			return (input: MultiStepInput) => inputApplicationName(input, state,  additionalSteps + 1);
		}
		state.application = pick;
		return (input: MultiStepInput) => pickRuntime(input, state,  additionalSteps);
	}

	async function inputApplicationName(input: MultiStepInput, state: Partial<State>, additionalSteps: number = 0) {
		state.step = state.step ? state.step + 1 : 1;
		// TODO: Remember current value when navigating back.
		state.application = await input.showInputBox({
			title,
			step: state.step,
			totalSteps: 3 + additionalSteps,
			value: typeof state.application === 'string' ? state.application : '',
			prompt: 'Choose a unique name for the Application',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: MultiStepInput) => pickRuntime(input, state, additionalSteps);
	}

	async function pickRuntime(input: MultiStepInput, state: Partial<State>, additionalSteps: number = 0) {
		state.step = state.step ? state.step + 1 : 1;
		const runtimes = await getAvailableRuntimes(state.application!, undefined /* TODO: token */);
		// TODO: Remember currently active item when navigating back.
		state.runtime = await input.showQuickPick({
			title,
			step: state.step,
			totalSteps: 3 + additionalSteps,
			placeholder: 'Pick a runtime',
			items: runtimes,
			activeItem: state.runtime,
			shouldResume: shouldResume
		});
	}

	function shouldResume() {
		// Could show a notification with the option to resume.
		return new Promise<boolean>((resolve, reject) => {

		});
	}

	async function validateNameIsUnique(name: string) {
		// ...validate...
		await new Promise(resolve => setTimeout(resolve, 1000));
		return name === 'vscode' ? 'Name not unique' : undefined;
	}

	async function getAvailableRuntimes(resourceGroup: QuickPickItem | string, token?: CancellationToken): Promise<QuickPickItem[]> {
		// ...retrieve...
		await new Promise(resolve => setTimeout(resolve, 1000));
		return ['Node 8.9', 'Node 6.11', 'Node 4.5']
			.map(label => ({ label }));
	}

	const state = await collectInputs();
	window.showInformationMessage(`OpenShift component '${isQuickPickItem(state.project) ? state.project.label : state.project}/${isQuickPickItem(state.application) ? state.application.label : state.application }/${state.runtime.label}'`);
}


function isQuickPickItem(item: QuickPickItem | string): item is QuickPickItem {
    return typeof item !== 'string';
}

// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------


class InputFlowAction {
	private constructor() { }
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	validate: (value: string) => Promise<string | undefined>;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {

	static async run<T>(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough<T>(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				input.items = items;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, validate, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				let validating = validate('');
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						if (!(await validate(value))) {
							resolve(value);
						}
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidChangeValue(async text => {
						const current = validate(text);
						validating = current;
						const validationMessage = await current;
						if (current === validating) {
							input.validationMessage = validationMessage;
						}
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}
}