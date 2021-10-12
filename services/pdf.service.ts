"use strict";

import { Service as MoleculerService, ServiceBroker, Context} from "moleculer";
import { Action, Event, Method, Service } from "moleculer-decorators";

import Archiver from 'archiver';
import fs from 'fs';
import { Readable, PassThrough, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import im from '../src/imagemagick-stream';
import Splitter from "../src/png-stream-splitter";
import { v4 as uuid } from 'uuid'
// @ts-ignore
import gs from '../src/gs-stream';

@Service({
	name: 'pdf',
	version: 1,
	dependencies: [
		's3'
	]
})
export default class PdfService extends MoleculerService<{ bucketName: string }> {

	settings = {
		bucketName: 'pdf',
	}

	@Action({
		name: 'compress',
		rest: {
			method: 'POST',
			path: '/compress',
			// @ts-ignore
    		passReqResToParams: true,
			type: 'stream',
		},
		visibility: 'published'
	})
	public async compress(ctx: Context<any, any>) {

		const cDisp = ((ctx.params.$req.headers['content-disposition'] || '') as string).split(';')[1].substr('filename='.length + 1);

		ctx.meta.$responseHeaders = {
			'Content-Disposition': `attachment; filename=${cDisp}`
		};
		ctx.meta.$responseType = 'application/octet-stream';
		
		const output = new PassThrough();

		this.compressPdf(ctx.params, output);

		return output;

	}

	@Action({
		name: 'convert',
		rest: {
			method: 'POST',
			path: 'convert',
			//@ts-ignore
			type: 'stream',
		},
		visibility: 'published'
	})
	public async convert(ctx: Context<Readable, {
		$responseHeaders: { [key: string]: string },
		$responseType: string,
	}>) {

		ctx.meta.$responseHeaders = {
			'Content-Disposition': "attachment; filename=converted.zip"
		};
		ctx.meta.$responseType = 'application/zip';
		
		return this.convertPdf(ctx.params);
	}

	@Action({
		name: 'create',
		rest: {
			method: 'POST',
			path: '/create'
		},
		visibility: 'public',
	})
	public async create(ctx: Context<any>) {
		
	}

	// Action
	public convertPdf(stream: Readable) {

		const id = uuid()

		// const archive = Archiver('zip');
		// archive.on('error', (error: unknown) => console.log(error))
	
		const splitter = new Splitter();
		splitter.on('data', (stream: Readable, index: number) => {

			this.broker.call('s3.putObject', stream, {
				meta: {
					bucketName: this.settings.bucketName,
					objectName: `${id}/${index}.png`
				}
			})

			// archive.append(stream, { name: `${index}.png` });
		});

		splitter.on('end', () => {
			this.logger.warn('Stream end')
		})

		pipeline(
			stream,
			this.getConvertCommandStream(),
			splitter,
			// (err) => {
			// 	if(err) {
			// 		console.log(`Pipline error:`, err);
			// 	} else {
			// 		// archive.finalize();
			// 	}
			// }
		)

		return id;
		// return archive;
	}


	private getConvertCommandStream() {
		return im()
			.density(300)
			.depth(8)
			.quality(85)
			.outputFormat('png');
	}

	@Method
	private async compressPdf(input: Readable, output: Writable) {

		try {

			await pipeline(
				input,
				gs().compress(150),
				output
			)

			console.log('File compressed');

		} catch(error) {
			console.log(`Pipeline error`, error);
		}

	}

	public async started() {

		this.logger.info('started');

		const bucketExist = await this.broker.call('s3.bucketExists', {
			bucketName: 'pdf',
		});

		if(!bucketExist) {
			await this.broker.call('s3.makeBucket', {
				bucketName: this.settings.bucketName,
				region: 'us-east-1',
			});
		}

	}

	public async stopped() {
		await this.broker.call('s3.removeBucket', {
			bucketName: this.settings.bucketName,
			region: 'us-east-1',
		});
	}

}