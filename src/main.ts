import './style.css'
import {MixEmulator} from "./mix/mix-emulator.ts";
import {MIX_WORD_SIZE, MixWord} from "./mix/mix-word.ts";

let randomize = false;
let mix: MixEmulator = new MixEmulator();

function reset() {
    try {
        mix.reset(randomize);
        mix.memory.store(0, MixWord.fromBytes([1, 0, 3, 0, 5, 1])); // ADD 2000
        mix.memory.store(1, MixWord.fromBytes([1, 0, 3, 0, 5, 1])); // ADD 2000
        mix.memory.store(2, MixWord.fromBytes([1, 0, 3, 0, 5, 1])); // ADD 2000
        mix.memory.store(3, new MixWord(MixWord.MAX_VALUE));
    } catch (e: any) {
        console.error(e);
    }
}

function init() {
    reset();
    const app = document.querySelector<HTMLDivElement>("#app")!;
    render(mix, app);
}

function render(mix: MixEmulator, dom: HTMLDivElement) {
    dom.appendChild(document.createElement('h1')).textContent = 'MIX Simulator';
    renderMIXAsmTextArea(dom);
    renderControls(mix, dom);
    renderStatus(mix, dom);
    renderRegisters(mix, dom);
    renderMemory(mix, dom);
}

function renderControls(mix: MixEmulator, dom: HTMLDivElement) {
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => {
        reset();
    });
    dom.appendChild(resetButton);

    const stepButton = document.createElement('button');
    stepButton.textContent = 'Step';
    stepButton.addEventListener('click', () => {
        mix.step();
    });
    dom.appendChild(stepButton);

    const randomizeCheckbox = document.createElement('input');
    randomizeCheckbox.id = 'randomize';
    randomizeCheckbox.type = 'checkbox';
    randomizeCheckbox.checked = randomize;
    randomizeCheckbox.addEventListener('change', (e) => {
        randomize = (e.target as HTMLInputElement).checked;
    });
    dom.appendChild(randomizeCheckbox);
    const randomizeLabel = document.createElement('label');
    randomizeLabel.htmlFor = 'randomize';
    randomizeLabel.textContent = 'Randomize';
    dom.appendChild(randomizeLabel);
}

function renderMIXAsmTextArea(dom: HTMLDivElement) {
    const container = document.createElement('div');
    const title = document.createElement('h2');
    container.appendChild(title).textContent = 'MIX Assembler';

    const asmTextArea = document.createElement('textarea');
    asmTextArea.id = 'asmTextArea';
    asmTextArea.rows = 30;
    asmTextArea.cols = 300;
    asmTextArea.textContent = ``;
    container.appendChild(asmTextArea);
    dom.appendChild(container);
}

function _formatByte(b: number): string {
    return b.toString(10).padStart(2, '0');
}

function renderWord(word: MixWord, tr: HTMLTableRowElement) {
    const byteUI: HTMLElement[] = [];

    const sign = document.createElement('td');
    sign.className = `sign label-${word.label} f-0`;
    tr.appendChild(sign).textContent = word.signLabel;

    const L = word.left;
    for (let i = L; i <= MIX_WORD_SIZE; i++) {
        const td = document.createElement('td');
        td.className = `byte label-${word.label} f-${i}`;
        byteUI.push(td);
        tr.appendChild(td).textContent = _formatByte(word.getByte(i));
    }

    word.onChange((e) => {
        sign.textContent = e.word.signLabel;
        for (let i = L; i <= MIX_WORD_SIZE; i++) {
            byteUI[i - L].textContent = _formatByte(e.word.getByte(i));
        }
    })
}

function renderMemory(mix: MixEmulator, dom: HTMLDivElement) {
    dom.appendChild(document.createElement('h2')).textContent = 'Memory';

    const memTable = document.createElement('table');
    memTable.id = "memTable";
    dom.appendChild(memTable);

    const rowSize = 10;
    const rows: MixWord[][] = [];
    let row: MixWord[] = [];
    for (const word of mix.memory) {
        row.push(word);
        if (row.length == rowSize) {
            rows.push(row);
            row = [];
        }
    }

    // header
    const tr = document.createElement('tr');
    tr.appendChild(document.createElement('th')).textContent = 'Addr';
    for (let i = 0; i < rowSize; i++) {
        const th = document.createElement('th');
        th.colSpan = MIX_WORD_SIZE + 1; // sign + bytes
        th.textContent = '+' + i.toString(10);
        tr.appendChild(th);
    }
    memTable.appendChild(tr);

    for (const row of rows) {
        const tr = document.createElement('tr');
        tr.appendChild(document.createElement('td')).textContent = row[0].label;

        for (const word of row) {
            renderWord(word, tr);
        }
        memTable.appendChild(tr);
    }
}

function renderRegisters(mix: MixEmulator, dom: HTMLDivElement) {
    dom.appendChild(document.createElement('h2')).textContent = 'Registers';
    const regTable = document.createElement('table');
    regTable.id = "regTable";
    dom.appendChild(regTable);

    // header
    const tr = document.createElement('tr');

    const hrA = tr.appendChild(document.createElement('th'));
    hrA.colSpan = MIX_WORD_SIZE + 1;
    hrA.textContent = 'rA';

    const hrX = tr.appendChild(document.createElement('th'));
    hrX.colSpan = MIX_WORD_SIZE + 1;
    hrX.textContent = 'rX';
    for (let i = 1; i <= 6; i++) {
        const hrI = tr.appendChild(document.createElement('th'));
        hrI.colSpan = 3;
        hrI.textContent = `rI${i}`;
    }
    const hrJ = tr.appendChild(document.createElement('th'));
    hrJ.colSpan = 3;
    hrJ.textContent = 'rJ';
    regTable.appendChild(tr);

    const contents = document.createElement('tr');
    renderWord(mix.rA, contents);
    renderWord(mix.rX, contents);
    renderWord(mix.rI1, contents);
    renderWord(mix.rI2, contents);
    renderWord(mix.rI3, contents);
    renderWord(mix.rI4, contents);
    renderWord(mix.rI5, contents);
    renderWord(mix.rI6, contents);
    renderWord(mix.rJ, contents);
    regTable.appendChild(contents);
}

function renderStatus(mix: MixEmulator, dom: HTMLDivElement) {
    dom.appendChild(document.createElement('h2')).textContent = 'Internal State';
    const statusTable = document.createElement('table');
    statusTable.id = "statusTable";
    statusTable.className = 'status';
    statusTable.style.minWidth = '0';
    dom.appendChild(statusTable);

    const tr = document.createElement('tr');
    tr.appendChild(document.createElement('th')).textContent = 'State';
    tr.appendChild(document.createElement('th')).textContent = 'Value';
    statusTable.appendChild(tr);

    const tr1 = document.createElement('tr');
    tr1.appendChild(document.createElement('td')).textContent = 'PC';
    const pc = document.createElement('td');
    tr1.appendChild(pc).textContent = mix.pc.toString(10).padStart(4, '0');
    statusTable.appendChild(tr1);

    const tr2 = document.createElement('tr');
    tr2.appendChild(document.createElement('td')).textContent = 'CMP';
    const cmp = document.createElement('td');
    tr2.appendChild(cmp).textContent = mix.compare.toString();
    statusTable.appendChild(tr2);

    const tr3 = document.createElement('tr');
    tr3.appendChild(document.createElement('td')).textContent = 'OV';
    const ov = document.createElement('td');
    tr3.appendChild(ov).textContent = mix.overflow.toString();
    statusTable.appendChild(tr3);

    mix.onStateChange(({newState}) => {
        pc.textContent = newState.pc.toString(10).padStart(4, '0');
        cmp.textContent = newState.compare.toString();
        ov.textContent = newState.overflow.toString();
    });
}

document.addEventListener('DOMContentLoaded', init);