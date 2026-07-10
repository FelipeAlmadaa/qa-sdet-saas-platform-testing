# UAT Checklist — NimbusDesk (Business Validation)

Executed by business stakeholders before release sign-off. Mark each item ✅ Pass / ❌ Fail / ⚠️ Pass with notes.

**Environment:** ______  **Build/version:** ______  **Date:** ______  **Tester:** ______

## 1. Account creation
- [ ] A new customer can create an account with name, email, password and company in under 2 minutes.
- [ ] Validation messages are clear and in plain business language (no technical jargon).
- [ ] The welcome page confirms the workspace was created and guides the user to log in.
- [ ] The confirmation clearly identifies the company workspace that was created.

## 2. Payment confirmation
- [ ] The billing page states the plan and price before payment is confirmed.
- [ ] After a successful payment, an explicit confirmation message is shown.
- [ ] A declined card shows an actionable message (try another payment method) — not a technical error.
- [ ] A payment timeout tells the user it is safe to retry and does not double-charge.
- [ ] No card data is displayed back to the user after submission.

## 3. Subscription activation
- [ ] Subscription status changes to **active** immediately after successful payment.
- [ ] The dashboard reflects the purchased plan (e.g. Pro).
- [ ] Premium features (Reports) become available right after activation.
- [ ] A failed payment leaves the account in a clearly communicated limited state (banner + blocked premium content).

## 4. Tenant isolation
- [ ] A user only ever sees data from their own company workspace.
- [ ] Attempting to open another company's pages shows an access-denied message, never partial data.
- [ ] Team lists contain no names or emails from other companies.

## 5. Admin access
- [ ] A workspace admin can view the team and invite new users to their own workspace.
- [ ] An admin cannot view or manage users of any other company.
- [ ] Invited users appear in the team list with the correct role.

## 6. User permissions
- [ ] A regular member can view the team but sees no management controls.
- [ ] A member attempting a management action receives a clear "admins only" message.
- [ ] Logging out fully ends the session; the browser Back button does not re-open private pages.

## Sign-off

| Role | Name | Verdict (Approve / Reject) | Signature | Date |
| --- | --- | --- | --- | --- |
| Business owner | | | | |
| Product manager | | | | |
| QA lead | | | | |
