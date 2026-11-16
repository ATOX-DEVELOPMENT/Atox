/**
 * @atox/ui: набор компонентов для экранов на холсте Atox.
 *
 * Зависимости только react и lucide-react; оформление классами Tailwind v4 и токенами
 * из tokens.css, который shell экрана подключает внутри <style type="text/tailwindcss">.
 * Компилировать с автоматическим JSX-рантаймом (jsx: react-jsx). Справка для агентов: GUIDE.md.
 */

export { cn } from './lib/cn'
export { formatCompact, initials } from './lib/format'
export type { Accent, Tone } from './lib/tokens'

// Тема и раскладка
export { Theme, type ThemeProps } from './components/Theme'
export { Screen, ScrollArea, type ScreenProps, type ScrollAreaProps } from './components/Screen'
export {
  Container,
  Grid,
  Row,
  Stack,
  type ContainerProps,
  type Gap,
  type GridProps,
  type RowProps,
  type StackProps
} from './components/Layout'
export { Heading, Text, type HeadingProps, type HeadingSize, type TextProps } from './components/Typography'
export { Icon, type IconProps } from './components/Icon'

// Базовые элементы
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/Button'
export { IconButton, type IconButtonProps } from './components/IconButton'
export { Input, type InputProps } from './components/Input'
export { Textarea, type TextareaProps } from './components/Textarea'
export { Select, type SelectOption, type SelectProps } from './components/Select'
export { Checkbox, type CheckboxProps } from './components/Checkbox'
export { Radio, RadioGroup, type RadioGroupProps, type RadioOption, type RadioProps } from './components/Radio'
export { Switch, type SwitchProps } from './components/Switch'
export { Slider, type SliderProps } from './components/Slider'
export { SegmentedControl, type SegmentedControlProps, type SegmentItem } from './components/SegmentedControl'
export { Tabs, type TabItem, type TabsProps } from './components/Tabs'
export { Badge, type BadgeProps } from './components/Badge'
export { Tag, type TagProps } from './components/Tag'
export { Avatar, AvatarGroup, type AvatarGroupProps, type AvatarProps, type AvatarSize } from './components/Avatar'
export { Tooltip, type TooltipProps } from './components/Tooltip'
export { Divider, type DividerProps } from './components/Divider'
export { Kbd, type KbdProps } from './components/Kbd'
export { Spinner, type SpinnerProps } from './components/Spinner'
export { Skeleton, SkeletonText, type SkeletonProps, type SkeletonTextProps } from './components/Skeleton'
export { Progress, type ProgressProps } from './components/Progress'
export { Field, type FieldProps } from './components/Field'

// Контейнеры и обратная связь
export { Card, CardFooter, CardHeader, type CardHeaderProps, type CardProps } from './components/Card'
export { Stat, type StatProps } from './components/Stat'
export { EmptyState, type EmptyStateProps } from './components/EmptyState'
export { Alert, type AlertProps, type StatusTone } from './components/Alert'
export { Toast, type ToastProps } from './components/Toast'
export { Overlay, type OverlayProps } from './components/Overlay'
export { Dialog, type DialogProps } from './components/Dialog'
export { Sheet, type SheetProps } from './components/Sheet'
export { Menu, Popover, type MenuEntry, type MenuProps, type PopoverProps } from './components/Menu'

// Навигация и данные
export { Breadcrumbs, type BreadcrumbsProps, type Crumb } from './components/Breadcrumbs'
export { Pagination, type PaginationProps } from './components/Pagination'
export { Table, type TableColumn, type TableProps } from './components/Table'
export { List, ListItem, type ListItemProps, type ListProps } from './components/List'

// Телефон
export { StatusBar, type StatusBarProps } from './components/StatusBar'
export { NavBar, type NavBarProps } from './components/NavBar'
export { TabBar, type TabBarItem, type TabBarProps } from './components/TabBar'
export { HomeIndicator, type HomeIndicatorProps } from './components/HomeIndicator'
export { Fab, type FabProps } from './components/Fab'
export { ActionSheet, type ActionSheetAction, type ActionSheetProps } from './components/ActionSheet'

// Десктоп и веб-приложения
export { Brand, type BrandProps } from './components/Brand'
export {
  Sidebar,
  SidebarItem,
  SidebarSection,
  type SidebarItemProps,
  type SidebarProps,
  type SidebarSectionProps
} from './components/Sidebar'
export { Topbar, type TopbarProps } from './components/Topbar'
export { SearchField, type SearchFieldProps } from './components/SearchField'
export { CommandBar, type CommandBarProps, type CommandGroup, type CommandItem } from './components/CommandBar'
export { PageHeader, type PageHeaderProps } from './components/PageHeader'
export { Section, type SectionProps } from './components/Section'

// Сайт
export { SiteNav, type SiteNavLink, type SiteNavProps } from './components/SiteNav'
export { Hero, type HeroProps } from './components/Hero'
export { FeatureGrid, type Feature, type FeatureGridProps } from './components/FeatureGrid'
export { PricingCard, type PricingCardProps } from './components/PricingCard'
export { Testimonial, type TestimonialProps } from './components/Testimonial'
export { FaqItem, type FaqItemProps } from './components/FaqItem'
export { CtaBand, type CtaBandProps } from './components/CtaBand'
export { Footer, type FooterColumn, type FooterProps } from './components/Footer'

// Графики
export { BarChart, type BarChartProps, type BarDatum } from './components/charts/BarChart'
export { AreaChart, LineChart, type LineChartProps, type LineSeries } from './components/charts/LineChart'
export { Donut, type DonutDatum, type DonutProps } from './components/charts/Donut'
export { Sparkline, type SparklineProps } from './components/charts/Sparkline'
export { Legend, type LegendItem } from './components/charts/Legend'
export type { ChartTone } from './components/charts/geometry'
