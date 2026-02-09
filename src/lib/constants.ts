export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://www.wins.im')

export const WHEEL_SLICE_COLORS = [
  '#FF6B2C', // Electric Orange
  '#132240', // Midnight Blue
  '#FFAA33', // Hot Amber
  '#1E3A5F', // Steel Blue
  '#8B5CF6', // Electric Violet
  '#0F2D4A', // Deep Teal Navy
  '#FF4F6F', // Neon Coral
  '#1A3352', // Ink Blue
]

export const BRIGHT_SLICES = new Set([0, 2, 4, 6]) // indices of bright colors
export const CONFETTI_COLORS = ['#FF6B2C', '#FFAA33', '#8B5CF6', '#FF4F6F', '#3B82F6']

export const SPIN_DURATION_MIN = 4000
export const SPIN_DURATION_MAX = 7000
export const SPIN_EASING = 'cubic-bezier(0.17, 0.67, 0.12, 0.99)'

export type WheelStatus = 'open' | 'spinning' | 'completed' | 'closed'
export type WheelTheme = 'default' | 'neon' | 'minimal' | 'dark'

export interface WheelRow {
  id: string
  admin_id: string
  title: string
  slug: string
  prize_description: string | null
  max_slots_per_user: number
  max_participants: number | null
  status: WheelStatus
  theme: WheelTheme
  custom_colors: string[] | null
  show_confetti: boolean
  sound_enabled: boolean
  winner_name: string | null
  winner_participant_id: string | null
  spin_history: SpinResult[]
  spin_at: string | null
  created_at: string
  updated_at: string
}

export interface ParticipantRow {
  id: string
  wheel_id: string
  user_id: string | null
  display_name: string
  slots_used: number
  joined_at: string
}

export interface ProfileRow {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface SpinResult {
  winner_name: string
  winner_id: string
  spun_at: string
  final_angle: number
}
