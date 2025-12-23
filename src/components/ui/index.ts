// UI Components index
// Re-export custom UI wrappers and HeroUI components

// Custom UI wrappers with enhanced functionality
export { Button, IconButton, type ButtonProps } from "./button";
export { Input, type InputProps } from "./input";
export { Select, SelectItem, type SelectProps, type SelectOption } from "./select";
export {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ConfirmationDialog,
  AnimatedModalOverlay,
  type ModalProps,
  type ConfirmationDialogProps,
} from "./modal";
export {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  StatCard,
  ClickableCard,
  type CardProps,
  type StatCardProps,
  type ClickableCardProps,
} from "./card";
export {
  Badge,
  StatusBadge,
  CountBadge,
  type BadgeProps,
  type BadgeVariant,
  type StatusBadgeProps,
  type CountBadgeProps,
} from "./badge";
export {
  Avatar,
  UserAvatar,
  AvatarGroup,
  type AvatarProps,
  type UserAvatarProps,
  type AvatarGroupProps,
} from "./avatar";
export {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  TableSkeleton,
  type TableProps,
  type Column,
  type SortDescriptor,
  type SortDirection,
  type TableSkeletonProps,
} from "./table";
export { Tabs, Tab, type TabsProps, type TabItem } from "./tabs";
export {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
  type DropdownProps,
  type DropdownMenuItem,
  type DropdownMenuSection,
} from "./dropdown";
export { Tooltip, type TooltipProps } from "./tooltip";
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonImage,
  type SkeletonProps,
} from "./skeleton";
export { EmptyState, type EmptyStateProps } from "./empty-state";

// Re-export commonly used HeroUI components that don't have custom wrappers
export {
  Chip,
  Spinner,
  Progress,
  Divider,
  Pagination,
  Breadcrumbs,
  BreadcrumbItem,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Link,
  Accordion,
  AccordionItem,
  Switch,
  Checkbox,
  Radio,
  RadioGroup,
  Textarea,
  Popover,
  PopoverTrigger,
  PopoverContent,
  User,
  ScrollShadow,
} from "@heroui/react";
