"use strict";

import { Service as MoleculerService, Context } from "moleculer";
import { Action, Event, Method, Service } from "moleculer-decorators";

import { Readable, PassThrough, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import im from '../src/imagemagick-stream';
import Splitter from "../src/png-stream-splitter";
import { v4 as uuid } from 'uuid'

import gs from '../src/gs-stream';

interface ServiceSettings {
	bucketName: string
}

@Service({
	name: 'pdf',
	version: 1,
	dependencies: [
		'v1.s3'
	],
	settings: {
		bucketName: 'pdf'
	}
})
export default class PdfService extends MoleculerService<ServiceSettings> {

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

		} catch (error) {
			console.log(`Pipeline error`, error);
		}

	}

	@Method
	private async initStorage() {
		const bucketExist = await this.broker.call('v1.s3.bucketExists', {
			bucketName: this.settings.bucketName,
		});

		if (!bucketExist) {
			await this.broker.call('v1.s3.makeBucket', {
				bucketName: this.settings.bucketName,
				region: 'us-east-1',
			});
		}
	}

	public async started() {
		this.logger.info('started');
		await this.initStorage();
	}

	public async stopped() {
		await this.broker.call('v1.s3.removeBucket', {
			bucketName: this.settings.bucketName,
			region: 'us-east-1',
		});
	}

}