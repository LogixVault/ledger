/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context } from 'fabric-contract-api';
import { ChaincodeStub, ClientIdentity } from 'fabric-shim';
import { ProductSupplyChainContract } from '.';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import winston = require('winston');
import { Product } from './models/product';
import { ProductLocationData } from './models/product-location-data';
import { ProductLocationEntry } from './models/product-location-entry';
import { describe } from 'mocha';

chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);

class TestContext implements Context {
    public stub: sinon.SinonStubbedInstance<ChaincodeStub> = sinon.createStubInstance(ChaincodeStub);
    public clientIdentity: sinon.SinonStubbedInstance<ClientIdentity> = sinon.createStubInstance(ClientIdentity);
    public logger = {
        getLogger: sinon.stub().returns(sinon.createStubInstance(winston.createLogger().constructor)),
        setLevel: sinon.stub(),
     };
}

const createNewProduct = () => {
    const product = new Product();
    product.id = '1003';
    product.name = 'Maruti Dzire';
    product.category = 'Car';
    product.price = 100;
    product.stock = 10;

    const locationData = new ProductLocationData();
    locationData.current = new ProductLocationEntry({
        arrivalDate: '2021-06-30T18:00:58.511Z',
        participant: 'Retailer',
    });
    locationData.previous = [
        new ProductLocationEntry({
            arrivalDate: '2021-06-24T18:25:43.511Z',
            participant: 'Distributor',
        }),
        new ProductLocationEntry({
            arrivalDate: '2021-06-25T09:05:12.511Z',
            participant: 'Manufacturer',
        }),
    ];
    product.locationData = locationData;

    return product;
};

describe('ProductSupplyChainContract', () => {

    let contract: ProductSupplyChainContract;
    let ctx: TestContext;

    beforeEach(() => {
        contract = new ProductSupplyChainContract();
        ctx = new TestContext();
        ctx.stub.getState.withArgs('1001').resolves(Buffer.from(`{
            "id": "1001",
            "name": "Maruti Dzire",
            "category": "Car",
            "price": 100,
            "stock": 10,
            "locationData": {
                "current": {
                    "arrivalDate": "2021-06-30T18:00:58.511Z",
                    "participant": "Retailer"
                },
                "previous": [
                    {
                        "arrivalDate": "2021-06-24T18:25:43.511Z",
                        "participant": "Distributor"
                    },
                    {
                        "arrivalDate": "2021-06-25T09:05:12.511Z",
                        "participant": "Manufacturer"
                    }
                ]
            }
        }`));
        ctx.stub.getState.withArgs('1002').resolves(Buffer.from(`{
            "id": "1002",
            "name": "Maruti Alto",
            "category": "Car",
            "price": 100,
            "stock": 10,
            "locationData": {
                "current": {
                    "arrivalDate": "2021-06-30T18:00:58.511Z",
                    "participant": "Retailer"
                },
                "previous": [
                    {
                        "arrivalDate": "2021-06-24T18:25:43.511Z",
                        "participant": "Distributor"
                    },
                    {
                        "arrivalDate": "2021-06-25T09:05:12.511Z",
                        "participant": "Manufacturer"
                    }
                ]
            }
        }`));
    });

    describe('#productExists', () => {
        it('should return true for a product', async () => {
            await contract.productExists(ctx, '1001').should.eventually.be.true;
        });

        it('should return false for a product that does not exist', async () => {
            await contract.productExists(ctx, '1003').should.eventually.be.false;
        });
    });

    describe('#createProduct', () => {
        it('should create a product', async () => {
            const product = createNewProduct();

            await contract.createProduct(ctx, JSON.stringify(product));

            ctx.stub.putState.should.have.been.calledOnceWith('1003');
        });

        it('should throw an error for a product that already exists', async () => {
            const product = createNewProduct();
            product.id = '1001';
            await contract.createProduct(ctx, JSON.stringify(product)).should.be.rejectedWith(/The product 1001 already exists./);
        });

        it('should throw an error for a product with missing id', async () => {
            const product = createNewProduct();
            product.id = '';
            await contract.createProduct(ctx, JSON.stringify(product)).should.be.rejectedWith(/The 'id' field is required./);
        });

        it('should throw an error for a product with missing name', async () => {
            const product = createNewProduct();
            product.name = '';
            await contract.createProduct(ctx, JSON.stringify(product)).should.be.rejectedWith(/The 'name' field is required./);
        });
    });

    describe('#shipProductTo', () => {
        it('should change current product location data to a new one', async () => {
            // arrange
            const productId = '1001';
            const newParticipant = 'New Location';
            const newLocationArrivalDate = '2021-07-01T18:00:58.511Z';

            // act
            await contract.shipProductTo(ctx, productId, newParticipant, newLocationArrivalDate);

            // assert
            ctx.stub.putState.should.have.been.calledWith(productId, sinon.match((data: Buffer) => {
                const updatedProduct = JSON.parse(data.toString()) as Product;
                return updatedProduct.locationData.current.participant === newParticipant &&
                    updatedProduct.locationData.current.arrivalDate === newLocationArrivalDate;
            }));
        });

        it('should move old location to the "previous" collection', async () => {
            // arrange
            const productId = '1001';
            const prevParticipant = 'Distributor';
            const prevParticipantArrivalDate = '2021-06-30T18:00:58.511Z';
            const product = new Product();
            product.id = '1001';
            product.name = 'Maruti Dzire';
            product.category = 'Car';
            product.price = 100;
            product.stock = 10;

            const locationData = new ProductLocationData();
            locationData.current = new ProductLocationEntry({
                arrivalDate: prevParticipantArrivalDate,
                participant: prevParticipant,
            });
            locationData.previous = [];
            product.locationData = locationData;

            ctx.stub.getState.withArgs('1001').resolves(Buffer.from(JSON.stringify(product)));

            // act
            await contract.shipProductTo(ctx, productId, 'Retailer', '2021-07-01T18:00:58.511Z');

            // assert
            ctx.stub.putState.should.have.been.calledWith(productId, sinon.match((data: Buffer) => {
                const updatedProduct = JSON.parse(data.toString()) as Product;
                const lastElementIndex = updatedProduct.locationData.previous.length - 1;

                return updatedProduct.locationData.previous[lastElementIndex].arrivalDate === prevParticipantArrivalDate
                    && updatedProduct.locationData.previous[lastElementIndex].participant === prevParticipant;
            }));
        });

        it('should throw an error for a product that does not exist', async () => {
            await contract.shipProductTo(ctx, '1003', 'New Location', '2021-06-24T18:25:43.511Z').should.be.rejectedWith(/The product 1003 does not exist./);
        });

        it('should throw an error if new location is empty', async () => {
            await contract.shipProductTo(ctx, '1001', '', '2021-06-24T18:25:43.511Z').should.be.rejectedWith(/The 'newLocation' field is required./);
        });

        it('should throw an error if new location arrival date is empty', async () => {
            await contract.shipProductTo(ctx, '1001', 'New Location', '').should.be.rejectedWith(/The 'arrivalDate' field is required./);
        });
    });

    describe('#getProduct', () => {
        it('should return a product', async () => {
            const expectedProduct = new Product();
            expectedProduct.id = '1001';
            expectedProduct.name = 'Maruti Dzire';
            expectedProduct.category = 'Car';
            expectedProduct.price = 100;
            expectedProduct.stock = 10;

            const locationData = new ProductLocationData();
            locationData.current = new ProductLocationEntry({
                arrivalDate: '2021-06-30T18:00:58.511Z',
                participant: 'Retailer',
            });
            locationData.previous = [];
            expectedProduct.locationData = locationData;

            await contract.getProduct(ctx, '1001').should.eventually.deep.equal(expectedProduct);
        });

        it('should throw an error for a product that does not exist', async () => {
            await contract.getProduct(ctx, '1003').should.be.rejectedWith(/The product 1003 does not exist./);
        });
    });
});
