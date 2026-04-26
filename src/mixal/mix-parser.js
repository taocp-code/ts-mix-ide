import * as fs from 'fs/promises';
import {parser} from "./parser.js";

fs.readFile('public/examples/halt-fill.ms').then(value => {
    const text = value.toString();
    const program = parser.parse(value.toString());
    const cur = program.cursor();
    cur.iterate((n) => {
        console.log('Entering', n.name, n.type.isError, text.substring(n.from, n.to));
    }, (n) => {
        console.log('Leaving', n.name);
    });
})
