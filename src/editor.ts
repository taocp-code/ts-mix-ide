import {EditorState} from "@codemirror/state";
import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {emacsStyleKeymap} from "@codemirror/commands";

export function renderEditor(initProgram: string, parent: HTMLElement): EditorView {
    let startState = EditorState.create({
        doc: initProgram,
        extensions: [keymap.of(emacsStyleKeymap)]
    });
    return new EditorView({
        state: startState,
        extensions: [lineNumbers()],
        parent: parent
    });
}