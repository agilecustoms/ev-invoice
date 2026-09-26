import { Temporal } from '@js-temporal/polyfill'
import { Transform, Type } from 'class-transformer'

import {
  IsEmail, IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ name: 'isTemporalPlainDate' })
class IsTemporalPlainDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value instanceof Temporal.PlainDate
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid ISO 8601 date-time string`
  }
}

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
  // AirTable record id of the order, used to write the invoice id back
  @Matches(/^rec[A-Za-z0-9]{14}$/, { message: 'recordId must be an AirTable record id (recXXXXXXXXXXXXXX)' })
  recordId!: string

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
  @IsOptional()
  @Type(() => Number)
  orderDeposit?: number

  @IsString()
  @IsOptional()
  orderAddress?: string

  // arrives as 2026-10-04T00:00:00.000Z; PlainDate.from rejects the time/offset part, so drop it first
  @Transform(({ value }) => {
    try {
      return Temporal.PlainDate.from(value.slice(0, value.indexOf('T')))
    } catch {
      return value // let the validator below report it, instead of throwing out of the transform step
    }
  })
  @Validate(IsTemporalPlainDateConstraint)
  orderServiceDate!: Temporal.PlainDate

  @IsString()
  orderCompletionTime!: string

  @IsString()
  @IsOptional()
  orderServices?: string // required for orderType Bridal, see InvoiceService
}
