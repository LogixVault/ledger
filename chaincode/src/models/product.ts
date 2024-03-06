import { Object as FabricObject, Property } from 'fabric-contract-api';
import { ProductLocationData } from './product-location-data';

@FabricObject()
export class Product {
    @Property()
    id: string;

    @Property()
    name: string;

    @Property()
    category: string;

    @Property()
    price: number;

    @Property()
    stock: number;

    @Property()
    description: string;

    @Property('locationData', 'ProductLocationData')
    locationData: ProductLocationData;
}
