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

function renderWord(word: MixWord, tr: HTMLTableRowElement, size: number = MIX_WORD_SIZE+1) {
    const uiFields: HTMLElement[] = [];
    const sign = document.createElement('td');
    sign.className = `sign label-${word.label} f-0`;
    tr.appendChild(sign).textContent = word.sign > 0 ? '+' : '-';
    let c = 0;
    const skip = MIX_WORD_SIZE + 1 - size;
    for (const b of word) {
        uiFields.push(document.createElement('td'));
        if (c++ < skip) {
            continue;
        }
        const td = document.createElement('td');
        td.className = `byte label-${word.label} f-${c}`;
        uiFields.push(td);
        tr.appendChild(td).textContent = b.toString(10).padStart(2, '0');
    }
    word.onChange((e) => {
        console.log('word change', e.word.label);
        sign.textContent = e.word.sign > 0 ? '+' : '-';
        let i = 0;
        for (const b of e.word) {
            console.log('byte change', e.field, b, i);
            if (i++ < MIX_WORD_SIZE + 1 - size) continue;
            uiFields[i-1].textContent = b.toString(10).padStart(2, '0');
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
    renderWord(mix.rI1, contents, 3);
    renderWord(mix.rI2, contents, 3);
    renderWord(mix.rI3, contents, 3);
    renderWord(mix.rI4, contents, 3);
    renderWord(mix.rI5, contents, 3);
    renderWord(mix.rI6, contents, 3);
    renderWord(mix.rJ, contents, 3);
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