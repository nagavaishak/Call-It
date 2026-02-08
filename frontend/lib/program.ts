import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);

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
  return new Program(IDL as any, PROGRAM_ID, provider);
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
    PROGRAM_ID
  );

  const tx = await program.methods
    .makeCall(description, new web3.BN(amount * web3.LAMPORTS_PER_SOL), new web3.BN(deadline))
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
    PROGRAM_ID
  );

  const tx = await program.methods
    .challengeCall(new web3.BN(stake * web3.LAMPORTS_PER_SOL), confidence)
    .accounts({
      call: callPubkey,
      challenger: wallet.publicKey,
      escrow,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  return tx;
}
