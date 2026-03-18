import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AITrainingService } from './ai-training.service';
import { CreateTrainingRuleDto } from './dto/create-training-rule.dto';
import { UpdateTrainingRuleDto } from './dto/update-training-rule.dto';

@Controller('api/ai/training-rules')
export class AITrainingController {
  constructor(private readonly aiTrainingService: AITrainingService) {}

  @Get()
  getTrainingRules() {
    return this.aiTrainingService.getTrainingRules();
  }

  @Post()
  createTrainingRule(@Body() dto: CreateTrainingRuleDto) {
    return this.aiTrainingService.createTrainingRule(dto);
  }

  @Patch(':id')
  updateTrainingRule(@Param('id') id: string, @Body() dto: UpdateTrainingRuleDto) {
    return this.aiTrainingService.updateTrainingRule(id, dto);
  }

  @Delete(':id')
  deleteTrainingRule(@Param('id') id: string) {
    return this.aiTrainingService.deleteTrainingRule(id);
  }
}
