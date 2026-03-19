import { ApiPropertyOptional } from "@nestjs/swagger";
import { PNCP_PORTAL_PAGE_SIZE } from "@pncp/types";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class NoticeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modalityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipioId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publishedFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publishedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closingFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closingTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  estimatedValueMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  estimatedValueMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  @Min(1)
  page = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  @Min(10)
  @Max(100)
  pageSize = PNCP_PORTAL_PAGE_SIZE;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    "relevance",
    "publishedAt:desc",
    "closingAt:asc",
    "estimatedValue:desc",
    "estimatedValue:asc"
  ])
  sort = "publishedAt:desc";

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  onlyOpen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  onlyWithAttachments?: boolean;
}
