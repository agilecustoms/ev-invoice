import { Temporal } from '@js-temporal/polyfill'
import { Transform, type TransformFnParams } from 'class-transformer'

import {
  IsEmail, IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ name: 'isTemporalPlainDate' })
class IsTemporalPlainDateConstraint implements ValidatorConstraintInterface {
  /**
   * AirTable date field arrives as 2026-10-04 (a date-time as 2026-10-04T00:00:00.000Z); PlainDate.from rejects
   * the time/offset part, so drop it first
   */
  static transform({ value }: TransformFnParams): unknown {
    try {
      return Temporal.PlainDate.from(value.split('T')[0])
    } catch {
      return value // let the validator report it, instead of throwing out of the transform step
    }
  }

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

/**
 * Order as loaded from AirTable (see AirTableClient.getOrder for the field mapping)
 */
export class OrderDto {
  @IsString()
  @IsNotEmpty()
  customerName!: string

  @IsEmail()
  customerEmail!: string

  @IsPhoneNumber('US')
  customerPhone!: string

  @Min(1)
  @IsInt()
  orderId!: number

  @IsEnum(OrderType)
  orderType!: OrderType

  @IsEnum(OrderStatus)
  orderStatus!: OrderStatus

  @Min(0)
  @IsInt()
  orderPrice!: number

  @Min(0)
  @IsInt()
  @IsOptional()
  orderDeposit?: number

  @IsString()
  @IsOptional()
  orderAddress?: string

  @Transform(IsTemporalPlainDateConstraint.transform)
  @Validate(IsTemporalPlainDateConstraint)
  orderServiceDate!: Temporal.PlainDate

  @IsString()
  orderCompletionTime!: string

  @IsString()
  @IsOptional()
  orderServices?: string // required for orderType Bridal, see InvoiceService
}
