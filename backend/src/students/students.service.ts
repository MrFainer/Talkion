import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import * as xlsx from 'xlsx';

@Injectable()
export class StudentsService {
  private readonly minWhatsappLength = 12;
  private readonly maxWhatsappLength = 13;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService
  ) {}

  private normalizeFullName(name: string) {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) =>
        part
          .toLowerCase()
          .split(/([-'])/)
          .map((chunk) =>
            chunk === '-' || chunk === "'"
              ? chunk
              : chunk.charAt(0).toUpperCase() + chunk.slice(1),
          )
          .join(''),
      )
      .join(' ');
  }

  private normalizeWhatsappNumber(value: string) {
    return String(value || '').replace(/\D/g, '');
  }

  private isWhatsappNumberLengthValid(number: string) {
    return (
      number.length >= this.minWhatsappLength &&
      number.length <= this.maxWhatsappLength
    );
  }

  private ensureWhatsappNumberLength(number: string) {
    if (!this.isWhatsappNumberLengthValid(number)) {
      throw new BadRequestException(
        `O número de WhatsApp deve ter entre ${this.minWhatsappLength} e ${this.maxWhatsappLength} dígitos, incluindo DDI e DDD.`,
      );
    }
  }

  private normalizeLevel(levelRaw: unknown) {
    const normalizedLevel = String(levelRaw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let level: any = 'LEVEL_1';
    if (normalizedLevel.includes('2') || normalizedLevel === 'intermediario') {
      level = 'LEVEL_2';
    } else if (normalizedLevel.includes('3') || normalizedLevel === 'avancado') {
      level = 'LEVEL_3';
    }

    return level;
  }

  async list(teacherId: string) {
    const students = await this.prisma.student.findMany({
      where: { teacher_id: teacherId },
      orderBy: { created_at: 'desc' },
    });

    if (students.length === 0) return [];

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const sentToday = await this.prisma.whatsappMessage.findMany({
      where: {
        student_id: { in: students.map((s) => s.id) },
        direction: 'OUTGOING',
        content_kind: 'PRIVATE_BROADCAST_NEWS',
        created_at: { gte: startOfDay, lte: endOfDay },
      },
      select: { student_id: true },
      distinct: ['student_id'],
    });

    const sentStudentIds = new Set(
      sentToday.map((m) => m.student_id).filter(Boolean) as string[],
    );

    return students.map((student) => ({
      ...student,
      received_news_today: sentStudentIds.has(student.id),
    }));
  }

  async create(teacherId: string, data: { fullName: string; whatsappNumber: string; englishLevel?: any; receivePrivateNews?: boolean }) {
    const normalizedName = this.normalizeFullName(data.fullName || '');
    if (!normalizedName) {
      throw new BadRequestException('Informe o nome completo do aluno.');
    }

    const rawNumber = this.normalizeWhatsappNumber(data.whatsappNumber);
    this.ensureWhatsappNumberLength(rawNumber);

    const existingStudent = await this.prisma.student.findUnique({
      where: { whatsapp_number: rawNumber },
    });

    if (existingStudent) {
      throw new BadRequestException(
        'Este número de WhatsApp já está cadastrado para outro aluno.',
      );
    }
    
    // Verifica se o número existe no WhatsApp
    const isValid = await this.whatsappService.checkNumber(teacherId, rawNumber);

    return this.prisma.student.create({
      data: {
        teacher_id: teacherId,
        full_name: normalizedName,
        whatsapp_number: rawNumber,
        whatsapp_valid: isValid,
        english_level: data.englishLevel || 'LEVEL_1',
        receive_private_news: data.receivePrivateNews || false,
      },
    });
  }

  async toggleActive(teacherId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.teacher_id !== teacherId) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    return this.prisma.student.update({
      where: { id: studentId },
      data: { active: !student.active },
    });
  }

  async updateLevel(teacherId: string, studentId: string, level: any) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.teacher_id !== teacherId) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    return this.prisma.student.update({
      where: { id: studentId },
      data: { english_level: level },
    });
  }

  async togglePrivateNews(teacherId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.teacher_id !== teacherId) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    return this.prisma.student.update({
      where: { id: studentId },
      data: { receive_private_news: !student.receive_private_news },
    });
  }

  async importExcel(teacherId: string, file: Express.Multer.File) {
    try {
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet) as any[];

      if (rows.length === 0) {
        throw new BadRequestException('A planilha está vazia.');
      }

      const parsedStudents: Array<{
        teacher_id: string;
        full_name: string;
        whatsapp_number: string;
        english_level: any;
      }> = [];
      const failedRows: Array<{
        rowNumber: number;
        fullName: string;
        whatsappNumber: string;
        reason: string;
      }> = [];
      const seenNumbers = new Set<string>();
      let skippedInvalidCount = 0;
      let skippedDuplicatedInFileCount = 0;

      for (const [index, row] of rows.entries()) {
        const name = row['Nome'] || row['nome'] || row['Name'] || row['name'] || row['NOME'];
        let phone = row['WhatsApp'] || row['whatsapp'] || row['Telefone'] || row['telefone'] || row['Phone'] || row['WHATSAPP'];
        const levelRaw = row['Nível'] || row['nivel'] || row['Level'] || row['level'] || row['NÍVEL'] || row['NIVEL'];
        const rowNumber = index + 2;

        if (!name || !phone) {
          skippedInvalidCount++;
          failedRows.push({
            rowNumber,
            fullName: String(name || '').trim(),
            whatsappNumber: String(phone || '').trim(),
            reason: 'Linha sem nome ou número de WhatsApp.',
          });
          continue;
        }

        const normalizedName = this.normalizeFullName(String(name));
        phone = this.normalizeWhatsappNumber(phone);

        if (!normalizedName || !phone) {
          skippedInvalidCount++;
          failedRows.push({
            rowNumber,
            fullName: normalizedName,
            whatsappNumber: String(phone || '').trim(),
            reason: 'Linha sem nome ou número de WhatsApp válido.',
          });
          continue;
        }

        if (!this.isWhatsappNumberLengthValid(phone)) {
          skippedInvalidCount++;
          failedRows.push({
            rowNumber,
            fullName: normalizedName,
            whatsappNumber: phone,
            reason: `Número com quantidade inválida de dígitos. Use entre ${this.minWhatsappLength} e ${this.maxWhatsappLength} dígitos com DDI e DDD.`,
          });
          continue;
        }

        if (seenNumbers.has(phone)) {
          skippedDuplicatedInFileCount++;
          failedRows.push({
            rowNumber,
            fullName: normalizedName,
            whatsappNumber: phone,
            reason: 'Número duplicado na própria planilha.',
          });
          continue;
        }

        seenNumbers.add(phone);

        parsedStudents.push({
          teacher_id: teacherId,
          full_name: normalizedName,
          whatsapp_number: phone,
          english_level: this.normalizeLevel(levelRaw),
        });
      }

      const existingStudents = await this.prisma.student.findMany({
        where: {
          whatsapp_number: {
            in: Array.from(seenNumbers),
          },
        },
        select: {
          whatsapp_number: true,
        },
      });

      const existingNumbers = new Set(existingStudents.map((student) => student.whatsapp_number));
      const studentsToValidate = parsedStudents.filter((student) => {
        if (existingNumbers.has(student.whatsapp_number)) {
          failedRows.push({
            rowNumber:
              rows.findIndex((row) => {
                const phone =
                  row['WhatsApp'] ||
                  row['whatsapp'] ||
                  row['Telefone'] ||
                  row['telefone'] ||
                  row['Phone'] ||
                  row['WHATSAPP'];
                return (
                  this.normalizeWhatsappNumber(phone) === student.whatsapp_number
                );
              }) + 2,
            fullName: student.full_name,
            whatsappNumber: student.whatsapp_number,
            reason: 'Aluno já cadastrado na base de dados.',
          });
          return false;
        }

        return true;
      });
      const skippedExistingCount = parsedStudents.length - studentsToValidate.length;

      const studentsToCreate = [];
      for (const student of studentsToValidate) {
        const isValid = await this.whatsappService.checkNumber(
          teacherId,
          student.whatsapp_number,
        );

        studentsToCreate.push({
          ...student,
          whatsapp_valid: isValid,
        });
      }

      const result =
        studentsToCreate.length > 0
          ? await this.prisma.student.createMany({
              data: studentsToCreate,
              skipDuplicates: true,
            })
          : { count: 0 };

      return {
        importedCount: result.count,
        skippedExistingCount,
        skippedDuplicatedInFileCount,
        skippedInvalidCount,
        totalRows: rows.length,
        failedRows,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Erro ao processar a planilha. Verifique se o formato é válido (.xlsx, .xls).');
    }
  }

  async updateNumber(teacherId: string, studentId: string, newNumber: string) {
    const normalizedNumber = this.normalizeWhatsappNumber(newNumber);

    if (!normalizedNumber) {
      throw new BadRequestException('Número de WhatsApp inválido.');
    }

    this.ensureWhatsappNumberLength(normalizedNumber);

    // Verifica se já existe um aluno com esse número
    const existing = await this.prisma.student.findUnique({
      where: { whatsapp_number: normalizedNumber }
    });

    if (existing && existing.id !== studentId) {
      throw new BadRequestException('Este número de WhatsApp já está cadastrado para outro aluno.');
    }

    // Verifica se o novo número existe no WhatsApp
    const isValid = await this.whatsappService.checkNumber(teacherId, normalizedNumber);

    return this.prisma.student.update({
      where: {
        id: studentId,
        teacher_id: teacherId,
      },
      data: {
        whatsapp_number: normalizedNumber,
        whatsapp_valid: isValid,
      },
    });
  }

  async remove(teacherId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.teacher_id !== teacherId) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    await this.prisma.student.delete({
      where: { id: studentId },
    });

    return { success: true };
  }

  async validateNumber(teacherId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student || student.teacher_id !== teacherId) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    const isValid = await this.whatsappService.checkNumber(teacherId, student.whatsapp_number);

    const updatedStudent = await this.prisma.student.update({
      where: { id: studentId },
      data: { whatsapp_valid: isValid },
    });

    return { 
      isValid, 
      student: updatedStudent 
    };
  }
}
