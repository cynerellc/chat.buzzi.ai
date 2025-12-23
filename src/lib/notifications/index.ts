/**
 * Notifications Module
 *
 * Provides notification services:
 * - Push notifications (Web Push, FCM, APNS)
 * - Device subscription management
 * - Notification templates
 * - Delivery tracking
 */

export {
  PushService,
  getPushService,
  createPushService,
  NotificationTemplates,
  type PushProvider,
  type PushSubscription,
  type PushNotification,
  type DeliveryResult,
  type VAPIDKeys,
  type FCMConfig,
} from "./push-service";
