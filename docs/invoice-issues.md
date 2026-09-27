# Invoice Issues

1. Invoice is not paid within 48 hours — decide what happens to the invoice and the order status in Airtable
2. Invoice needs to be changed before payment — price, deposit, date, address, services, customer name/email, etc
3. Customer cancels before payment — the invoice has already been sent but is no longer needed
4. Customer pays more than the deposit, or pays the full invoice — your logic should handle this correctly
5. Order changes after the deposit has been paid — services are added or removed, total changes, but a partial payment already exists
6. Customer tries to pay too late — the 48-hour window has expired and the date may no longer be guaranteed or may already be booked by someone else
7. Customer cancels after paying the deposit — the order is canceled, but the deposit remains non-refundable
8. Evelin cancels an already-paid order — a refund may be required
9. Full refund — the payment is returned and the change needs to be reflected in Airtable
10. Partial refund — for example, one service is removed after payment
11. Duplicate invoice — two invoices are created for the same Airtable order because of a repeated click, retry, timeout, or race condition
12. PayPal creates the invoice, but the Lambda fails before saving the PayPal Invoice ID to Airtable — especially dangerous because a retry may create a duplicate
13. Invoice is created, but sending it through PayPal fails — the invoice exists, but the customer never receives it
14. PayPal API returns a temporary error, timeout, or 5xx — you may not know whether the operation actually succeeded
15. Airtable API is unavailable after a successful PayPal operation — PayPal and Airtable end up in inconsistent states
16. PayPal webhook is delivered more than once — the webhook handler should be idempotent
17. Webhooks arrive out of order — multiple invoice/payment events may arrive in an unexpected sequence
18. Webhook never arrives or processing fails — PayPal shows the invoice as paid while Airtable still has the old status
19. Invalid data comes from Airtable — missing email, invalid amount, deposit > total, invalid date, bad phone number, etc
20. Concurrent order modification — Evelin edits the Airtable record at roughly the same time the Lambda is creating the invoice