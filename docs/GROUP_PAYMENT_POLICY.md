# Share a Meal payment and recovery policy

## Current implemented safeguards

- Split contributions use the saved server-calculated order amount. A group is not considered fully paid until every assigned contribution is verified by an outlet administrator and the verified amounts reconcile to the order total.
- Host Pays creates one payer contribution. A submitted UPI reference is a claim for manual review; neither opening a UPI app nor submitting a reference marks money received.
- The kitchen cannot accept an online group order, and no shared pickup QR is issued, while any contribution is pending or awaiting review. QR pickup is available only after full payment verification and READY status.
- An administrator can reject a UPI reference with a reason; the member may then submit a new reference. A rejection does not claim that the customer was not charged by their bank.
- The group invite expires after its existing two-hour invite period. There is no automatic refund, forfeiture, or automatic cancellation of a partially paid order. The outlet must reconcile received funds and decide any refund manually using its approved process.
- Group activity shows contribution state transitions and counts only. It does not expose transaction references, account details, or contribution amounts.

## Outlet decision required before further automation

The current system does not define a payment deadline after group checkout. Before adding automatic expiry or cancellation for an ordered group, the outlet should approve: a payment window; how a verified partial contribution is handled; who contacts the group; whether an order can be cancelled after kitchen acceptance; the refund/settlement process; and what happens when a bank transfer succeeds but the customer cannot provide a reference. Until those decisions and a verified refund/reconciliation mechanism are documented, keep partial payments visible to the admin and resolve them manually. Do not silently cancel a verified contribution or automatically refund it.
