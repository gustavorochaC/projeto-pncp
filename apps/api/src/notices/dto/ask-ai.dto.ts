import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class AskAIDto {
  @ApiProperty({
    example: "Quais documentos são exigidos neste edital?"
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  question!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  userId?: string;

  @ApiPropertyOptional({
    enum: ["default", "participation_requirements"],
    example: "participation_requirements",
  })
  @IsOptional()
  @IsString()
  @IsIn(["default", "participation_requirements"])
  mode?: "default" | "participation_requirements";
}
