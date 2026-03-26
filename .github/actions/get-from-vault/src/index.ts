import { getInput, setSecret, setFailed, exportVariable, debug, getIDToken, isDebug } from "@actions/core";
import { TokenCredential, AzureCliCredential, ClientAssertionCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

if (isDebug()) {
    process.env["DEBUG"] = "azure*";
}

async function getToken(): Promise<string> {
        let token: string
        try {
            token = await getIDToken("api://AzureADTokenExchange");
            return token;

        } catch (err) {
            debug((err as Error).message);
            setFailed("Failed to fetch id_token from github. Do you have permissions set?");
            process.exit();
        }
}

async function main() {
    const vaultName   = getInput("vault-name", { required: true });
    const inputNames  = getInput("secret-names", { required: true });
    const inputEnvs   = getInput("env-names", { required: false });

    // if azure login is not used - client and tenant ids are provided
    const clientId    = getInput("client-id", { required: false });
    const tenantId    = getInput("tenant-id", { required: false });

    let credential: TokenCredential | undefined = undefined;
    let vaultClient: SecretClient | undefined = undefined;
    const vaultUrl: string = `https://${vaultName}.vault.azure.net`;

    let secrets:Record<string,string> = {};
    const secretNames = inputNames.split(',');
    let envNames = inputEnvs.split(',');

    // validate some sanity of the input
    if (secretNames.length < envNames.length) {
        setFailed("Got more labels than secrets to fetch!");
        process.exit();
    }

    if (secretNames.length == 0) {
        debug("No secrets to fetch, exiting.");
        process.exit(0);
    }

    for (let i = 0; i < secretNames.length; i++ ) {
        const secretName = secretNames[i].trim();
        if (secretName.length == 0) {
            setFailed("Got an empty secret name to fetch.");
            process.exit();
        }

        let envName = envNames[i] ?? "";
        if (envName.length == 0) {
            envName = `${secretName.trim().replace(/[ -]/g, '_').toUpperCase()}`
        }
        secrets[secretName] = envName.trim();
    }

    if (clientId && tenantId) {
        try {
            debug("Found client and tenant ids, trying token authentication.")
            credential = new ClientAssertionCredential( tenantId, clientId, getToken )
            vaultClient = new SecretClient(vaultUrl, credential);

        } catch (err) {
            debug((err as Error).message);
            setFailed("Token authenticate with Azure failed!");
            process.exit();
        }
    } else {
        try {
            debug("Trying azcli authentication.")
            credential = new AzureCliCredential();
            vaultClient = new SecretClient(vaultUrl, credential);

        } catch (err) {
            debug((err as Error).message);
            setFailed("Azcli authenticate with Azure failed!");
        }
    }

    if (credential === undefined || vaultClient === undefined) {
        debug("This should never happen, but here we are!");
        setFailed("Can't authenticate with Azure!");
        process.exit();
    }

    debug("Fetching secrets from the vault...")
    for (const secretName in secrets) {
        try {
            const secret = await vaultClient.getSecret(secretName);
            if (!secret.value) {
                throw Error(`Value for ${secretName} is not set in vault!`);
            }

            setSecret(secret.value);
            exportVariable(secrets[secretName], secret.value);

        } catch (err) {
            setFailed((err as Error).message);
            process.exit();
        }
    }
    debug("Fetched all secrets from the vault and exiting.")
}

main();
