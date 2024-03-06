import { Object as FabricObject, Property } from 'fabric-contract-api';

@FabricObject()
export class ProductLocationEntry {
    constructor(obj?: Partial<ProductLocationEntry>) {
        Object.assign(this, obj);
    }

    @Property()
    participant: string;

    @Property()
    arrivalDate: string;
}
