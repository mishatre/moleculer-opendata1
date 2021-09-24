
import {IncomingMessage} from "http";
import {Service, ServiceBroker, Context} from "moleculer";
import ApiGateway from "moleculer-web";

export default class ApiService extends Service {

	public constructor(broker: ServiceBroker) {
		super(broker);
		// @ts-ignore
		this.parseServiceSchema({
			name: "api",
			mixins: [ApiGateway],
			// More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html
			settings: {
				port: process.env.PORT || 3000,

				routes: [{
					path: "/",

					// whitelist: [
					// 	"*",
					// ],

					bodyParsers: false,

					// aliases: {
					// 	'POST getPdfAsImages': "stream:pdf.getPdfAsImages",
					// 	'GET list': 'pdf.list'
					// },

					// The auto-alias feature allows you to declare your route alias directly in your services.
					// The gateway will dynamically build the full routes from service schema.
					autoAliases: true,

					busboyConfig: {
						limits: { files: 1 }
						// Can be defined limit event handlers
						// `onPartsLimit`, `onFilesLimit` or `onFieldsLimit`
					},

					// Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
					mappingPolicy: "all", // Available values: "all", "restrict"

					// Enable/disable logging
					logging: true,
				}],
				// Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
				log4XXResponses: false,
				// Logging the request parameters. Set to any log level to enable it. E.g. "info"
				logRequestParams: null,
				// Logging the response data. Set to any log level to enable it. E.g. "info"
				logResponseData: null,
			},

			methods: {},

		});
	}
}