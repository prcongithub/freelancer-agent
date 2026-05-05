export interface FitScore {
  total: number;
  skill_match: number;
  budget: number;
  scope_clarity: number;
  agent_buildable: number;
  client_quality: number;
}

export interface BudgetRange {
  min: number;
  max: number;
  currency: string;
}

export interface Client {
  id: string;
  name?: string;
  rating?: number;
  payment_verified?: boolean;
  country?: string;
}

export interface Project {
  id: string;
  freelancer_id: string;
  title: string;
  description?: string;
  budget_range?: BudgetRange;
  skills_required?: string[];
  client?: Client;
  fit_score?: FitScore;
  status: string;
  category?: string;
  discovered_at?: string;
  bid_at?: string;
  won_at?: string;
  delivered_at?: string;
}

export interface PricingBreakdown {
  amount?: number;
  hourly_rate?: number;
  estimated_hours?: number;
  discount_applied?: number;
}

export interface Bid {
  id: string;
  project_id: string;
  project_title: string;
  amount: number;
  currency: string;
  proposal_text?: string;
  pricing_breakdown?: PricingBreakdown;
  status: string;
  submitted_at?: string;
  freelancer_bid_id?: string;
}

export interface PipelineCounts {
  discovered: number;
  bid_sent: number;
  shortlisted: number;
  won: number;
  in_call: number;
  prd_ready: number;
  building: number;
  deployed: number;
  delivered: number;
  lost: number;
}

export interface DashboardStats {
  total_discovered: number;
  total_bids: number;
  bids_won: number;
  win_rate: number;
  total_revenue: number;
}

export interface DashboardData {
  pipeline: PipelineCounts;
  stats: DashboardStats;
  recent_projects: Array<Pick<Project, 'id' | 'title' | 'status' | 'fit_score' | 'category'>>;
}

export interface Settings {
  auto_bid_threshold: number;
  approval_threshold: number;
  skill_keywords: Record<string, string[]>;
  pricing_floors: Record<string, { min: number; max: number }>;
  notifications: { email: boolean; dashboard: boolean };
}
