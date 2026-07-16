# BayarAman HumanLayer Task Template

Use this as the prompt/body when creating a HumanLayer task.

```text
Task:
<short task name>

Context:
- Use .humanlayer/workflow.md.
- Read README.md, PRD.md, TRD.md, AUTH.md, DATABASE.md first.
- Follow the latest manual-payment BayarAman flow.
- Buyer/seller are transaction-level roles.
- Payment confirmation is admin-driven; buyer "Sudah Bayar" is only a claim.
- Unpaid payable transactions expire after 1x24 hours.
- Buyer-seller complaints are handled outside MVP system; record final outcome only.

Scope:
- <what to implement>

Out of scope:
- <what not to touch>
- Do not touch infographic files unless explicitly required.

Acceptance criteria:
- <AC 1>
- <AC 2>
- <AC 3>

Verification:
- Run relevant lint/typecheck/tests.
- If no app/test framework exists yet, explain what was manually verified.
```
