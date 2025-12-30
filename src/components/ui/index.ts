// UI Components index
// Re-export custom UI components (migrated from HeroUI to shadcn/Radix)

// Button
export { Button, IconButton, type ButtonProps } from "./button";

// Form inputs
export { Input, Label, type InputProps } from "./input";
export { Textarea, type TextareaProps } from "./textarea";
export { Checkbox, type CheckboxProps } from "./checkbox";
export { Radio, RadioGroup, RadioGroupItem, type RadioProps, type RadioGroupProps } from "./radio";
export { Toggle, Switch, type ToggleProps } from "./toggle";
export { Slider, type SliderProps } from "./slider";
export { Select, SelectItem, type SelectProps, type SelectOption } from "./select";

// Date/Time
export { DatePicker, Calendar, type DatePickerProps, type CalendarProps } from "./date-picker";
export { TimePicker, TimeInput, type TimePickerProps } from "./time-picker";

// Modal/Dialog
export {
  Modal,
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ConfirmationDialog,
  AnimatedModalOverlay,
  type ModalProps,
  type ConfirmationDialogProps,
} from "./modal";

// Dropdown
export {
  Dropdown,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownTrigger,
  DropdownSection,
  DropdownItem,
  type DropdownProps,
  type DropdownMenuItemData,
  type DropdownMenuSectionData,
} from "./dropdown";

// Popover
export {
  Popover,
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverBase,
  type PopoverProps,
} from "./popover";

// Tooltip
export {
  Tooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  type TooltipProps,
} from "./tooltip";

// Card
export {
  Card,
  CardRoot,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardContent,
  CardFooter,
  StatCard,
  ClickableCard,
  type CardProps,
  type StatCardProps,
  type ClickableCardProps,
} from "./card";

// Badge
export {
  Badge,
  StatusBadge,
  CountBadge,
  Chip,
  type BadgeProps,
  type BadgeVariant,
  type StatusBadgeProps,
  type CountBadgeProps,
  type ChipProps,
} from "./badge";

// Avatar
export {
  Avatar,
  AvatarRoot,
  AvatarImage,
  AvatarFallback,
  UserAvatar,
  AvatarGroup,
  type AvatarProps,
  type UserAvatarProps,
  type AvatarGroupProps,
} from "./avatar";

// Table
export {
  Table,
  TableRoot,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableColumn,
  TableSkeleton,
  type TableProps,
  type Column,
  type SortDescriptor,
  type SortDirection,
  type TableSkeletonProps,
} from "./table";

// Tabs
export {
  Tabs,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tab,
  type TabsProps,
  type TabItem,
} from "./tabs";

// Pagination
export {
  Pagination,
  PaginationRoot,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  type PaginationProps,
} from "./pagination";

// Breadcrumbs
export {
  Breadcrumbs,
  BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  type BreadcrumbsProps,
  type BreadcrumbItemData,
} from "./breadcrumbs";

// Accordion
export {
  Accordion,
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  type AccordionProps,
  type AccordionItemData,
} from "./accordion";

// Progress
export { Progress, type ProgressProps } from "./progress";

// Skeleton
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonImage,
  type SkeletonProps,
} from "./skeleton";

// Scroll Area
export { ScrollArea, ScrollBar, ScrollShadow, type ScrollAreaProps, type ScrollShadowProps } from "./scroll-area";

// Separator/Divider
export { Separator, Divider } from "./separator";

// Spinner
export { Spinner, type SpinnerProps } from "./spinner";

// Toast
export { Toaster, toast, addToast, useToast, ToastProvider } from "./toast";

// Empty State
export { EmptyState, type EmptyStateProps } from "./empty-state";

// Tag Input
export { TagInput, type TagInputProps } from "./tag-input";
