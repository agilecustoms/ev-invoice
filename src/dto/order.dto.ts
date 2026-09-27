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
   * AirTable date field arrives as 2026-10-04
   */
  static transform({ value }: TransformFnParams): unknown {
    try {
      return Temporal.PlainDate.from(value)
    } catch {
      return value // let the validator report it, instead of throwing out of the transform step
    }
  }

  validate(value: unknown): boolean {
    return value instanceof Temporal.PlainDate
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid ISO 8601 date (YYYY-MM-DD)`
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
  // AirTable record id (recXXXXXXXXXXXXXX), set from the record itself, not from its fields
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
  id!: number // AirTable ID field (autonumber)

  @IsEnum(OrderType)
  type!: OrderType

  @IsEnum(OrderStatus)
  status!: OrderStatus

  @Min(0)
  @IsInt()
  price!: number

  @Min(0)
  @IsInt()
  @IsOptional()
  deposit?: number

  @IsString()
  @IsOptional()
  address?: string

  @Transform(IsTemporalPlainDateConstraint.transform)
  @Validate(IsTemporalPlainDateConstraint)
  serviceDate!: Temporal.PlainDate

  @IsString()
  completionTime!: string

  @IsString()
  @IsOptional()
  services?: string // required for type Bridal, see InvoiceService
}
