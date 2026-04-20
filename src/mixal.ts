import * as fs from "fs/promises";
import {compile} from "./emulator/mix-asm.ts";
import {MixEmulator} from "./emulator/mix-emulator.ts";
import {
    CardPuncher,
    CardReader,
    consoleTextSink,
    createTextSource,
    type MixDevice,
    MixPrinter
} from "./emulator/io/mix-device.ts";

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
    let sourceFile = 'src/example-mix-programs/table-of-primes.mixal';
    if (process.argv.length > 2) {
        sourceFile = process.argv[2];
    }

    const content = await readAll(sourceFile);
    console.log(`Source file: ${sourceFile}, size: ${content.length} bytes.`);
    const program = compile(content);
    const devices: Record<number, MixDevice> = {};
    devices[16] = new CardReader(createTextSource(["A2B5E3426FG0ZYW3210PQ89R."]));
    devices[17] = new CardPuncher(consoleTextSink);
    devices[18] = new MixPrinter(consoleTextSink, () => Promise.resolve());
    const mix = new MixEmulator(devices);
    mix.loadProgram(program);
    const ips = await mix.run();
    console.log(`${ips} IPS`);
    console.log(`${mix.totalTime} MIX cycles`);
    console.log(mix.profile);
}

try {
    await main();
} catch (e) {
    console.error(e);
}