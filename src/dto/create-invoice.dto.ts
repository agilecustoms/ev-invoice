import { Type } from 'class-transformer'

import {
  IsDateString,
  IsEmail, IsEnum,
  IsInt,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Min,
} from 'class-validator'

export enum OrderType {
  BRIDAL = 'Bridal',
  SPECIAL_OCCASION = 'Special Occasion',
  MAKEUP_LESSON = 'Makeup Lesson',
}

export enum OrderStatus {
  REQUESTED = 'Requested',
  EV_REPLIED = 'Ev Replied',
  CONFIRMED = 'Confirmed',
  DONE = 'Done',
  CANCELLED = 'Cancelled',
  UNAVAILABLE = 'Unavailable',
}

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

  @IsEnum(OrderType)
  orderType!: OrderType

  @IsEnum(OrderStatus)
  orderStatus!: OrderStatus

  @Min(0)
  @IsInt()
  @Type(() => Number)
  orderPrice!: number

  @Min(0)
  @IsInt()
  @Type(() => Number)
  orderDeposit!: number

  @IsString()
  orderAddress!: string

  @IsDateString({ strict: true }) // 2026-10-04T00:00:00.000Z - strict ISO 8601 format
  orderServiceDate!: string

  @IsString()
  orderCompletionTime!: string

  @IsString()
  orderServices!: string // not required when orderType is MAKEUP_LESSON
}
