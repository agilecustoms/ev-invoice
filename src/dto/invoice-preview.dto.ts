import { Temporal } from '@js-temporal/polyfill'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Min, Validate } from 'class-validator'
import { IsTemporalPlainDateConstraint, OrderType } from './order.dto.js'

/**
 * What would be booked - the subset of an order that defines the invoice. Comes from the HTTP body,
 * so the global ValidationPipe checks it (malformed body -> 400) before business rules run (-> 422)
 */
export class InvoicePreviewRequest {
  @ApiProperty({ enum: OrderType, example: OrderType.BRIDAL })
  @IsEnum(OrderType)
  type!: OrderType

  @ApiProperty({ type: String, format: 'date', example: '2026-11-21' })
  @Transform(IsTemporalPlainDateConstraint.transform)
  @Validate(IsTemporalPlainDateConstraint)
  serviceDate!: Temporal.PlainDate

  @ApiProperty({ description: 'total price in USD', example: 650 })
  @Min(1)
  @IsInt()
  price!: number

  @ApiPropertyOptional({ description: 'USD, if omitted: 20% of the price rounded up to $10', example: 150 })
  @Min(0)
  @IsInt()
  @IsOptional()
  deposit?: number

  @ApiPropertyOptional({ description: 'required for type Bridal', example: 'Trial makeup at Studio, Bridal Makeup at the venue' })
  @IsString()
  @IsOptional()
  services?: string
}

/**
 * The invoice that /create would send for such a booking
 */
export class InvoicePreviewResponse {
  @ApiProperty({ example: 650 })
  total!: number

  @ApiProperty({ example: 130 })
  deposit!: number

  @ApiProperty({ description: 'true if deposit was not given and the default rule was applied' })
  defaultDeposit!: boolean

  @ApiProperty({ description: 'deposit must be paid by this time to reserve the date', example: '2026-10-16T13:30:00Z' })
  depositDueBy!: string

  @ApiProperty({ example: 520 })
  balance!: number

  @ApiProperty({ description: 'balance is due on the service date', example: '2026-11-21' })
  balanceDueDate!: string

  @ApiProperty({ description: 'note shown to the customer on the invoice' })
  note!: string
}
