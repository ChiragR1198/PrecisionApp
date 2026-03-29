-- ============================================================
-- Push Notifications: Device Tokens Table
-- Run this SQL in your database to store Expo push tokens per user.
-- Backend will use these tokens to send push via Expo Push API.
-- ============================================================

-- Table: device_tokens
-- Stores one row per device per user. Same user can have multiple devices.
CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT 'delegate id or sponsor id from your users table',
  `user_type` enum('delegate','sponsor') NOT NULL DEFAULT 'delegate',
  `expo_push_token` varchar(255) NOT NULL COMMENT 'Expo push token e.g. ExponentPushToken[xxx]',
  `device_platform` varchar(10) DEFAULT NULL COMMENT 'ios or android',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_device_token` (`user_id`, `user_type`, `expo_push_token`),
  KEY `idx_user` (`user_id`, `user_type`),
  KEY `idx_expo_token` (`expo_push_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Expo push tokens for mobile app notifications';

-- Optional: log sent notifications (for debugging / analytics)
CREATE TABLE IF NOT EXISTS `push_notification_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `user_type` enum('delegate','sponsor') NOT NULL,
  `expo_push_token` varchar(255) NOT NULL,
  `notification_type` varchar(50) NOT NULL COMMENT 'meeting_request, meeting_acceptance, session_reminder, exhibition_announcement, message',
  `title` varchar(255) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `data_json` text DEFAULT NULL COMMENT 'JSON payload sent in data',
  `expo_receipt_id` varchar(100) DEFAULT NULL COMMENT 'from Expo push receipt if needed',
  `status` enum('sent','failed') DEFAULT 'sent',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_type` (`user_id`, `user_type`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log of push notifications sent';
