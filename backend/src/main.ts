import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Habilitar CORS para o Frontend (que rodará na 3000 por padrão) conseguir acessar depois
  app.enableCors({
    origin: true, // Permite qualquer origem durante o desenvolvimento (incluindo túneis)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  // Define a porta para 3001 (ou a variável de ambiente PORT)
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
