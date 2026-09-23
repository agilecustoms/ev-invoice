export interface Order {
  id: string // airtable id
  totalAmount: number
  depositAmount: number
  address: string
  serviceDate: string
  completionTime: string
  services: string
}
