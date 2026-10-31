# Node conversion verification

The Node regression test uses an isolated SQLite database and real HTTP requests to the server. It covers setup, signup, CSRF, cross-client isolation, request creation, delivery, approval, revisions, enquiries, logout/login and static source protection. Run npm test to verify.

MySQL deployment and external automation callbacks still require verification on your Hostinger account. The approved frontend design is preserved; its previous desktop/mobile checks remain applicable.

Blank deployment coverage: both missing NODE_ENV and production NODE_ENV start public pages successfully without secrets or database credentials. Bootstrap reports backend unavailable, writes return 503, and no local SQLite file is created. Configured account and agency workflow regression remains covered.
