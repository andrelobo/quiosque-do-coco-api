#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedDataService } from './seed-data.service';

async function bootstrap() {
  console.log('🌱 Iniciando seed completo do banco de dados...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  
  const seedService = app.get(SeedDataService);
  
  try {
    await seedService.runFullSeed();
    console.log('\n✅ Seed completo executado com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro durante o seed:', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();