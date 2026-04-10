import * as fs from "fs/promises";
import {compile} from "./mix/mix-asm.ts";
import {MixEmulator} from "./mix/mix-emulator.ts";

async function readAll(filename: string) {
    const fin = await fs.open(filename);
    try {
        const lines: string[] = [];
        for await (const line of fin.readLines()) {
            lines.push(line);
        }
        return lines.join('\n');
    } finally {
        await fin.close();
    }
}

async function main() {
    let sourceFile = 'src/mix-programs/table-of-primes.mixal';
    if (process.argv.length > 2) {
        sourceFile = process.argv[2];
    }

    const content = await readAll(sourceFile);
    console.log(`Source file: ${sourceFile}, size: ${content.length} bytes.`);
    const program = compile(content);
    const mix = new MixEmulator();
    mix.loadProgram(program);
}

try {
    await main();
} catch (e) {
    console.error(e);
}