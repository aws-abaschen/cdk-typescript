import { Architecture, Code, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import esbuild from 'esbuild';
import { writeFileSync } from "node:fs";


export interface NodetsLayerProps {
    name: string
}

export class NodetsLayer extends LayerVersion {

    constructor(scope: Construct, id: string, props: NodetsLayerProps) {
        const outModule = `out/${props.name}/nodejs/node_modules/@layer\\/${props.name}`;
        /*Build and bundle layers in functions/layers/nodejs with esbuild */
        esbuild.buildSync({
            entryPoints: [`src/layers/${props.name}/index.ts`],
            outfile: `${outModule}/index.mjs`,
            minify: true,
            banner: {
                js: 'import { createRequire } from \'module\'; const require = createRequire(import.meta.url);',
            },
            bundle: true,
            mainFields: ['module', 'main'],
            target: 'node18',
            platform: 'node',
            external: ['@aws-sdk/*', 'aws-lambda', '@layer/*'],
            format: 'esm',
        });
        // write package.json to file
        const packageJson = {
            name: `@layer/${props.name}`,
            version: '0.0.1',
            main: 'index.mjs'
        };
        writeFileSync(`${outModule}/package.json`, JSON.stringify(packageJson, null, 2));

        super(scope, id, {
            code: Code.fromAsset(`out/${props.name}`),
            compatibleRuntimes: [Runtime.NODEJS_16_X, Runtime.NODEJS_18_X],
            compatibleArchitectures: [Architecture.ARM_64, Architecture.X86_64],
            ...props
        });

    }
}