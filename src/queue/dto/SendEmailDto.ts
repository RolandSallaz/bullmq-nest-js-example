import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  to!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  // 1–2: повторная попытка завершится успешно; 3: все попытки исчерпаны.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  failAttempts?: number;
}
