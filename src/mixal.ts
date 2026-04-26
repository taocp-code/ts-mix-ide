import * as fs from "fs/promises";
import * as readline from 'readline/promises';
import {compile} from "./mixal/mix-asm.ts";
import {MixEmulator} from "./emulator/mix-emulator.ts";
import {
    CardPuncher,
    CardReader,
    consoleTextSink,
    createTextSource,
    MixDeviceRegistry,
    LinePrinter,
    TeletypeWriter
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
    const mix = new MixEmulator();

    console.log("\"" + mix.ops.sort().join("\"|\"") + "\"");

    const deviceRegistry: MixDeviceRegistry = mix.deviceRegistry;
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    deviceRegistry.register(new CardReader(createTextSource(["A2B5E3426FG0ZYW3210PQ89R."])));
    deviceRegistry.register(new CardPuncher(consoleTextSink));
    deviceRegistry.register(new LinePrinter(consoleTextSink, async () => {
        rl.write("=== NEW PATE ===\n");
    }));
    deviceRegistry.register(new TeletypeWriter(consoleTextSink, async (n) => {
        const line = await rl.question("MIX waiting for teletype writer: \n");
        if (line.length > n) return line.slice(0, n);
        if (line.length < n) return line.padEnd(n, ' ');
        return line;
    }));

    mix.loadProgram(program);
    const ips = await mix.run();
    console.log(`${ips} IPS`);
    console.log(`${mix.totalTime} MIX cycles`);
    console.log(`${mix.state.instructions} INS`);
    rl.close();
}

try {
    await main();
} catch (e) {
    console.error(e);
}