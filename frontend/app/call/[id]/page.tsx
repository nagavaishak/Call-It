'use client';

import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useParams } from 'next/navigation';
import { api, Call, Challenge } from '@/lib/api';
import { challengeCall } from '@/lib/program';
import { PublicKey } from '@solana/web3.js';
import Link from 'next/link';

export default function CallDetailPage() {
  const params = useParams();
  const { connection } = useConnection();
  const wallet = useWallet();
  const [call, setCall] = useState<Call | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [challenging, setChallenging] = useState(false);
  const [showChallengeForm, setShowChallengeForm] = useState(false);

  const [formData, setFormData] = useState({
    stake: '',
    confidence: '70',
  });

  useEffect(() => {
    if (params.id) {
      loadCallData();
    }
  }, [params.id]);

  async function loadCallData() {
    setLoading(true);
    try {
      const [callData, challengesData] = await Promise.all([
        api.getCall(params.id as string),
        api.getCallChallenges(params.id as string),
      ]);

      setCall(callData);
      setChallenges(challengesData);
    } catch (error) {
      console.error('Failed to load call data:', error);
    }
    setLoading(false);
  }

  async function handleChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert('Please connect your wallet');
      return;
    }

    if (!call?.onchain_id) {
      alert('Call not found on-chain');
      return;
    }

    setChallenging(true);
    try {
      const callPubkey = new PublicKey(call.onchain_id);
      const tx = await challengeCall(
        connection,
        wallet as any,
        callPubkey,
        parseFloat(formData.stake),
        parseInt(formData.confidence)
      );

      alert(`Challenge submitted! TX: ${tx}`);
      setShowChallengeForm(false);
      setFormData({ stake: '', confidence: '70' });

      setTimeout(loadCallData, 2000);
    } catch (error: any) {
      console.error('Failed to challenge call:', error);
      alert(`Error: ${error.message}`);
    }
    setChallenging(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Call not found</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Calls
          </Link>
        </div>
      </div>
    );
  }

  const deadline = new Date(call.deadline * 1000);
  const isExpired = deadline < new Date();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Calls
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{call.description}</h1>
              <p className="text-gray-600">
                Created by{' '}
                <Link href={`/user/${call.caller}`} className="text-blue-600 hover:underline">
                  {call.caller.slice(0, 8)}...{call.caller.slice(-8)}
                </Link>
              </p>
            </div>
            <div className={`px-4 py-2 rounded-full ${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {call.status}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Stake</div>
              <div className="text-xl font-bold text-blue-600">
                {(parseFloat(call.amount) / 1e9).toFixed(2)} SOL
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Total Pool</div>
              <div className="text-xl font-bold text-green-600">
                {(parseFloat(call.total_stake) / 1e9).toFixed(2)} SOL
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Challengers</div>
              <div className="text-xl font-bold">{call.total_challengers}</div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Deadline</div>
              <div className="text-sm font-semibold">
                {deadline.toLocaleDateString()}
                <br />
                {deadline.toLocaleTimeString()}
              </div>
            </div>
          </div>

          {!isExpired && call.status === 'Active' && (
            <button
              onClick={() => setShowChallengeForm(!showChallengeForm)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              {showChallengeForm ? 'Cancel Challenge' : 'Challenge This Call'}
            </button>
          )}

          {showChallengeForm && (
            <form onSubmit={handleChallenge} className="mt-6 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold mb-4">Submit Challenge</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stake Amount (SOL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stake}
                    onChange={(e) => setFormData({ ...formData, stake: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence Level (50-100%)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={formData.confidence}
                    onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={challenging}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {challenging ? 'Submitting...' : 'Submit Challenge'}
                </button>
              </div>
            </form>
          )}
        </div>

        {challenges.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Challenges ({challenges.length})</h2>
            <div className="space-y-3">
              {challenges.map((challenge) => (
                <div key={challenge.id} className="border-b pb-3 last:border-b-0">
                  <div className="flex justify-between items-center">
                    <Link
                      href={`/user/${challenge.challenger}`}
                      className="text-blue-600 hover:underline"
                    >
                      {challenge.challenger.slice(0, 8)}...{challenge.challenger.slice(-8)}
                    </Link>
                    <div className="text-right">
                      <div className="font-semibold">
                        {(parseFloat(challenge.stake) / 1e9).toFixed(2)} SOL
                      </div>
                      <div className="text-sm text-gray-600">
                        {challenge.confidence}% confidence
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
