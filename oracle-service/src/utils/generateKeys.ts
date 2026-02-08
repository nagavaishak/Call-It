import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

/**
 * Generate 3 oracle keypairs for devnet testing
 * In production, these should be generated securely and stored in AWS Secrets Manager
 */
async function generateOracleKeypairs() {
  console.log('🔐 Generating 3 Oracle Keypairs for CALL IT...\n');

  const keypairs = [];

  for (let i = 1; i <= 3; i++) {
    const keypair = Keypair.generate();
    keypairs.push({
      nodeId: i,
      publicKey: keypair.publicKey.toString(),
      secretKey: Array.from(keypair.secretKey),
    });

    console.log(`Oracle Node ${i}:`);
    console.log(`  Public Key: ${keypair.publicKey.toString()}`);
    console.log(`  Secret Key: [${Array.from(keypair.secretKey).slice(0, 5).join(',')}...]\n`);

    // Save to file
    fs.writeFileSync(
      `oracle-node-${i}.json`,
      JSON.stringify({
        nodeId: i,
        publicKey: keypair.publicKey.toString(),
        secretKey: Array.from(keypair.secretKey),
      }, null, 2)
    );
  }

  // Save all public keys for initializing the smart contract
  const publicKeys = keypairs.map(k => k.publicKey);
  fs.writeFileSync(
    'oracle-public-keys.json',
    JSON.stringify({ publicKeys }, null, 2)
  );

  console.log('✅ Keypairs generated and saved!');
  console.log('\n📝 Next steps:');
  console.log('1. Initialize the smart contract with these 3 public keys');
  console.log('2. Set ORACLE_SECRET_KEY in .env for each node');
  console.log('3. Deploy oracle nodes to separate servers\n');
  console.log('🔑 Public Keys for contract initialization:');
  console.log(JSON.stringify(publicKeys, null, 2));
}

generateOracleKeypairs().catch(console.error);
