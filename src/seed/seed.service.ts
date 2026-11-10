import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from '../users/user.schema';
import { Product, ProductDocument, ProductCategory } from '../products/product.schema';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async onModuleInit() {
    // Em produção o seed automático fica desligado para nunca criar
    // usuários com senhas padrão (admin/admin123). Use `npm run seed:full`
    // de forma explícita (ou SEED_ON_BOOT=true numa primeira subida).
    if (process.env.SEED_ON_BOOT === 'false') return;
    if (process.env.NODE_ENV === 'production' && process.env.SEED_ON_BOOT !== 'true') {
      console.log('ℹ️  Seed automático desativado em produção.');
      return;
    }
    await this.seedUsers();
    await this.seedProducts();
  }

  private async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private async seedUsers() {
    const count = await this.userModel.countDocuments();
    if (count > 0) return;

    const passwordHash = await this.hashPassword('admin123');
    const admin = new this.userModel({
      name: 'Administrador',
      username: 'admin',
      passwordHash,
      role: UserRole.ADMIN,
    });
    await admin.save();

    const responsavelHash = await this.hashPassword('resp123');
    const responsavel = new this.userModel({
      name: 'Responsável',
      username: 'responsavel',
      passwordHash: responsavelHash,
      role: UserRole.RESPONSAVEL,
    });
    await responsavel.save();

    const atendenteHash = await this.hashPassword('atend123');
    const atendente = new this.userModel({
      name: 'Atendente',
      username: 'atendente',
      passwordHash: atendenteHash,
      role: UserRole.ATENDENTE,
    });
    await atendente.save();

    console.log('✅ Usuários criados: admin/admin123, responsavel/resp123, atendente/atend123');
  }

  private async seedProducts() {
    const count = await this.productModel.countDocuments();
    if (count > 0) return;

    const products = [
      // Coco gelado - produto principal
      { name: 'Coco Gelado', category: ProductCategory.COCO, priceCents: 800, unit: 'un', requiresPrep: true, trackStock: true, stockQty: 50 },
      { name: 'Coco Gelado Grande', category: ProductCategory.COCO, priceCents: 1000, unit: 'un', requiresPrep: true, trackStock: true, stockQty: 30 },
      
      // Café da manhã
      { name: 'Café Coado', category: ProductCategory.CAFE_DA_MANHA, priceCents: 300, unit: 'un', requiresPrep: false, trackStock: false },
      { name: 'Pão de Queijo', category: ProductCategory.CAFE_DA_MANHA, priceCents: 500, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 40 },
      { name: 'Misto Quente', category: ProductCategory.CAFE_DA_MANHA, priceCents: 700, unit: 'un', requiresPrep: true, trackStock: false },
      
      // Almoço
      { name: 'PF Completo', category: ProductCategory.ALMOCO, priceCents: 1800, unit: 'un', requiresPrep: true, trackStock: false },
      { name: 'Marmitinha', category: ProductCategory.ALMOCO, priceCents: 1200, unit: 'un', requiresPrep: true, trackStock: false },
      
      // Petiscos
      { name: 'Batata Frita', category: ProductCategory.PETISCOS, priceCents: 900, unit: 'porção', requiresPrep: true, trackStock: false },
      { name: 'Pastel', category: ProductCategory.PETISCOS, priceCents: 600, unit: 'un', requiresPrep: true, trackStock: false },
      
      // Drinks
      { name: 'Água Mineral', category: ProductCategory.DRINKS, priceCents: 300, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 60 },
      { name: 'Refrigerante Lata', category: ProductCategory.DRINKS, priceCents: 500, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 48 },
      { name: 'Suco Natural', category: ProductCategory.DRINKS, priceCents: 600, unit: 'un', requiresPrep: true, trackStock: false },
    ];

    for (const p of products) {
      const product = new this.productModel(p);
      await product.save();
    }

    console.log('✅ Produtos de exemplo criados');
  }

  async runManualSeed() {
    await this.seedUsers();
    await this.seedProducts();
    return { message: 'Seed executado com sucesso' };
  }
}