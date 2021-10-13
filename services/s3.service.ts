
import { Service as MoleculerService } from "moleculer";
import MinioMixin from 'moleculer-minio';

import { Service } from "moleculer-decorators";

@Service({
    name: 's3',
    mixins: [MinioMixin],
})
export default class S3Service extends MoleculerService {
    settings = {
        endPoint: '192.168.1.250',
        port: 8333,
        useSSL: false,
        anonymous: true,
        minioHealthCheckInterval: null,
    }
};