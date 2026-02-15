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

export type WheelStatus = 'open' | 'spinning' | 'completed' | 'closed'
export type WheelTheme = 'default' | 'neon' | 'minimal' | 'dark'

// Theme-specific color palettes
export const THEME_PALETTES: Record<WheelTheme, {
  sliceColors: string[]
  brightSlices: Set<number>
  outerRing: string
  hubGradient: [string, string]
  hubStroke: string
  hubText: string
  pointerColor: string
  emptyBg: string
  glowColor: string
}> = {
  default: {
    sliceColors: WHEEL_SLICE_COLORS,
    brightSlices: BRIGHT_SLICES,
    outerRing: '#FF6B2C',
    hubGradient: ['#1E3A5F', '#0A1628'],
    hubStroke: '#FF6B2C',
    hubText: '#FF6B2C',
    pointerColor: '#FF6B2C',
    emptyBg: '#132240',
    glowColor: 'rgba(255, 107, 44, 0.3)',
  },
  neon: {
    sliceColors: [
      '#00FF87', // Neon Green
      '#0A1628', // Dark
      '#FF006E', // Neon Pink
      '#1A1A2E', // Deep Dark
      '#00D4FF', // Neon Cyan
      '#16213E', // Dark Blue
      '#FFD600', // Neon Yellow
      '#0F0F23', // Near Black
    ],
    brightSlices: new Set([0, 2, 4, 6]),
    outerRing: '#00FF87',
    hubGradient: ['#1A1A2E', '#0A0A1A'],
    hubStroke: '#00FF87',
    hubText: '#00FF87',
    pointerColor: '#00FF87',
    emptyBg: '#0A0A1A',
    glowColor: 'rgba(0, 255, 135, 0.4)',
  },
  minimal: {
    sliceColors: [
      '#F1F5F9', // Slate 100
      '#CBD5E1', // Slate 300
      '#E2E8F0', // Slate 200
      '#94A3B8', // Slate 400
      '#F8FAFC', // Slate 50
      '#CBD5E1', // Slate 300
      '#E2E8F0', // Slate 200
      '#94A3B8', // Slate 400
    ],
    brightSlices: new Set([0, 1, 2, 3, 4, 5, 6, 7]),
    outerRing: '#64748B',
    hubGradient: ['#F1F5F9', '#E2E8F0'],
    hubStroke: '#64748B',
    hubText: '#334155',
    pointerColor: '#334155',
    emptyBg: '#F1F5F9',
    glowColor: 'rgba(100, 116, 139, 0.2)',
  },
  dark: {
    sliceColors: [
      '#8B5CF6', // Violet
      '#0F0F1A', // Near Black
      '#EC4899', // Pink
      '#1A1A2E', // Dark Navy
      '#F59E0B', // Amber
      '#111122', // Deep Dark
      '#06B6D4', // Cyan
      '#161625', // Dark Purple
    ],
    brightSlices: new Set([0, 2, 4, 6]),
    outerRing: '#8B5CF6',
    hubGradient: ['#1A1A2E', '#0A0A14'],
    hubStroke: '#8B5CF6',
    hubText: '#8B5CF6',
    pointerColor: '#8B5CF6',
    emptyBg: '#0A0A14',
    glowColor: 'rgba(139, 92, 246, 0.4)',
  },
}

export const SPIN_DURATION_MIN = 4000
export const SPIN_DURATION_MAX = 7000
export const SPIN_EASING = 'cubic-bezier(0.17, 0.67, 0.12, 0.99)'

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
  spin_final_angle: number | null
  spin_duration: number | null
  spin_winner_name: string | null
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
