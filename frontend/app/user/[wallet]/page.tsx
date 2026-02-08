'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, User, Call, Challenge } from '@/lib/api';
import Link from 'next/link';

export default function UserProfilePage() {
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calls' | 'challenges'>('calls');

  useEffect(() => {
    if (params.wallet) {
      loadUserData();
    }
  }, [params.wallet]);

  async function loadUserData() {
    setLoading(true);
    try {
      const wallet = params.wallet as string;
      const [userData, callsData, challengesData] = await Promise.all([
        api.getUser(wallet),
        api.getUserCalls(wallet, { limit: 50 }),
        api.getUserChallenges(wallet, { limit: 50 }),
      ]);

      setUser(userData);
      setCalls(callsData);
      setChallenges(challengesData);
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">User not found</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Calls
          </Link>
        </div>
      </div>
    );
  }

  const winRate = user.total_calls > 0
    ? ((user.won_calls / user.total_calls) * 100).toFixed(1)
    : '0.0';

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/leaderboard" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Leaderboard
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2 font-mono">
                {user.wallet_address}
              </h1>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getTierColor(user.tier)}`}>
                  {user.tier}
                </span>
                {user.current_streak > 0 && (
                  <span className="text-orange-600 font-semibold">
                    🔥 {user.current_streak} streak
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">CALL IT Score</div>
              <div className="text-2xl font-bold text-blue-600">
                {user.callit_score.toFixed(2)}
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Win Rate</div>
              <div className={`text-2xl font-bold ${getWinRateColor(parseFloat(winRate))}`}>
                {winRate}%
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Total Calls</div>
              <div className="text-2xl font-bold text-gray-900">{user.total_calls}</div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Calls Won</div>
              <div className="text-2xl font-bold text-purple-600">{user.won_calls}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('calls')}
                className={`px-6 py-3 font-semibold ${
                  activeTab === 'calls'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Calls ({calls.length})
              </button>
              <button
                onClick={() => setActiveTab('challenges')}
                className={`px-6 py-3 font-semibold ${
                  activeTab === 'challenges'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Challenges ({challenges.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'calls' ? (
              calls.length > 0 ? (
                <div className="space-y-3">
                  {calls.map((call) => (
                    <Link
                      key={call.id}
                      href={`/call/${call.id}`}
                      className="block border rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">{call.description}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(call.status)}`}>
                          {call.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{(parseFloat(call.amount) / 1e9).toFixed(2)} SOL</span>
                        <span>•</span>
                        <span>{call.total_challengers} challenger(s)</span>
                        <span>•</span>
                        <span>{new Date(call.created_at * 1000).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No calls yet</p>
              )
            ) : challenges.length > 0 ? (
              <div className="space-y-3">
                {challenges.map((challenge) => (
                  <Link
                    key={challenge.id}
                    href={`/call/${challenge.call_id}`}
                    className="block border rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-1">Challenge on call</p>
                        <p className="font-mono text-sm text-blue-600">
                          {challenge.call_id.slice(0, 16)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {(parseFloat(challenge.stake) / 1e9).toFixed(2)} SOL
                        </div>
                        <div className="text-sm text-gray-600">
                          {challenge.confidence}% confidence
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      {new Date(challenge.created_at * 1000).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No challenges yet</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'Diamond':
      return 'bg-blue-100 text-blue-700';
    case 'Platinum':
      return 'bg-gray-100 text-gray-700';
    case 'Gold':
      return 'bg-yellow-100 text-yellow-700';
    case 'Silver':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-green-100 text-green-700';
  }
}

function getWinRateColor(rate: number): string {
  if (rate >= 70) return 'text-green-600';
  if (rate >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Active':
      return 'bg-green-100 text-green-700';
    case 'ResolvedCallerWins':
      return 'bg-blue-100 text-blue-700';
    case 'ResolvedCallerLoses':
      return 'bg-red-100 text-red-700';
    case 'Refunded':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
