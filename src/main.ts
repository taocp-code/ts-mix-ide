import './style.css'
import {Mix} from "./mix/mix.ts";
import {_mix_field_encode, MIX_WORD_SIZE, type MixWord} from "./mix/mix-word.ts";

const randomize = true;
let mix: Mix = new Mix();

function init() {
    mix.reset(randomize);
    const app = document.querySelector<HTMLDivElement>("#app")!;
    render(mix, app);
}

function render(mix: Mix, dom: HTMLDivElement) {
    dom.appendChild(document.createElement('h1')).textContent = 'MIX Simulator';
    renderControls(mix, dom);
    renderStatus(mix, dom);
    renderRegisters(mix, dom);
    renderMemory(mix, dom);
}

function renderControls(mix: Mix, dom: HTMLDivElement) {
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => {
        mix.reset(randomize);
    });
    dom.appendChild(resetButton);
}

function _formatByte(b: number): string {
    return b.toString(10).padStart(2, '0');
}

function renderWord(word: MixWord, tr: HTMLTableRowElement) {
    const byteUI: HTMLElement[] = [];

    const sign = document.createElement('td');
    sign.className = `sign label-${word.label} f-0`;
    tr.appendChild(sign).textContent = word.signLabel;

    const L = 1;
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

function renderMemory(mix: Mix, dom: HTMLDivElement) {
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

function renderRegisters(mix: Mix, dom: HTMLDivElement) {
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

function renderStatus(mix: Mix, dom: HTMLDivElement) {
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
    tr1.appendChild(document.createElement('td')).textContent = mix.pc.toString(10).padStart(4, '0');
    statusTable.appendChild(tr1);

    const tr2 = document.createElement('tr');
    tr2.appendChild(document.createElement('td')).textContent = 'CMP';
    tr2.appendChild(document.createElement('td')).textContent = mix.compare.toString();
    statusTable.appendChild(tr2);

    const tr3 = document.createElement('tr');
    tr3.appendChild(document.createElement('td')).textContent = 'OV';
    tr3.appendChild(document.createElement('td')).textContent = mix.overflow.toString();
    statusTable.appendChild(tr3);
}

document.addEventListener('DOMContentLoaded', init);