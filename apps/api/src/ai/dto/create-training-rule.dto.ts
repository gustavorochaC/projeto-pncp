import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTrainingRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
}
