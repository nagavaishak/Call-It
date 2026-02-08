const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Call {
  id: string;
  onchain_id?: string;
  caller: string;
  description: string;
  amount: string;
  deadline: number;
  status: string;
  created_at: number;
  resolved_at?: number;
  total_challengers: number;
  total_stake: string;
}

export interface Challenge {
  id: string;
  call_id: string;
  challenger: string;
  stake: string;
  confidence: number;
  created_at: number;
}

export interface User {
  wallet_address: string;
  callit_score: number;
  tier: string;
  total_calls: number;
  won_calls: number;
  current_streak: number;
}

export const api = {
  // Calls
  async getCalls(params?: { limit?: number; offset?: number; status?: string }): Promise<Call[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.status) queryParams.append('status', params.status);

    const response = await fetch(`${API_URL}/api/calls?${queryParams}`);
    const data = await response.json();
    return data.calls || [];
  },

  async getCall(id: string): Promise<Call | null> {
    const response = await fetch(`${API_URL}/api/calls/${id}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.call;
  },

  async getCallChallenges(id: string): Promise<Challenge[]> {
    const response = await fetch(`${API_URL}/api/calls/${id}/challenges`);
    const data = await response.json();
    return data.challenges || [];
  },

  // Users
  async getUser(wallet: string): Promise<User | null> {
    const response = await fetch(`${API_URL}/api/users/${wallet}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.user;
  },

  async getUserCalls(wallet: string, params?: { limit?: number; offset?: number }): Promise<Call[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const response = await fetch(`${API_URL}/api/users/${wallet}/calls?${queryParams}`);
    const data = await response.json();
    return data.calls || [];
  },

  async getUserChallenges(wallet: string, params?: { limit?: number; offset?: number }): Promise<Challenge[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const response = await fetch(`${API_URL}/api/users/${wallet}/challenges?${queryParams}`);
    const data = await response.json();
    return data.challenges || [];
  },

  async getLeaderboard(limit = 50): Promise<User[]> {
    const response = await fetch(`${API_URL}/api/users/leaderboard?limit=${limit}`);
    const data = await response.json();
    return data.leaderboard || [];
  },
};
