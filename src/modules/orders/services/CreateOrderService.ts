import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exist.');
    }

    const productsIds = products.map(product => ({ id: product.id }));

    const findProducts = await this.productsRepository.findAllById(productsIds);

    if (findProducts.length !== products.length) {
      throw new AppError('Some products do not exist');
    }

    // verificar se existe quantidade suficiente de cada produto
    const updatedQuantity: IUpdateProductsQuantityDTO[] = [];

    const updatedProducts = findProducts.map(foundProduct => {
      const orderedProduct = products.find(
        product => product.id === foundProduct.id,
      );

      if (orderedProduct) {
        if (foundProduct.quantity < orderedProduct.quantity) {
          throw new AppError(
            `Insuficient quantity for product ${foundProduct.name}`,
          );
        }

        updatedQuantity.push({
          id: orderedProduct.id,
          quantity: foundProduct.quantity - orderedProduct.quantity,
        });

        return {
          ...foundProduct,
          quantity: orderedProduct.quantity,
        };
      }

      return foundProduct;
    });

    // atualizar a quantidade de cada produto
    await this.productsRepository.updateQuantity(updatedQuantity);

    const order = await this.ordersRepository.create({
      customer,
      products: updatedProducts.map(product => ({
        product_id: product.id,
        price: product.price,
        quantity: product.quantity,
      })),
    });

    return order;
  }
}

export default CreateProductService;
