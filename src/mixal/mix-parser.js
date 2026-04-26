import * as fs from 'fs/promises';
import {parser} from "./parser.js";

const a = 'a'.charCodeAt(0);
for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(a + i);
    console.log(`${ch} {$[${ch}${ch.toUpperCase()}]}`);
}

fs.readFile('public/examples/coroutine-decode.ms').then(value => {
    const text = value.toString();
    const program = parser.parse(value.toString());
    const cur = program.cursor();
    let indent = '';
    cur.iterate((n) => {

        if (n.name === 'Comment' || n.name === 'LineComment') {
            if (n.from < n.to) {
                console.log(`${indent}Ent ${n.name} ${text.substring(n.from, n.to).trim()}`)
            }
        }
        if (n.type.isError) {
            console.log(`${indent}!Error `, n.name, n.type.isError, text.substring(n.from, n.to));
        }
        indent = indent + '    ';
    }, (n) => {
        indent = indent.slice(0, indent.length - 4);
        // console.log(`${indent}Lea ${n.name}`)
    });
})
