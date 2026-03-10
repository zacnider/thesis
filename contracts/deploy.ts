/**
 * Prophet Contract Deployment Script
 *
 * Deploys singleton contracts:
 *   1. MarketFactory — Market registry
 *   2. OracleResolver — Bond-based dispute resolution
 *   3. ReputationTracker — User stats
 *
 * Per-market contracts (deployed via backend):
 *   - OutcomeToken (YES) + OutcomeToken (NO) + PredictionMarket
 *
 * Usage:
 *   npx tsx deploy.ts
 *
 * Requirements:
 *   - MNEMONIC in ../backend/.env
 *   - Testnet BTC in wallet
 *   - Built WASM files in ./build/
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(import.meta.dirname || '.', '../backend/.env') });

import {
    Address,
    AddressTypes,
    BinaryWriter,
    IDeploymentParameters,
    TransactionFactory,
    Mnemonic,
    MLDSASecurityLevel,
} from '@btc-vision/transaction';
import { JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import * as fs from 'fs';
import * as path from 'path';

const TESTNET_RPC = 'https://testnet.opnet.org';
const network = (networks as any).opnetTestnet;

// Oracle parameters
const MINIMUM_BOND = 10000n; // 10k sats minimum bond

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

async function deployContract(
    name: string,
    wasmPath: string,
    calldata: BinaryWriter,
    account: any,
    provider: JSONRpcProvider,
    factory: TransactionFactory,
    utxos: any[],
): Promise<{ address: string; pubKey: string; utxos: any[] }> {
    console.log(`\n--- Deploying ${name} ---`);
    const bytecode = fs.readFileSync(wasmPath);

    const challenge = await provider.getChallenge();
    const deployment = await factory.signDeployment({
        from: account.p2tr,
        utxos,
        signer: account.keypair,
        mldsaSigner: account.mldsaKeypair,
        network,
        feeRate: 5,
        priorityFee: 0n,
        gasSatFee: 10000n,
        bytecode,
        calldata: calldata.getBuffer(),
        challenge,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
    } as IDeploymentParameters);

    const address = deployment.contractAddress;
    const pubKey = deployment.contractPubKey;
    console.log(`${name} address: ${address}`);
    console.log(`${name} pubKey: ${pubKey}`);

    await provider.sendRawTransaction(deployment.transaction[0], false);
    console.log(`${name} funding TX broadcast`);
    await provider.sendRawTransaction(deployment.transaction[1], false);
    console.log(`${name} reveal TX broadcast`);

    return {
        address,
        pubKey,
        utxos: deployment.utxos || utxos,
    };
}

async function main() {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
        console.error('ERROR: Set MNEMONIC in ../backend/.env');
        process.exit(1);
    }

    console.log('=== PROPHET Contract Deployment ===\n');
    console.log('Setting up wallet...');
    const wallet = new Mnemonic(mnemonic, '', network, MLDSASecurityLevel.LEVEL2);
    const account = wallet.deriveOPWallet(AddressTypes.P2TR, 0);
    console.log('Deployer address:', account.p2tr);

    const provider = new JSONRpcProvider({ url: TESTNET_RPC, network });
    const factory = new TransactionFactory();

    // Get UTXOs
    console.log('Fetching UTXOs...');
    const utxos = await provider.utxoManager.getUTXOs({ address: account.p2tr });
    if (!utxos || utxos.length === 0) {
        console.error('No UTXOs found. Get testnet BTC from faucet first.');
        process.exit(1);
    }
    console.log(`Found ${utxos.length} UTXOs`);

    const scriptsDir = import.meta.dirname || '.';
    const results: Record<string, { address: string; pubKey: string }> = {};

    // ========================================
    // 1. Deploy MarketFactory
    // ========================================
    const factoryCalldata = new BinaryWriter();
    // onDeployment: no params (just sets owner = sender)

    const factoryResult = await deployContract(
        'MarketFactory',
        path.join(scriptsDir, 'build/MarketFactory.wasm'),
        factoryCalldata,
        account,
        provider,
        factory,
        utxos,
    );
    results['MarketFactory'] = { address: factoryResult.address, pubKey: factoryResult.pubKey };

    console.log('\nWaiting 15s for block confirmation...');
    await sleep(15000);

    // ========================================
    // 2. Deploy OracleResolver
    // ========================================

    // Wait for fresh UTXOs
    let currentUtxos: any[] = [];
    for (let i = 0; i < 10; i++) {
        currentUtxos = await provider.utxoManager.getUTXOs({ address: account.p2tr });
        if (currentUtxos && currentUtxos.length > 0) break;
        console.log('Waiting for UTXOs...');
        await sleep(10000);
    }

    const oracleCalldata = new BinaryWriter();
    // onDeployment: collateralAddress (use deployer as placeholder), minimumBond
    oracleCalldata.writeAddress(account.p2tr as unknown as Address); // placeholder collateral
    oracleCalldata.writeU256(MINIMUM_BOND);

    const oracleResult = await deployContract(
        'OracleResolver',
        path.join(scriptsDir, 'build/OracleResolver.wasm'),
        oracleCalldata,
        account,
        provider,
        factory,
        currentUtxos,
    );
    results['OracleResolver'] = { address: oracleResult.address, pubKey: oracleResult.pubKey };

    console.log('\nWaiting 15s for block confirmation...');
    await sleep(15000);

    // ========================================
    // 3. Deploy ReputationTracker
    // ========================================
    for (let i = 0; i < 10; i++) {
        currentUtxos = await provider.utxoManager.getUTXOs({ address: account.p2tr });
        if (currentUtxos && currentUtxos.length > 0) break;
        console.log('Waiting for UTXOs...');
        await sleep(10000);
    }

    const repCalldata = new BinaryWriter();
    // onDeployment: no params (just sets owner = sender)

    const repResult = await deployContract(
        'ReputationTracker',
        path.join(scriptsDir, 'build/ReputationTracker.wasm'),
        repCalldata,
        account,
        provider,
        factory,
        currentUtxos,
    );
    results['ReputationTracker'] = { address: repResult.address, pubKey: repResult.pubKey };

    // ========================================
    // Summary
    // ========================================
    console.log('\n\n=== DEPLOYMENT COMPLETE ===\n');
    for (const [name, info] of Object.entries(results)) {
        console.log(`${name}:`);
        console.log(`  Address: ${info.address}`);
        console.log(`  PubKey:  ${info.pubKey}`);
    }

    // Save to file
    const outputPath = path.join(scriptsDir, 'deployed-addresses.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nAddresses saved to ${outputPath}`);
}

main().catch((err) => {
    console.error('Deployment failed:', err);
    process.exit(1);
});
