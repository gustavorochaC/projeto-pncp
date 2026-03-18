import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PncpSyncDto {
  @ApiPropertyOptional({
    description: "Final date for PNCP query (yyyymmdd or ISO date)."
  })
  @IsOptional()
  @IsString()
  finalDate?: string;

  @ApiPropertyOptional({
    description: "Maximum number of pages to process in this execution."
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(10000)
  maxPages?: number;

  @ApiPropertyOptional({
    description: "Page size for PNCP query (10 to 50)."
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(10)
  @Max(50)
  pageSize?: number;
}
