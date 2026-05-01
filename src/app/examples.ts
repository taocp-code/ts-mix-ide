/**
 * List of example MIX asm programs
 */

const EXAMPLES_ROOT = '/examples';
function toPath(filename: string) {
    return `${EXAMPLES_ROOT}/${filename}`;
}

export const EXAMPLE_MIX_PROGRAMS: Record<string, { src: string, desc: string }> = {
    "Coroutine Decode": {
        src: toPath(`coroutine-decode.ms`),
        desc: 'Demonstrate how coroutines are used to translate input text like "1A2B." to "AAB BB .',
    },
    "Halt Fill": {
        src: toPath('halt-fill.ms'),
        desc: 'Fill all 4000 words with the HLT op and halt.',
    },
    "First 500 Primes": {
        src: toPath('table-of-primes.ms'),
        desc: 'Calculate and print the first 500 prime numbers.',
    },
    "The Mystery Program": {
        src: toPath('mystery.ms'),
        desc: 'Exercise 8 Ch 1.3.2 (Although the purpose of the exercise is not to use a computer to do it)'
    },
    "Maximum of 7 numbers": {
        src: toPath('maximum.ms'),
        desc: 'Converted from Program M in 1.3.2',
    },
    "Multiply permutations in cycle form": {
        src: toPath('cyclic-perm-multiplication.ms'),
        desc: 'Multiply permutations in cycle form.'
    }
};
