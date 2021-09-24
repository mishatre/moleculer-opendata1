
import Benchmarkify from 'benchmarkify';
import fs from 'fs';
import { Writable } from 'stream';
import { ServiceBroker } from "moleculer";
import Laboratory from '@moleculer/lab';

import config from './moleculer.config';

import pdfService from './services/pdf.service';


let benchmark = new Benchmarkify("Microservices benchmark").printHeader();
const bench = benchmark.createSuite("Call local actions");

(async function (){

    const broker = new ServiceBroker({
        ...config,
        // logLevel: 'error'
        metrics: {
            enabled: true,
            reporter: "Laboratory"
        },     

        tracing: {
            enabled: true,
            exporter: "Laboratory"
        },     

        logger: [{
            type: "Console",
            options: { /*...*/ }
            // @ts-ignore
        }, "Laboratory"],    
        
    });

    broker.createService({
        name: '$lab',
        mixins: [Laboratory.AgentService],
        settings: {
            token: "secret",
            apiKey: "S0W1HPJ-R7CMHGA-N8WCFGR-V96P8MF"
        }
    });

    broker.createService(pdfService);
    await broker.start();

    bench.add("Moleculer", done => {
        const file = fs.createReadStream('./test.pdf');
        const devNull = fs.createWriteStream('/dev/null');

        broker.call("pdf.convertToPng", file)
            .then((stream) => {
                devNull.on('close', () => {
                    // console.log('done');
                    done();
                });
                devNull.on('error', console.log);
                (stream as Writable).pipe(devNull)
            })
    });

    setTimeout(async () => {
        const result = await benchmark.run([bench]);
        console.log('Bench done');
        broker.stop();
    }, 5000)

    
        
})()
