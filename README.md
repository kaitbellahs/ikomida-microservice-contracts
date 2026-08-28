# ikomida-microservice-contracts

Subscription plans and signed contracts.

> Part of the **iKomida** platform. See **[ikomida-k8s-config](https://github.com/kaitbellahs/ikomida-k8s-config)** for the architecture overview of all 31 repositories.

---

## Role

Handles the commercial relationship between the platform and its vendors: which plans exist, and the contract a vendor signs to join one. Sign-up routes are public because a prospective vendor has no account yet; phone validation gates them instead.

## Endpoints

As declared in the [gateway route table](https://github.com/kaitbellahs/ikomida-microservice-gateway/blob/dev/src/routes.ts) (5 routes reach this service):

| Method | Path | Roles |
|---|---|---|
| `POST` | `/contract/requestPhoneValidation` | *public* |
| `POST` | `/contract/validatePhoneValidationCode` | *public* |
| `POST` | `/contract` | *public* |
| `GET` | `/plans` | *public* |
| `GET` | `/plan/:id` | *public* |

## Stack

TypeScript (ESM) · Express · Sequelize · rollup · Docker · Kubernetes

Depends on [`@ikomida/shared-types`](https://github.com/kaitbellahs/ikomida-shared-types), [`@ikomida/shared-backend`](https://github.com/kaitbellahs/ikomida-shared-backend) and [`@ikomida/shared-logics`](https://github.com/kaitbellahs/ikomida-shared-logics).

## Build

```bash
yarn install
yarn build      # rollup bundle
yarn service    # run locally
```

## Status

Built in 2022. The platform is no longer deployed; this repository is published as a record of the work. **The commit history predates generative AI coding assistants.**

## License

Licensed under the [Apache License 2.0](LICENSE) — free for commercial use, provided the copyright notice and [NOTICE](NOTICE) are retained.

Copyright 2022 Khalid Ait Bellahs.
