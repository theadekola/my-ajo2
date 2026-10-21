# My Ajo workspace defaults

- Save all corrected My Ajo source files in this repository root.
- Update the real application files in `client`, `server`, and `database`; do not treat copies outside this project as authoritative.
- Save manually uploadable release packages in `releases` inside this project.
- Never include `server/.env`, credentials, uploaded user files, `node_modules`, caches, or generated mobile build directories in release packages.
- Preserve the production deployment locations `/opt/my-ajo/client` and `/opt/my-ajo/server` when providing upload instructions.

- User standing instruction: after completing My Ajo2 corrections and passing the relevant checks, push the changes and merge the correction pull request. Do not request merge approval again. Do not bypass failing required checks or repository protections.
