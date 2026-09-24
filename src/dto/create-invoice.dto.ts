import { Type } from 'class-transformer'

import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPhoneNumber,
  IsString, Matches,
  Min,
} from 'class-validator'

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  customerName!: string

  @IsEmail()
  customerEmail!: string

  @IsPhoneNumber('US')
  customerPhone!: string

  @Min(1)
  @IsInt()
  @Type(() => Number)
  orderId!: number

  @Min(0)
  @IsInt()
  @Type(() => Number)
  orderPrice!: number

  @Min(0)
  @IsInt()
  @Type(() => Number)
  orderDeposit!: number

  @IsString()
  @IsNotEmpty()
  orderAddress!: string

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  orderServiceDate!: string

  @IsString()
  orderCompletionTime!: string

  @IsString()
  @IsNotEmpty()
  orderServices!: string
}
