import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Habilitar CORS para o Frontend conseguir acessar depois
  app.enableCors();
  // Define a porta para 3001 (ou a variável de ambiente PORT)
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
