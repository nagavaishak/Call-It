'use client';

import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { api, Call } from '@/lib/api';
import { makeCall } from '@/lib/program';
import Link from 'next/link';

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    deadlineHours: '24',
  });

  useEffect(() => {
    loadCalls();
  }, []);

  async function loadCalls() {
    setLoading(true);
    try {
      const data = await api.getCalls({ limit: 20, status: 'Active' });
      setCalls(data);
    } catch (error) {
      console.error('Failed to load calls:', error);
    }
    setLoading(false);
  }

  async function handleCreateCall(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert('Please connect your wallet');
      return;
    }

    setCreating(true);
    try {
      const result = await makeCall(
        connection,
        wallet as any,
        formData.description,
        parseFloat(formData.amount),
        parseInt(formData.deadlineHours)
      );

      alert(`Call created! TX: ${result.tx}`);
      setShowCreateForm(false);
      setFormData({ description: '', amount: '', deadlineHours: '24' });

      setTimeout(loadCalls, 2000);
    } catch (error: any) {
      console.error('Failed to create call:', error);
      alert(`Error: ${error.message}`);
    }
    setCreating(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Active Calls</h1>
            <p className="text-gray-600 mt-1">Challenge calls or make your own prediction</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            {showCreateForm ? 'Cancel' : '+ Make Call'}
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Create New Call</h2>
            <form onSubmit={handleCreateCall} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., SOL will hit $200 by March 2026"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stake Amount (SOL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deadline (hours)
                  </label>
                  <input
                    type="number"
                    value={formData.deadlineHours}
                    onChange={(e) => setFormData({ ...formData, deadlineHours: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Call'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading calls...</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No active calls. Be the first to make one!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {calls.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CallCard({ call }: { call: Call }) {
  const deadline = new Date(call.deadline * 1000);
  const isExpired = deadline < new Date();

  return (
    <Link href={`/call/${call.id}`}>
      <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{call.description}</h3>
            <p className="text-sm text-gray-600">
              by {call.caller.slice(0, 4)}...{call.caller.slice(-4)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {(parseFloat(call.amount) / 1e9).toFixed(2)} SOL
            </div>
            <div className="text-sm text-gray-500">
              {call.total_challengers} challenger{call.total_challengers !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className={`px-3 py-1 rounded-full ${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {isExpired ? 'Expired' : 'Active'}
          </div>
          <div className="text-gray-600">
            Deadline: {deadline.toLocaleDateString()} {deadline.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </Link>
  );
}
