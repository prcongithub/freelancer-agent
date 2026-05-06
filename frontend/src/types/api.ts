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

export interface ProjectAnalysis {
  scope: string;
  effort_days: number;
  calendar_weeks: number;
  recommendation: 'take' | 'skip' | 'maybe';
  confidence: number;
  reasoning: string;
  ai_advantage?: string;
  skill_gaps: string[];
  unknowns: string[];
  red_flags: string[];
}

export interface BidStats {
  bid_count?: number;
  bid_avg?: number;
}

export interface ProjectUpgrades {
  nda: boolean;
  urgent: boolean;
  featured: boolean;
  sealed: boolean;
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
  freelancer_url?: string;
  bid_stats?: BidStats;
  upgrades?: ProjectUpgrades;
  bid_recommendation?: BidRecommendation;
  discovered_at?: string;
  bid_at?: string;
  won_at?: string;
  delivered_at?: string;
  analysis?: ProjectAnalysis;
  analyzed_at?: string;
}

export interface BidRecommendation {
  amount: number;        // in project currency
  amount_usd: number;   // always USD
  currency: string;
  full_amount_usd: number;
  within_budget: boolean;
  hourly_rate: number;
  estimated_hours: number;
  traditional_days?: number;
  ai_speedup?: number;
  discount_applied: number;
  rate_range: { min: number; max: number };
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

export interface ClientProject {
  freelancer_id: string;
  title: string;
  description?: string;
  budget_range: { min?: number; max?: number; currency?: string };
  skills_required: string[];
  bid_count: number;
  bid_avg?: number;
}

export interface BidShortlistItem {
  rank: number;
  bidder_id: string;
  bidder_name: string;
  bid_amount: number;
  score: number;
  strengths: string[];
  concerns: string[];
  summary: string;
}

export interface ClientAnalysisResult {
  id: string;
  project_freelancer_id: string;
  shortlist: BidShortlistItem[];
  analyzed_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  provider: string;
  avatar_url?: string;
  created_at: string;
}

export interface AdminStats {
  users: { total: number; freelancers: number; clients: number };
  projects: { total: number; by_status: Record<string, number> };
  analyses: { total: number };
}

export interface Prototype {
  id: string;
  project_id: string;
  proto_id: string;
  status: 'generating' | 'ready' | 'failed' | 'approved' | 'rejected';
  public_url?: string;
  approved: boolean;
  generated_at?: string;
  approved_at?: string;
  created_at?: string;
}
