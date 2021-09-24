
/// <reference types="node" />

declare module 'benchmarkify' {
    class Benchmarkify {
        constructor(title?: string, opts?: any);
        printHeader(): Benchmarkify;
        createSuite(title?: string): Benchmarkify;
        add: (title: string, callback: (done: () => void) => void) => void;
        run: (arr: any[]) => Promise<void>;
    }

    export default Benchmarkify;
}