import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import type { AITrainingRuleItem } from '@pncp/types';
import type { CreateTrainingRuleDto } from './dto/create-training-rule.dto';
import type { UpdateTrainingRuleDto } from './dto/update-training-rule.dto';

const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class AITrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrainingRules(): Promise<AITrainingRuleItem[]> {
    const rules = await this.prisma.aITrainingRule.findMany({
      where: { userId: PLACEHOLDER_USER_ID },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return rules.map(r => ({
      id: r.id,
      name: r.name,
      content: r.content,
      isActive: r.isActive,
      priority: r.priority,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createTrainingRule(dto: CreateTrainingRuleDto): Promise<AITrainingRuleItem> {
    const rule = await this.prisma.aITrainingRule.create({
      data: {
        userId: PLACEHOLDER_USER_ID,
        name: dto.name,
        content: dto.content,
      },
    });

    return {
      id: rule.id,
      name: rule.name,
      content: rule.content,
      isActive: rule.isActive,
      priority: rule.priority,
      createdAt: rule.createdAt.toISOString(),
    };
  }

  async updateTrainingRule(id: string, dto: UpdateTrainingRuleDto): Promise<AITrainingRuleItem> {
    const rule = await this.prisma.aITrainingRule.update({
      where: { id },
      data: dto,
    });

    return {
      id: rule.id,
      name: rule.name,
      content: rule.content,
      isActive: rule.isActive,
      priority: rule.priority,
      createdAt: rule.createdAt.toISOString(),
    };
  }

  async deleteTrainingRule(id: string): Promise<void> {
    await this.prisma.aITrainingRule.delete({ where: { id } });
  }
}
