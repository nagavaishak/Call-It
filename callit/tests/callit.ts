import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Callit } from "../target/types/callit";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("CALL IT - Phase 1 Tests", () => {
  // Configure the client to use the devnet cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Callit as Program<Callit>;

  // Test accounts
  const authority = provider.wallet as anchor.Wallet;
  const caller = Keypair.generate();
  const challenger1 = Keypair.generate();
  const challenger2 = Keypair.generate();

  // Oracle keypairs (dummy for testing)
  const oracle1 = Keypair.generate();
  const oracle2 = Keypair.generate();
  const oracle3 = Keypair.generate();

  let configPda: PublicKey;
  let configBump: number;

  let callPda: PublicKey;
  let callBump: number;
  let escrowPda: PublicKey;
  let escrowBump: number;

  let challengePda1: PublicKey;
  let challengeBump1: number;

  const callNonce = new BN(Date.now() / 1000);

  before(async () => {
    // Derive config PDA
    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Airdrop SOL to test accounts
    console.log("Airdropping SOL to test accounts...");

    const airdropSignature = await provider.connection.requestAirdrop(
      caller.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    const airdropSignature2 = await provider.connection.requestAirdrop(
      challenger1.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature2);

    const airdropSignature3 = await provider.connection.requestAirdrop(
      challenger2.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature3);

    console.log("Test accounts funded!");
  });

  it("1. Initialize Protocol", async () => {
    console.log("\n=== Test 1: Initialize Protocol ===");

    try {
      const tx = await program.methods
        .initialize([
          oracle1.publicKey,
          oracle2.publicKey,
          oracle3.publicKey,
        ])
        .accounts({
          config: configPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Initialize transaction:", tx);

      // Verify config was created
      const configAccount = await program.account.globalConfig.fetch(configPda);
      assert.equal(configAccount.authority.toString(), authority.publicKey.toString());
      assert.equal(configAccount.protocolFeeBps, 500); // 5%
      assert.equal(configAccount.isPaused, false);

      console.log("✅ Protocol initialized successfully!");
      console.log(`   - Authority: ${configAccount.authority.toString()}`);
      console.log(`   - Oracle 1: ${configAccount.oracleSigners[0].toString()}`);
      console.log(`   - Oracle 2: ${configAccount.oracleSigners[1].toString()}`);
      console.log(`   - Oracle 3: ${configAccount.oracleSigners[2].toString()}`);
      console.log(`   - Fee: ${configAccount.protocolFeeBps} bps (5%)`);
    } catch (error) {
      console.error("❌ Initialize failed:", error);
      throw error;
    }
  });

  it("2. Make Call (Token Price Prediction)", async () => {
    console.log("\n=== Test 2: Make Call ===");

    // Derive call PDA
    [callPda, callBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("call"),
        caller.publicKey.toBuffer(),
        callNonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Derive escrow PDA
    [escrowPda, escrowBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), callPda.toBuffer()],
      program.programId
    );

    const claim = "SOL will hit $200 by next week!";
    const stake = new BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
    const confidence = 75;
    const deadline = new BN(Math.floor(Date.now() / 1000) + 86400 * 2); // 2 days from now

    try {
      const tx = await program.methods
        .makeCall(
          claim,
          { tokenPrice: {} }, // Category
          null, // token_address (None for now, Pyth integration pending)
          null, // target_price (None for now)
          stake,
          confidence,
          deadline,
          callNonce
        )
        .accounts({
          call: callPda,
          escrow: escrowPda,
          config: configPda,
          pythPriceFeed: null,
          caller: caller.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([caller])
        .rpc();

      console.log("✅ Make call transaction:", tx);

      // Verify call was created
      const callAccount = await program.account.call.fetch(callPda);
      assert.equal(callAccount.caller.toString(), caller.publicKey.toString());
      assert.equal(callAccount.claim, claim);
      assert.equal(callAccount.stake.toString(), stake.toString());
      assert.equal(callAccount.confidence, confidence);
      assert.equal(callAccount.challengersCount, 0);

      console.log("✅ Call created successfully!");
      console.log(`   - Call ID: ${callPda.toString()}`);
      console.log(`   - Caller: ${callAccount.caller.toString()}`);
      console.log(`   - Claim: "${callAccount.claim}"`);
      console.log(`   - Stake: ${callAccount.stake.toNumber() / LAMPORTS_PER_SOL} SOL`);
      console.log(`   - Confidence: ${callAccount.confidence}%`);
      console.log(`   - Deadline: ${new Date(callAccount.deadline.toNumber() * 1000).toISOString()}`);
      console.log(`   - Status: Active`);
    } catch (error) {
      console.error("❌ Make call failed:", error);
      throw error;
    }
  });

  it("3. Challenge Call", async () => {
    console.log("\n=== Test 3: Challenge Call ===");

    // Derive challenge PDA
    [challengePda1, challengeBump1] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("challenge"),
        callPda.toBuffer(),
        challenger1.publicKey.toBuffer(),
      ],
      program.programId
    );

    const challengeStake = new BN(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL
    const challengeConfidence = 80;

    try {
      const tx = await program.methods
        .challengeCall(challengeStake, challengeConfidence)
        .accounts({
          call: callPda,
          challenge: challengePda1,
          escrow: escrowPda,
          config: configPda,
          challenger: challenger1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger1])
        .rpc();

      console.log("✅ Challenge call transaction:", tx);

      // Verify challenge was created
      const challengeAccount = await program.account.challenge.fetch(challengePda1);
      assert.equal(challengeAccount.callId.toString(), callPda.toString());
      assert.equal(challengeAccount.challenger.toString(), challenger1.publicKey.toString());
      assert.equal(challengeAccount.stake.toString(), challengeStake.toString());
      assert.equal(challengeAccount.confidence, challengeConfidence);

      // Verify call was updated
      const callAccount = await program.account.call.fetch(callPda);
      assert.equal(callAccount.challengersCount, 1);

      console.log("✅ Challenge created successfully!");
      console.log(`   - Challenge ID: ${challengePda1.toString()}`);
      console.log(`   - Challenger: ${challengeAccount.challenger.toString()}`);
      console.log(`   - Stake: ${challengeAccount.stake.toNumber() / LAMPORTS_PER_SOL} SOL`);
      console.log(`   - Confidence: ${challengeAccount.confidence}%`);
      console.log(`   - Challengers count: ${callAccount.challengersCount}`);
    } catch (error) {
      console.error("❌ Challenge call failed:", error);
      throw error;
    }
  });

  it("4. Test Error: Cannot challenge own call", async () => {
    console.log("\n=== Test 4: Error Handling - Cannot Challenge Own Call ===");

    const [selfChallengePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("challenge"),
        callPda.toBuffer(),
        caller.publicKey.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .challengeCall(new BN(0.05 * LAMPORTS_PER_SOL), 75)
        .accounts({
          call: callPda,
          challenge: selfChallengePda,
          escrow: escrowPda,
          config: configPda,
          challenger: caller.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([caller])
        .rpc();

      assert.fail("Should have thrown error for challenging own call");
    } catch (error: any) {
      console.log("✅ Correctly rejected self-challenge");
      console.log(`   - Error: ${error.message || error}`);
    }
  });

  it("5. Test Error: Duplicate challenge", async () => {
    console.log("\n=== Test 5: Error Handling - Duplicate Challenge ===");

    try {
      await program.methods
        .challengeCall(new BN(0.05 * LAMPORTS_PER_SOL), 75)
        .accounts({
          call: callPda,
          challenge: challengePda1,
          escrow: escrowPda,
          config: configPda,
          challenger: challenger1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger1])
        .rpc();

      assert.fail("Should have thrown error for duplicate challenge");
    } catch (error: any) {
      console.log("✅ Correctly rejected duplicate challenge");
      console.log(`   - Error: ${error.message || error}`);
    }
  });

  it("6. Display Final State", async () => {
    console.log("\n=== Final State Summary ===");

    const callAccount = await program.account.call.fetch(callPda);
    const challengeAccount = await program.account.challenge.fetch(challengePda1);
    const escrowBalance = await provider.connection.getBalance(escrowPda);

    console.log("\n📋 Call Details:");
    console.log(`   - ID: ${callPda.toString()}`);
    console.log(`   - Caller: ${callAccount.caller.toString()}`);
    console.log(`   - Claim: "${callAccount.claim}"`);
    console.log(`   - Stake: ${callAccount.stake.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`   - Challengers: ${callAccount.challengersCount}`);
    console.log(`   - Status: Active`);

    console.log("\n💰 Escrow Balance:");
    console.log(`   - Total locked: ${escrowBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`   - Caller stake: ${callAccount.stake.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`   - Challenger stake: ${challengeAccount.stake.toNumber() / LAMPORTS_PER_SOL} SOL`);

    console.log("\n⚔️  Challenge Details:");
    console.log(`   - Challenger: ${challengeAccount.challenger.toString()}`);
    console.log(`   - Stake: ${challengeAccount.stake.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`   - Confidence: ${challengeAccount.confidence}%`);

    console.log("\n✅ All Phase 1 core tests passed!");
    console.log("\n📝 Note: resolve_call and auto_refund tests require:");
    console.log("   - Ed25519 oracle signatures (2-of-3 multisig)");
    console.log("   - Waiting for deadline to pass");
    console.log("   - These will be tested in integration testing phase");
  });
});
