
import { Service as MoleculerService } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import Axios from 'axios';
import parse from 'csv-parse/lib/sync';


interface Certificate {

    unique_number: number;
    registration_number: string;
    registration_date: string;
    registration_date_end: string | null;
    name: string;
    applicant: string;
    applicant_address_post: string;
    applicant_address_legal: string;
    producer: string;
    producer_address_post: string;
    producer_address_legal: string;
    okp: string;
    class: string;
    appointment: string;
    kind: string;
    address_production: string;
    details: string;

}

interface CertificateMeta {
    id: string;
    title: string;
    subject: string;
    description: string;
    creator: string;
    format: string;
    created: string;
    modified: string;
    valid: string;
    current: string;
    previous: {

    }[]
}

interface Settings {
    META_URL: string;
}

@Service({
    name: 'certs',
})
export default class Certs extends MoleculerService<Settings> {

    settings = {

        META_URL: "https://roszdravnadzor.gov.ru/opendata/7710537160-medproducts/meta.csv"

    }

    @Action({})
    public async getCertificate() {}

    @Action({})
    public async getCertificates() {}

    @Action({})
    public async editCertificate() {}

    @Action({})
    public async addCertificate() {}

    @Action({})
    public async deleteCertificate() {}

    @Action({})
    public async attachFileToCertificate() {}

    @Action({})
    public async detachFileToCertificate() {}

    // @Method
    // private async updateCertificates() {

    //     const response = await Axios.get(this.settings.META_URL);
    //     data = parse(response.data, { columns: true })

    // }

    // @Method
    // private async getCertificatesMetaFile() {
    //     try {
    //         const response = await Axios.get(this.settings.META_URL);
    //         data = parse(response.data, { columns: true })
    //     }
    // }

    async started() {

        // await this.updateCertificates();


    }

}