export interface Call {
  id: string;
  onchain_id: string;
  caller: string;
  caller_address: string;
  claim: string;
  category: 'TokenPrice' | 'RugPrediction';
  token_address?: string;
  target_price?: number;
  creation_price?: number;
  stake: number;
  confidence: number;
  deadline: number;
  created_at: number;
  status: 'Active' | 'ResolvedCallerWins' | 'ResolvedCallerLoses' | 'AutoRefunded';
  challengers_count: number;
}

export interface Challenge {
  id: string;
  onchain_id: string;
  call_id: string;
  challenger: string;
  challenger_address: string;
  stake: number;
  confidence: number;
  created_at: number;
}

export interface User {
  wallet_address: string;
  callit_score: number;
  tier: number;
  total_calls: number;
  won_calls: number;
  lost_calls: number;
  total_challenged: number;
  won_challenges: number;
  lost_challenges: number;
  current_streak: number;
  created_at: number;
  updated_at: number;
}

export interface Event {
  id: string;
  event_type: 'CallCreated' | 'CallChallenged' | 'CallResolved' | 'CallAutoRefunded';
  call_id?: string;
  challenge_id?: string;
  user_address: string;
  data: any;
  signature: string;
  slot: number;
  timestamp: number;
}
