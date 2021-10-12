
const path = require('path');
const util = require('util');
const glob = require('glob');
const esbuild = require('esbuild');
const cp = require('child_process');

const paths = {
    services: path.resolve(__dirname, '../services/**/*.service.ts'),
    src: path.resolve(__dirname, '../src/**/*.ts'),
}

const globAsync = util.promisify(glob);

async function build() {

    const serviceFiles = await globAsync(paths.services);
    const srcFiles = await globAsync(paths.src);

    const { errors, warnings, stop } = await esbuild.build({
        entryPoints: [
            path.resolve(__dirname, '../moleculer.config.js'),
            ...serviceFiles,
            ...srcFiles,
        ],
        format: 'cjs',
        platform: 'node',
        outdir: './out',
        legalComments: 'none',
        watch: true,
    });

    cp.spawn('npm', ['run', 'start:es'], { shell: true });

}

build();
