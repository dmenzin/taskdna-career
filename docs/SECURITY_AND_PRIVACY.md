# Security and privacy

Sandbox baseline:

- no secrets are required or committed,
- all jobs and personas are synthetic/demo data,
- no exact private home addresses are stored,
- pasted text is treated as local sandbox input,
- rendered content is plain React text, not injected HTML,
- production auth, payment, live job APIs, and production databases are out of scope.

Future production work needs explicit data retention, deletion, consent, and provider-boundary decisions before handling real resumes or job-search activity.
