# Get from vault action
## Introduction

The action asks the vault nicely to have a value and exports it as a secret env value.

The action supports two authentication methods:
* If your job uses `azure/login` - the action can reuse the login.
* If you don't use `azure/login` - the action needs `clientId` and `tenantId`

Authentication method is selected by providing (or no providing) client and tenant IDs.

The action assumes that you have an application that is configured with federated identity credentials matching GitHub ID token (namely repo, branch and `api://AzureADTokenExchange` audience).

By default, secrets are exported using their name capitalized with spaces and hyphens replaced by underscores.  
  
The action also supports a list of names to use to name exports. This list of env names should be no longer than the list of secrets. If names are provided - it is an error to not provide secret names. If an env name is not supplied for a secret - the action falls back to default. See examples :)

Wildcards/masks are not supported as listing secrets in a vault should be forbidden.

Client-id and tenant-id are not really secret values. But to make it more difficult for everyone - please use secrets to store them.

Please, reuse as many secrets from the common vault as possible. The goal is to simplify secrets rotation.

## Input parameters
| Name | Description |
|------|-------------|
|vault-name| The vault name. Used to contruct URL. |
|secret-names| A comma (and optional space) separated list of secrets. At least 1 should be provided |
|env-names| A list of names to use for secrets |
|client-id| Client (or "application") id of an application that accesses the vault|
|tenant-id| Tenant id of the vault|
## Outputs
The action doesn't output any values. Instead - it exports values as environmental variables.

Secrets can't be put into an output of a job or a step. So every job has to request secrets again.

## Examples

### With Azure/login
```yaml
name: test secrets from vault

on:
  workflow_dispatch:

jobs:
  test_cli_auth:
    permissions:
      contents: read
      id-token: write # ID token is required!

    runs-on: ubuntu-latest
    steps:
      - name: Azure login
        uses: azure/login@532459ea530d8321f2fb9bb10d1e0bcf23869a43 #v3.0.0
        with:
          client-id: ${{secrets.MY_CLIENT_ID}}
          tenant-id: ${{secrets.MY_TENANT_ID}}
          subscription-id: ${{secrets.MY_SUBS_ID}}

      - name: Get secrets
        uses: nginx/ci-self-hosted/.github/actions/get-from-vault
        with:
          # note - only vault and secret names are needed
          vault-name: "my-vault"
          secret-names: "secret1"
```
### Without Azure/login
```yaml
name: test secrets from vault

on:
  workflow_dispatch:

jobs:
  test_token_auth:
    permissions:
      contents: read
      id-token: write # ID token is required!

    runs-on: ubuntu-latest
    steps:
      - name: Get secrets
        uses: nginx/ci-self-hosted/.github/actions/get-from-vault
        with:
          client-id: ${{secrets.MY_CLIENT_ID}}
          tenant-id: ${{secrets.MY_TENANT_ID}}
          vault-name: "my-vault"
          secret-names: "secret1"
```
### Multiple secrets with names
```yaml
      - name: Get secrets
        uses: nginx/ci-self-hosted/.github/actions/get-from-vault
        with:
          client-id: ${{secrets.MY_CLIENT_ID}}
          tenant-id: ${{secrets.MY_TENANT_ID}}
          vault-name: "my-vault"
          secret-names: "secret1, secret2, secret3, secret4, secret5"
          env-names: "s1, S2, , PDTM"
          # secret1 becomes s1
          # secret2 becomes S2 
          # secret3 becomes SECRET3, default fallback
          # secret4 becomes PDTM
          # secret5 becomes SECRET5, default fallback
          
      - name: Test secrets
        run: |
            echo $S2         # secrets are env variables
            echo ${{env.s1}} # env context is populated as well
            
      - name: Test secrets
        if: ${{env.SECRET3}}
        run: echo "Will never run as github secrets can't be used in conditionals"
```
