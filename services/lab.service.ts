
import { Service as MoleculerService } from "moleculer";
import { Service } from 'moleculer-decorators';
import Laboratory from '@moleculer/lab';

@Service({
	name: "$lab",
	mixins: [Laboratory.AgentService],
	settings: {
		token: "secret",
		apiKey: "S0W1HPJ-R7CMHGA-N8WCFGR-V96P8MF"
	}
})
export default class LabService extends MoleculerService { }