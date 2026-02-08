import { AnchorProvider, Program, web3, BN } from '@coral-xyz/anchor';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

function getProgramId(): PublicKey {
  // Hardcoded for now to avoid env variable caching issues
  return new PublicKey('3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A');
}

// Simplified IDL - only what we need for the frontend
const IDL = {
  version: '0.1.0',
  name: 'callit',
  instructions: [
    {
      name: 'makeCall',
      accounts: [
        { name: 'call', isMut: true, isSigner: true },
        { name: 'caller', isMut: true, isSigner: true },
        { name: 'escrow', isMut: true, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'description', type: 'string' },
        { name: 'amount', type: 'u64' },
        { name: 'deadline', type: 'i64' },
      ],
    },
    {
      name: 'challengeCall',
      accounts: [
        { name: 'call', isMut: true, isSigner: false },
        { name: 'challenger', isMut: true, isSigner: true },
        { name: 'escrow', isMut: true, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'stake', type: 'u64' },
        { name: 'confidence', type: 'u8' },
      ],
    },
  ],
};

export function getProgram(connection: Connection, wallet: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet, {});
  // Pass as string, let Anchor convert it
  return new Program(IDL as any, '3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A', provider);
}

export async function makeCall(
  connection: Connection,
  wallet: AnchorWallet,
  description: string,
  amount: number,
  deadlineHours: number
) {
  const program = getProgram(connection, wallet);

  const callKeypair = web3.Keypair.generate();
  const deadline = Math.floor(Date.now() / 1000) + (deadlineHours * 3600);

  const [escrow] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), callKeypair.publicKey.toBuffer()],
    getProgramId()
  );

  const tx = await program.methods
    .makeCall(description, new BN(amount * LAMPORTS_PER_SOL), new BN(deadline))
    .accounts({
      call: callKeypair.publicKey,
      caller: wallet.publicKey,
      escrow,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([callKeypair])
    .rpc();

  return { tx, callId: callKeypair.publicKey.toString() };
}

export async function challengeCall(
  connection: Connection,
  wallet: AnchorWallet,
  callPubkey: PublicKey,
  stake: number,
  confidence: number
) {
  const program = getProgram(connection, wallet);

  const [escrow] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), callPubkey.toBuffer()],
    getProgramId()
  );

  const tx = await program.methods
    .challengeCall(new BN(stake * LAMPORTS_PER_SOL), confidence)
    .accounts({
      call: callPubkey,
      challenger: wallet.publicKey,
      escrow,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  return tx;
}
