import * as fs from 'fs/promises';
import {parser} from "./parser.js";

fs.readFile('public/examples/table-of-primes.ms').then(value => {
    const text = value.toString();
    const program = parser.parse(value.toString());
    const cur = program.cursor();
    let indent = '';
    cur.iterate((n) => {

        if (n.name === 'Comment' || n.name === 'LineComment') {
            if (n.from < n.to) {
                console.log(`${indent}Ent ${n.name} ${text.substring(n.from, n.to).trim()}`)
            }
        } else if (n.name === 'ALF_Text') {
            console.log(`ALF Text: |${text.substring(n.from, n.to)}|`);
        }
        if (n.type.isError) {
            console.log(`${indent}!Error `, n.name, n.type.isError, text.substring(n.from, n.to));
        }
        indent = indent + '    ';
    }, (_n) => {
        indent = indent.slice(0, indent.length - 4);
        // console.log(`${indent}Lea ${n.name}`)
    });
})
