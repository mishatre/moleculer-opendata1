
import {Service, ServiceBroker} from "moleculer";
import Laboratory from '@moleculer/lab';


export default class LabService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "$lab",
            mixins: [Laboratory.AgentService],
            settings: {
                token: "secret",
                apiKey: "S0W1HPJ-R7CMHGA-N8WCFGR-V96P8MF"
            }
		});
	}
}