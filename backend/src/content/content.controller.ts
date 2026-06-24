import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { GenerateContentDto } from './dto/generate-content.dto';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(@Body() body: { teacherId: string } & GenerateContentDto) {
    const { teacherId, ...dto } = body;
    return this.contentService.generate(teacherId, dto);
  }

  @Post()
  async create(@Body() body: { teacherId: string } & CreateContentDto) {
    const { teacherId, ...dto } = body;
    return this.contentService.create(teacherId, dto);
  }

  @Get()
  async findAll(
    @Query('teacherId') teacherId: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('favorite') favorite?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contentService.findAll(teacherId, {
      search,
      type,
      favorite:
        favorite === 'true' ? true : favorite === 'false' ? false : undefined,
      sort,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('teacherId') teacherId: string,
  ) {
    return this.contentService.findOne(id, teacherId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { teacherId: string } & UpdateContentDto,
  ) {
    const { teacherId, ...dto } = body;
    return this.contentService.update(id, teacherId, dto);
  }

  @Patch(':id/favorite')
  async toggleFavorite(
    @Param('id') id: string,
    @Body() body: { teacherId: string },
  ) {
    return this.contentService.toggleFavorite(id, body.teacherId);
  }

  @Delete(':id')
  async softDelete(
    @Param('id') id: string,
    @Body() body: { teacherId: string },
  ) {
    return this.contentService.softDelete(id, body.teacherId);
  }
}
