export const ExampleMixPrograms: Record<string, {src: string}> = {
}

const mixalPrograms: Record<string, string> = import.meta.glob('./*.mixal', {
    query: '?raw',
    eager: true,
    import: 'default',
});

for (const path in mixalPrograms) {
    ExampleMixPrograms[path] = {src: mixalPrograms[path]};
}

