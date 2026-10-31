# Node conversion verification

The Node regression test uses an isolated SQLite database and real HTTP requests to the server. It covers setup, signup, CSRF, cross-client isolation, request creation, delivery, approval, revisions, enquiries, logout/login and static source protection. Run npm test to verify.

MySQL deployment and external automation callbacks still require verification on your Hostinger account. The approved frontend design is preserved; its previous desktop/mobile checks remain applicable.
