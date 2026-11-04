import type { LucideProps } from 'lucide-react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  Download,
  Eye,
  Globe,
  Info,
  Keyboard,
  Layers,
  LayoutDashboard,
  Lock,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsGear,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';

const defaults = (props: LucideProps): LucideProps => ({
  size: 16,
  strokeWidth: 1.75,
  'aria-hidden': props['aria-label'] ? undefined : true,
  focusable: 'false',
  ...props,
});

export const IconDashboard = (p: LucideProps) => <LayoutDashboard {...defaults(p)} />;
export const IconSliders = (p: LucideProps) => <SlidersHorizontal {...defaults(p)} />;
export const IconPalette = (p: LucideProps) => <Palette {...defaults(p)} />;
export const IconGlobe = (p: LucideProps) => <Globe {...defaults(p)} />;
export const IconEye = (p: LucideProps) => <Eye {...defaults(p)} />;
export const IconClock = (p: LucideProps) => <Clock {...defaults(p)} />;
export const IconZap = (p: LucideProps) => <Zap {...defaults(p)} />;
export const IconShieldCheck = (p: LucideProps) => <ShieldCheck {...defaults(p)} />;
export const IconShield = (p: LucideProps) => <Shield {...defaults(p)} />;
export const IconInfo = (p: LucideProps) => <Info {...defaults(p)} />;
export const IconSettings = (p: LucideProps) => <SettingsGear {...defaults(p)} />;
export const IconReset = (p: LucideProps) => <RotateCcw {...defaults(p)} />;
export const IconDownload = (p: LucideProps) => <Download {...defaults(p)} />;
export const IconUpload = (p: LucideProps) => <Upload {...defaults(p)} />;
export const IconPlus = (p: LucideProps) => <Plus {...defaults(p)} />;
export const IconTrash = (p: LucideProps) => <Trash2 {...defaults(p)} />;
export const IconClose = (p: LucideProps) => <X {...defaults(p)} />;
export const IconCheck = (p: LucideProps) => <Check {...defaults(p)} />;
export const IconCheckCircle = (p: LucideProps) => <CheckCircle2 {...defaults(p)} />;
export const IconAlertTriangle = (p: LucideProps) => <AlertTriangle {...defaults(p)} />;
export const IconAlertCircle = (p: LucideProps) => <AlertCircle {...defaults(p)} />;
export const IconChevronDown = (p: LucideProps) => <ChevronDown {...defaults(p)} />;
export const IconChevronRight = (p: LucideProps) => <ChevronRight {...defaults(p)} />;
export const IconSparkles = (p: LucideProps) => <Sparkles {...defaults(p)} />;
export const IconMoon = (p: LucideProps) => <Moon {...defaults(p)} />;
export const IconSun = (p: LucideProps) => <Sun {...defaults(p)} />;
export const IconSearch = (p: LucideProps) => <Search {...defaults(p)} />;
export const IconCode = (p: LucideProps) => <Code2 {...defaults(p)} />;
export const IconBook = (p: LucideProps) => <BookOpen {...defaults(p)} />;
export const IconKeyboard = (p: LucideProps) => <Keyboard {...defaults(p)} />;
export const IconLock = (p: LucideProps) => <Lock {...defaults(p)} />;
export const IconCpu = (p: LucideProps) => <Cpu {...defaults(p)} />;
export const IconLayers = (p: LucideProps) => <Layers {...defaults(p)} />;
