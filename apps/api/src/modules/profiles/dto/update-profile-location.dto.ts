import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { ProfileLocationInput } from '@iconicedu/shared-types';

export class UpdateProfileLocationDto implements ProfileLocationInput {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string | null;
}
