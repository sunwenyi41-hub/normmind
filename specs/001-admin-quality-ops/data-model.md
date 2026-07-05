# Data Model

## Administrator

- `user_id`: 认证用户标识
- `email`: 授权邮箱，比较时统一小写
- `role`: `admin`

## Feedback Case

- 沿用 `feedback`：`id`, `message_id`, `user_id`, `rating`, `reason`, `created_at`
- 待扩展：`status`, `assignee_id`, `resolved_at`
- 状态：待处理 → 处理中 → 已解决 / 已关闭

## QA Sample

- `id`, `question`, `expected_points`, `category`, `status`, `owner_id`, `created_at`, `updated_at`

## Evaluation Run

- `id`, `name`, `status`, `total_count`, `passed_count`, `failed_items`, `created_by`, `created_at`
